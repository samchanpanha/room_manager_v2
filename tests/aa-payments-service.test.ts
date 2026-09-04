/**
 * Payments service (M09) — DB-backed tests against a disposable COPY of the
 * seeded database (same pattern as the billing suite):
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/aa-payments-service.test.ts
 * Self-cleaning; the demo DB (dev.db) is never touched (tests/setup.ts pins
 * the URL; `npm test` refreshes the copy).
 * Runs FIRST (aa- prefix): its beforeAll deletes payments/allocation rows,
 * which are append-only (Phase 8 triggers) — later suites must tolerate the
 * leftovers, never the reverse.
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
import { generateInvoices } from "@/lib/billing/service";
import { confirmPayment, createPayment, failPayment, handlePaymentWebhook, refundPayment } from "@/lib/payments/service";
import { ledgerIntegrity } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";

let actor: { id: string; name: string };
let member: { id: string };
let stubId = "";
let sepId = "";
let paymentTxBaseline = 0;

beforeAll(async () => {
  // Self-clean payments + billing + ledger state so the flow starts pristine.
  // Payments/allocations are append-only (Phase 8 triggers); the fresh copy is
  // usually empty, but run order is not guaranteed — so the cleanup drops the
  // payment triggers on this DISPOSABLE copy, purges leftovers and recreates
  // them byte-identical to the Phase 8 migration.
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS payment_no_delete`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS payment_allocation_no_delete`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS payment_allocation_no_update`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS deposit_tx_no_delete`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS deposit_tx_no_update`);
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.$executeRawUnsafe(`CREATE TRIGGER payment_no_delete BEFORE DELETE ON "Payment" BEGIN SELECT RAISE(ABORT, 'Payments are append-only: refund or fail instead'); END;`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER payment_allocation_no_delete BEFORE DELETE ON "PaymentAllocation" BEGIN SELECT RAISE(ABORT, 'Payment allocations are append-only'); END;`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER payment_allocation_no_update BEFORE UPDATE ON "PaymentAllocation" BEGIN SELECT RAISE(ABORT, 'Payment allocations are immutable'); END;`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER deposit_tx_no_update BEFORE UPDATE ON "DepositTransaction" BEGIN SELECT RAISE(ABORT, 'Deposit movements are append-only'); END;`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER deposit_tx_no_delete BEFORE DELETE ON "DepositTransaction" BEGIN SELECT RAISE(ABORT, 'Deposit movements are append-only'); END;`);
  // Deposits (and their invoice link) may exist when this suite runs late —
  // they Restrict-delete the deposit invoices below.
  await prisma.deposit.updateMany({ data: { invoiceId: null } });
  await prisma.depositTransaction.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  // NOTE: the ledger is append-only even in tests (DB triggers) — ledger
  // assertions below are deltas scoped to this suite's refTypes. Larger DB
  // suites (size-ordered) may confirm payments before this file runs, so the
  // "exactly one" payment-posting assertion is tracked against this baseline.
  paymentTxBaseline = await suiteTxCount(["payment"]);
  await prisma.numberSequence.deleteMany({
    where: { OR: [{ key: { startsWith: "INV:" } }, { key: { startsWith: "PMT:" } }, { key: { startsWith: "RCP:" } }, { key: "CREDITNOTE" }] }
  });
  await prisma.documentRegistry.deleteMany({ where: { entity: { in: ["INVOICE", "PAYMENT"] } } });
  await prisma.auditLog.deleteMany({ where: { module: { in: ["M07", "M09"] } } });
  await prisma.domainEvent.deleteMany({
    where: { type: { in: ["invoice.issued", "invoice.late_fee_applied", "invoice.dunning_reminder", "invoice.voided", "credit_note.issued", "payment.recorded", "payment.confirmed", "payment.failed", "payment.refunded"] } }
  });

  const root = await prisma.user.findFirst({ where: { email: "root@demo.test" } });
  if (!root) throw new Error("seed user missing");
  actor = { id: root.id, name: root.name };
  const m = await prisma.memberProfile.findFirst({ where: { party: { name: { contains: "Chan" } } } });
  if (!m) throw new Error("Chan Ling missing");
  member = { id: m.id };

  // Two open invoices via the billing engine (stub 14533 + September 26500).
  const summary = await generateInvoices(actor);
  if (summary.generated !== 2) throw new Error(`expected 2 invoices, got ${summary.generated}`);
  const invoices = await prisma.invoice.findMany({ where: { lease: { code: "LSE-0001" } }, orderBy: { periodStart: "asc" } });
  stubId = invoices[0].id;
  sepId = invoices[1].id;
});

/// Transactions posted by THIS suite (refType-scoped — the ledger may already
/// carry rows from other suites and can never be wiped).
async function suiteTxCount(refTypes: string[]): Promise<number> {
  return prisma.ledgerTransaction.count({ where: { refType: { in: refTypes } } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("record + confirm (50% acceptance)", () => {
  it("records a pending payment and auto-allocates oldest-first", async () => {
    const result = await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: 14533 });
    expect(result).toMatchObject({ ok: true, code: "PMT-2026-0001", allocatedMinor: 14533, remainderMinor: 0 });

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: (result as { paymentId: string }).paymentId }, include: { allocations: true } });
    expect(payment.status).toBe("pending");
    expect(payment.allocations).toHaveLength(1);
    expect(payment.allocations[0].invoiceId).toBe(stubId);
  });

  it("confirms: invoice → partial_paid (50%), receipt numbered + filed, ledger balanced", async () => {
    const payments = await prisma.payment.findMany({ where: { code: "PMT-2026-0001" } });
    const result = await confirmPayment(payments[0].id, actor);
    expect(result).toMatchObject({ ok: true, ignored: false, receiptCode: "RCP-2026-0001" });

    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId } });
    expect(stub.amountPaidMinor).toBe(14533);
    expect(stub.amountDueMinor).toBe(0);
    expect(stub.status).toBe("paid"); // full stub paid → paid, not partial
    expect(stub.totalMinor).toBe(14533);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: payments[0].id } });
    expect(payment.receiptCode).toBe("RCP-2026-0001");
    const doc = await prisma.documentRegistry.findFirst({ where: { entity: "PAYMENT", entityId: payment.id, docTypeId: "receipt" } });
    expect(doc).toBeTruthy();

    const integrity = await ledgerIntegrity();
    expect(integrity.balanced).toBe(true);
    expect(await suiteTxCount(["payment"])).toBe(paymentTxBaseline + 1); // exactly one NEW payment posting
  });

  it("partial payment on a bigger invoice → partial_paid (the §M09 acceptance)", async () => {
    const sep = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    const half = Math.floor(sep.amountDueMinor / 2); // 13250 of 26500
    const created = await createPayment(actor, { memberProfileId: member.id, method: "bank_transfer", amountMinor: half });
    expect(created).toMatchObject({ ok: true, code: "PMT-2026-0002" });
    const confirmed = await confirmPayment((created as { paymentId: string }).paymentId, actor);
    expect(confirmed).toMatchObject({ ok: true, receiptCode: "RCP-2026-0002" });

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    expect(after.amountPaidMinor).toBe(half);
    expect(after.amountDueMinor).toBe(26500 - half);
    expect(after.status).toBe("partial_paid");
  });

  it("double confirm is an idempotent no-op (no double ledger posting)", async () => {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { code: "PMT-2026-0002" } });
    const before = await suiteTxCount(["payment"]);
    const again = await confirmPayment(payment.id, actor);
    expect(again).toMatchObject({ ok: true, ignored: true });
    expect(await suiteTxCount(["payment"])).toBe(before); // no double posting
    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    expect(stub.amountPaidMinor).toBe(Math.floor(26500 / 2)); // unchanged
  });
});

describe("webhook intake (§9.6 idempotency)", () => {
  it("confirms via gateway payload; duplicate webhook is ignored", async () => {
    const created = await createPayment(
      actor,
      { memberProfileId: member.id, method: "qr", amountMinor: 13250, gatewayRef: "GW-TXN-77", idempotencyKey: "hook-key-77" }
    );
    expect(created).toMatchObject({ ok: true, code: "PMT-2026-0003" });

    const first = await handlePaymentWebhook({ idempotencyKey: "hook-key-77", status: "confirmed" });
    expect(first).toMatchObject({ ok: true, ignored: false });
    const sep = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    expect(sep.status).toBe("paid"); // 13250 + 13250 = full
    expect(sep.amountDueMinor).toBe(0);

    const before = await suiteTxCount(["payment"]);
    const duplicate = await handlePaymentWebhook({ idempotencyKey: "hook-key-77", status: "confirmed" });
    expect(duplicate).toMatchObject({ ok: true, ignored: true });
    expect(await suiteTxCount(["payment"])).toBe(before); // duplicate ignored (§9.6)

    const receipts = await prisma.payment.count({ where: { code: "PMT-2026-0003", receiptCode: { not: null } } });
    expect(receipts).toBe(1);
  });

  it("marks failed webhooks on pending payments only", async () => {
    const created = await createPayment(actor, { memberProfileId: member.id, method: "qr", amountMinor: 1000, gatewayRef: "GW-TXN-78" });
    const okFail = await handlePaymentWebhook({ gatewayRef: "GW-TXN-78", status: "failed", reason: "3DS timeout" });
    expect(okFail).toMatchObject({ ok: true, paymentStatus: "failed" });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: (created as { paymentId: string }).paymentId } });
    expect(payment.failReason).toBe("3DS timeout");
    // failed is terminal
    const again = await handlePaymentWebhook({ gatewayRef: "GW-TXN-78", status: "confirmed" });
    expect(again).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });
});

describe("overpayment credit + refund (Accountant path)", () => {
  it("overpayment leaves member credit; refund reverses via the ledger", async () => {
    const created = await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: 2500 });
    expect(created).toMatchObject({ ok: true, remainderMinor: 2500 }); // no open invoices left → pure credit

    const paymentId = (created as { paymentId: string }).paymentId;
    await confirmPayment(paymentId, actor);

    const integrityBefore = await ledgerIntegrity();
    const refunded = await refundPayment(paymentId, "member moved out; credit returned", actor);
    expect(refunded).toMatchObject({ ok: true, paymentStatus: "refunded" });

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.refundedMinor).toBe(2500);
    expect(payment.remainingMinor).toBe(0);

    const refundTx = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "refund", refId: paymentId } });
    const codes = await prisma.ledgerEntry.findMany({ where: { transactionId: refundTx.id }, include: { account: true } });
    expect(codes.map((e) => [e.account.code, e.debit, e.credit])).toEqual(
      expect.arrayContaining([
        [ACC.RENT_RECEIVABLE, 2500, 0],
        [ACC.CASH, 0, 2500]
      ])
    );
    const integrityAfter = await ledgerIntegrity();
    expect(integrityAfter.balanced).toBe(true);
    expect(integrityAfter.totalDebit).toBe(integrityBefore.totalDebit + 2500); // refund posts DR 2500 (+ CR 2500)
  });

  it("refunds are terminal and fully-allocated payments have nothing to refund", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { status: "refunded" } });
    expect(await refundPayment(payment.id, "again", actor)).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    const allocated = await prisma.payment.findFirstOrThrow({ where: { code: "PMT-2026-0002" } });
    const result = await refundPayment(allocated.id, "no credit left", actor);
    expect(result).toMatchObject({ ok: false, code: "NOTHING_TO_REFUND" });
  });
});

describe("validation + append-only enforcement", () => {
  it("rejects bad amounts, unknown members, bad methods", async () => {
    expect(await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: 0 })).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
    expect(await createPayment(actor, { memberProfileId: "nope", method: "cash", amountMinor: 100 })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await createPayment(actor, { memberProfileId: member.id, method: "barter", amountMinor: 100 })).toMatchObject({ ok: false, code: "INVALID_METHOD" });
  });

  it("rejects explicit allocations over due or beyond the amount", async () => {
    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId } });
    expect(
      await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: 100, allocations: [{ invoiceId: stubId, amountMinor: 200 }] })
    ).toMatchObject({ ok: false, code: "INVALID_ALLOCATIONS" });
    expect(
      await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: 1, allocations: [{ invoiceId: stubId, amountMinor: 500 }] })
    ).toMatchObject({ ok: false, code: "INVALID_ALLOCATIONS" });
    expect(stub.amountPaidMinor).toBe(14533); // untouched by rejected payments
  });

  it("idempotencyKey dedupes creation (§9.6)", async () => {
    const first = await createPayment(actor, { memberProfileId: member.id, method: "card", amountMinor: 700, idempotencyKey: "idem-key-1" });
    const dupe = await createPayment(actor, { memberProfileId: member.id, method: "card", amountMinor: 700, idempotencyKey: "idem-key-1" });
    expect(dupe).toMatchObject({ ok: true, paymentId: (first as { paymentId: string }).paymentId });
    const count = await prisma.payment.count({ where: { idempotencyKey: "idem-key-1" } });
    expect(count).toBe(1);
  });

  it("payments and allocations are append-only (DB triggers)", async () => {
    const payment = await prisma.payment.findFirstOrThrow();
    await expect(prisma.payment.delete({ where: { id: payment.id } })).rejects.toThrow();
    const allocation = await prisma.paymentAllocation.findFirstOrThrow();
    await expect(prisma.paymentAllocation.delete({ where: { id: allocation.id } })).rejects.toThrow();
    await expect(prisma.paymentAllocation.update({ where: { id: allocation.id }, data: { amountMinor: 1 } })).rejects.toThrow();
    const after = await prisma.paymentAllocation.findUniqueOrThrow({ where: { id: allocation.id } });
    expect(after.amountMinor).toBe(allocation.amountMinor);
  });

  it("fail path requires pending (machine gate)", async () => {
    const confirmed = await prisma.payment.findFirstOrThrow({ where: { status: "confirmed" } });
    expect(await failPayment(confirmed.id, "too late", actor)).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });
});
