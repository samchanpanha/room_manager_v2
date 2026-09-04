/**
 * M13 QR payments service (§M13 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/qrpay-service.test.ts
 *
 * Golden flow: open invoice → Pay-by-QR intent (pending payment + QR) →
 * repeat click reuses the SAME intent → simulated gateway webhook confirms
 * it EXACTLY ONCE even when delivered twice → invoice paid, single receipt,
 * single ledger posting. Runs late alphabetically; self-cleans its fixture.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import { createInvoiceQr, memberDuesForToken } from "@/lib/qrpay/service";
import { signMemberToken, verifyMemberToken } from "@/lib/qrpay/tokens";
import { handlePaymentWebhook } from "@/lib/payments/service";

let actor = { id: "", name: "" };
let invoiceId = "";
let memberId = "";
let qrPaymentId = "";
const CODE = "BLR-TEST-QR";

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };

  // Fixture: one open invoice on the seeded active lease (LSE-0001). Fresh
  // copies start with no invoices; re-runs clean their own rows first.
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { code: CODE } } }).catch(() => undefined);
  await prisma.invoiceItem.deleteMany({ where: { invoice: { code: CODE } } });
  await prisma.invoice.deleteMany({ where: { code: CODE } });

  const lease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-0001" } });
  memberId = lease.memberProfileId;
  const invoice = await prisma.invoice.create({
    data: {
      code: CODE,
      propertyId: lease.propertyId,
      leaseId: lease.id,
      memberProfileId: memberId,
      status: "issued",
      issuedAt: new Date(),
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-09-01"),
      dueDate: new Date("2026-08-01"),
      subtotalMinor: 12300,
      totalMinor: 12300,
      amountDueMinor: 12300,
      createdById: actor.id,
      items: { create: { name: "QR test charge", kind: "one_time", qty: 1, unitMinor: 12300, amountMinor: 12300 } }
    }
  });
  invoiceId = invoice.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("§M13 acceptance: portal QR → webhook confirms exactly once", () => {
  it("creates a pending QR intent with a stable gateway ref and a scannable QR", async () => {
    const result = await createInvoiceQr(invoiceId, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    qrPaymentId = result.paymentId;
    expect(result.paymentCode).toMatch(/^PMT-\d{4}-\d{4}$/);
    expect(result.amountMinor).toBe(12300);
    expect(result.provider).toBe("devmock");
    expect(result.qrString).toContain(`amt=12300`);
    expect(result.imageDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.status).toBe("pending");
    expect(payment.method).toBe("qr");
    expect(payment.gatewayRef).toMatch(/^QRPAY-/);
    expect(payment.idempotencyKey).toBe(`QR:${invoiceId}:12300`);
  });

  it("re-click reuses the SAME pending intent (dynamic QR is stable per invoice+due)", async () => {
    const first = await createInvoiceQr(invoiceId, actor);
    const second = await createInvoiceQr(invoiceId, actor);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.qrString).toBe(first.qrString);
    // Exactly ONE pending intent for this invoice (other suites may have
    // their own qr payments — scope to this invoice's deterministic keys).
    expect(await prisma.payment.count({ where: { idempotencyKey: `QR:${invoiceId}:12300` } })).toBe(1);
  });

  it("confirms via simulated gateway webhook exactly once (duplicate delivery ignored)", async () => {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: qrPaymentId } });
    const gatewayRef = payment.gatewayRef!;

    const ledgerBefore = await prisma.ledgerTransaction.count({ where: { refType: "payment" } });
    const receiptsBefore = await prisma.domainEvent.count({ where: { type: "payment.confirmed" } });

    const first = await handlePaymentWebhook({ gatewayRef, status: "confirmed" }, "127.0.0.1");
    expect(first).toMatchObject({ ok: true, ignored: false, paymentStatus: "confirmed" });
    expect(first.ok && first.receiptCode).toMatch(/^RCP-\d{4}-\d{4}$/);

    // Second delivery of the SAME webhook — must be a no-op (§M13 exactly once).
    const replay = await handlePaymentWebhook({ gatewayRef, status: "confirmed" }, "127.0.0.1");
    expect(replay).toMatchObject({ ok: true, ignored: true });

    expect(await prisma.ledgerTransaction.count({ where: { refType: "payment" } })).toBe(ledgerBefore + 1);
    expect(await prisma.domainEvent.count({ where: { type: "payment.confirmed" } })).toBe(receiptsBefore + 1);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe("paid");
    expect(invoice.amountDueMinor).toBe(0);

    // Further QR attempts find nothing to pay.
    const again = await createInvoiceQr(invoiceId, actor);
    expect(again).toMatchObject({ ok: false, code: "NOTHING_DUE" });
  });

  it("gateway/system actors audit with a null actorId (public poster flow, no 500)", async () => {
    const lease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-0001" } });
    const inv = await prisma.invoice.create({
      data: {
        code: "BLR-TEST-QR2",
        propertyId: lease.propertyId,
        leaseId: lease.id,
        memberProfileId: lease.memberProfileId,
        status: "issued",
        issuedAt: new Date(),
        periodStart: new Date("2026-09-01"),
        periodEnd: new Date("2026-10-01"),
        dueDate: new Date("2026-09-01"),
        subtotalMinor: 500,
        totalMinor: 500,
        amountDueMinor: 500,
        createdById: actor.id,
        items: { create: { name: "public QR test", kind: "one_time", qty: 1, unitMinor: 500, amountMinor: 500 } }
      }
    });
    const { GATEWAY_ACTOR } = await import("@/lib/payments/service");
    const result = await createInvoiceQr(inv.id, GATEWAY_ACTOR);
    expect(result.ok).toBe(true);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "payment", entityId: (result as { paymentId: string }).paymentId } });
    expect(audit.actorId).toBeNull();
    expect(audit.actorName).toBe("payment-gateway");
  });

  it("member token resolves dues and the public flow only sees open invoices", async () => {
    // After settlement: no open invoices for this fixture member via LSE-0001's
    // own seeded dues? The payments suite may have left others — assert the
    // fixture invoice is gone from dues, whatever else remains.
    const dues = await memberDuesForToken(memberId);
    expect(dues).not.toBeNull();
    if (!dues) return;
    expect(dues.member.id).toBe(memberId);
    expect(dues.invoices.some((i) => i.code === CODE)).toBe(false);
    expect(verifyMemberToken(signMemberToken(memberId))).toBe(memberId);
  });
});
