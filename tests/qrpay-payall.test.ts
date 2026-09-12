/**
 * M13 pay-all QR service (§M13 acceptance extension) — DB-backed tests against
 * a disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/qrpay-payall.test.ts
 *
 * Golden flow: member with several open invoices → createMemberPayAllQr builds
 * ONE pending payment for the Σ due, FIFO-allocated oldest-first with no
 * explicit selection → repeat click reuses the same intent → gateway webhook
 * confirms exactly once → every invoice paid, a single receipt, one balanced
 * ledger posting → NOTHING_DUE on the next attempt.
 *
 * Runs on its OWN freshly-minted member (no other suite touches it), so the
 * suite is order-independent and never mutates seeded demo data it doesn't own.
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
import { createMemberPayAllQr, memberDuesForToken } from "@/lib/qrpay/service";
import { handlePaymentWebhook } from "@/lib/payments/service";
import { ledgerIntegrity } from "@/lib/ledger/service";

let actor = { id: "", name: "" };
let memberId = "";
let invOldestId = "";
let invNewestId = "";
let payAllPaymentId = "";
let payAllGatewayRef = "";

const OLDEST_AMOUNT_MINOR = 5000;
const NEWEST_AMOUNT_MINOR = 10000;
const TOTAL_MINOR = OLDEST_AMOUNT_MINOR + NEWEST_AMOUNT_MINOR;

const stamp = Date.now();
const PREFIX = `PALL-${stamp}`;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };

  const property = await prisma.property.findFirstOrThrow({ where: { code: "BLR" } });

  // A member nobody else touches — own party, active profile, BLR home.
  const party = await prisma.party.create({
    data: { type: "PERSON", name: `PayAll Test ${stamp}`, tenantId: "DEFAULT" }
  });
  const member = await prisma.memberProfile.create({
    data: {
      partyId: party.id,
      status: "active",
      homePropertyId: property.id,
      nationality: "KH"
    }
  });
  memberId = member.id;

  const mkInvoice = async (code: string, dueDate: string, amountMinor: number) => {
    const inv = await prisma.invoice.create({
      data: {
        code,
        propertyId: property.id,
        memberProfileId: memberId,
        status: "issued",
        issuedAt: new Date(),
        periodStart: new Date(dueDate),
        periodEnd: new Date(dueDate),
        dueDate: new Date(dueDate),
        subtotalMinor: amountMinor,
        totalMinor: amountMinor,
        amountDueMinor: amountMinor,
        createdById: actor.id,
        items: { create: { name: `PayAll fixture ${code}`, kind: "one_time", qty: 1, unitMinor: amountMinor, amountMinor } }
      }
    });
    return inv.id;
  };

  // Oldest due first (FIFO target), smaller amount — lets us assert order.
  invOldestId = await mkInvoice(`${PREFIX}-OLD`, "2026-08-01", OLDEST_AMOUNT_MINOR);
  invNewestId = await mkInvoice(`${PREFIX}-NEW`, "2026-09-01", NEWEST_AMOUNT_MINOR);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("§M13 pay-all: one QR for every open invoice", () => {
  it("builds ONE pending payment for the total, FIFO-allocated with no explicit pick", async () => {
    const result = await createMemberPayAllQr(memberId, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    payAllPaymentId = result.paymentId;

    const createdPayment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    payAllGatewayRef = createdPayment.gatewayRef ?? "";

    expect(result.paymentCode).toMatch(/^PMT-\d{4}-\d{4}$/);
    expect(result.amountMinor).toBe(TOTAL_MINOR);
    expect(result.provider).toBe("devmock");
    expect(result.qrString).toContain(`amt=${TOTAL_MINOR}`);
    expect(result.imageDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: result.paymentId },
      include: { allocations: { orderBy: { createdAt: "asc" } } }
    });
    expect(payment.status).toBe("pending");
    expect(payment.method).toBe("qr");
    expect(payment.amountMinor).toBe(TOTAL_MINOR);
    expect(payment.gatewayRef).toMatch(/^QRPAYALL-/);
    expect(payment.idempotencyKey).toBe(`QRALL:${memberId}:${TOTAL_MINOR}`);

    // Covered across BOTH open invoices, oldest-first (no explicit selection).
    expect(payment.allocations).toHaveLength(2);
    expect(payment.allocations[0].invoiceId).toBe(invOldestId);
    expect(payment.allocations[0].amountMinor).toBe(OLDEST_AMOUNT_MINOR);
    expect(payment.allocations[1].invoiceId).toBe(invNewestId);
    expect(payment.allocations[1].amountMinor).toBe(NEWEST_AMOUNT_MINOR);
  });

  it("repeat click reuses the SAME pending pay-all intent (stable QR per member+bucket)", async () => {
    const first = await createMemberPayAllQr(memberId, actor);
    const second = await createMemberPayAllQr(memberId, actor);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.paymentCode).toBe(first.paymentCode);
    expect(second.qrString).toBe(first.qrString);
    expect(await prisma.payment.count({ where: { idempotencyKey: `QRALL:${memberId}:${TOTAL_MINOR}` } })).toBe(1);
  });

  it("webhook confirm pays EVERY open invoice FIFO, one receipt, one balanced ledger post", async () => {
    const ledgerBefore = await prisma.ledgerTransaction.count({ where: { refType: "payment" } });

    const confirmed = await handlePaymentWebhook({ gatewayRef: payAllGatewayRef, status: "confirmed" }, "127.0.0.1");
    expect(confirmed).toMatchObject({ ok: true, ignored: false, paymentStatus: "confirmed" });
    if (!confirmed.ok || !confirmed.receiptCode) throw new Error("pay-all confirm failed");
    expect(confirmed.receiptCode).toMatch(/^RCP-\d{4}-\d{4}$/);

    const oldest = await prisma.invoice.findUniqueOrThrow({ where: { id: invOldestId } });
    const newest = await prisma.invoice.findUniqueOrThrow({ where: { id: invNewestId } });
    expect(oldest.status).toBe("paid");
    expect(oldest.amountDueMinor).toBe(0);
    expect(oldest.amountPaidMinor).toBe(OLDEST_AMOUNT_MINOR);
    expect(newest.status).toBe("paid");
    expect(newest.amountDueMinor).toBe(0);
    expect(newest.amountPaidMinor).toBe(NEWEST_AMOUNT_MINOR);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: payAllPaymentId } });
    expect(payment.status).toBe("confirmed");
    expect(payment.receiptCode).toBe(confirmed.receiptCode);

    const integrity = await ledgerIntegrity();
    expect(integrity.balanced).toBe(true);
    expect(await prisma.ledgerTransaction.count({ where: { refType: "payment" } })).toBe(ledgerBefore + 1);
  });

  it("no outstanding balance left → NOTHING_DUE, dues view is empty", async () => {
    const again = await createMemberPayAllQr(memberId, actor);
    expect(again).toMatchObject({ ok: false, code: "NOTHING_DUE" });

    const dues = await memberDuesForToken(memberId);
    expect(dues).not.toBeNull();
    if (!dues) return;
    expect(dues.member.id).toBe(memberId);
    expect(dues.totalDueMinor).toBe(0);
    expect(dues.invoices).toHaveLength(0);
  });

  it("new invoice AFTER settlement gets its own tidy pay-all bucket (fresh snapshot)", async () => {
    const property = await prisma.property.findFirstOrThrow({ where: { code: "BLR" } });
    const extra = await prisma.invoice.create({
      data: {
        code: `${PREFIX}-EXTRA`,
        propertyId: property.id,
        memberProfileId: memberId,
        status: "issued",
        issuedAt: new Date(),
        periodStart: new Date("2026-10-01"),
        periodEnd: new Date("2026-10-01"),
        dueDate: new Date("2026-10-01"),
        subtotalMinor: 2000,
        totalMinor: 2000,
        amountDueMinor: 2000,
        createdById: actor.id,
        items: { create: { name: "PayAll late fixture", kind: "one_time", qty: 1, unitMinor: 2000, amountMinor: 2000 } }
      }
    });

    const qr = await createMemberPayAllQr(memberId, actor);
    expect(qr.ok).toBe(true);
    if (!qr.ok) return;
    expect(qr.amountMinor).toBe(2000);
    // Deterministic key now snapshots the NEW bucket.
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: qr.paymentId } })).idempotencyKey).toBe(`QRALL:${memberId}:2000`);

    const gatewayRef = (await prisma.payment.findUniqueOrThrow({ where: { id: qr.paymentId } })).gatewayRef!;
    const confirmed = await handlePaymentWebhook({ gatewayRef, status: "confirmed" }, "127.0.0.1");
    expect(confirmed).toMatchObject({ ok: true, ignored: false });

    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: extra.id } });
    expect(paid.status).toBe("paid");
    expect(paid.amountDueMinor).toBe(0);
  });
});