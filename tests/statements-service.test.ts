/**
 * M24 Owner Statements service (§M24 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/statements-service.test.ts
 *
 * Self-driving: the fresh copy has no billing activity, so beforeAll bills
 * LSE-0001 (Building A = OWC-0001's building), confirms a payment backdated
 * into August and books an August pass-through expense — "mixed collections".
 * Flow: generate August statements → amounts reconcile to ledger allocations
 * → adjust a draft (reason mandatory, audited) → approve posts the accrual
 * (DR 3900 / CR 2200, refType statement_accrual) and files the PDF → payout
 * posts DR 2200 / CR 1200 (refType payout) and Owner Payable returns to its
 * pre-statement balance → P&L payout term = cash distributed → September
 * passthrough expense reduces the next month's payout. Ledger assertions are
 * baseline-tracked deltas (append-only ledger, shared copy).
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
import { confirmPayment, createPayment } from "@/lib/payments/service";
import { createExpense } from "@/lib/operations/expenses-service";
import {
  adjustStatement,
  approveStatement,
  generateStatements,
  payStatement
} from "@/lib/operations/statements-service";

let actor = { id: "", name: "" };
let propertyId = "";
let runnable = false;
const MONTH = "2026-08";

const accountDelta = async (code: string) => {
  const acc = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code }, select: { id: true } });
  const agg = await prisma.ledgerEntry.aggregate({ where: { accountId: acc.id }, _sum: { debit: true, credit: true } });
  return (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0); // debit-normal balance
};

const payableBalance = async () => {
  const acc = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "2200" }, select: { id: true } });
  const agg = await prisma.ledgerEntry.aggregate({ where: { accountId: acc.id }, _sum: { debit: true, credit: true } });
  return (agg._sum.credit ?? 0) - (agg._sum.debit ?? 0); // credit-normal liability
};

const dropPaymentTriggers = () => {
  return prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "payment_no_delete" ON "Payment"`)
    .then(() => prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "payment_allocation_no_delete" ON "PaymentAllocation"`))
    .then(() => prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "payment_allocation_no_update" ON "PaymentAllocation"`));
};

const recreatePaymentTriggers = () => {
  return prisma.$executeRawUnsafe(`CREATE TRIGGER "payment_no_delete" BEFORE DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION reject_append_only('Payments are append-only: refund or fail instead')`)
    .then(() => prisma.$executeRawUnsafe(`CREATE TRIGGER "payment_allocation_no_delete" BEFORE DELETE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION reject_append_only('Payment allocations are append-only')`))
    .then(() => prisma.$executeRawUnsafe(`CREATE TRIGGER "payment_allocation_no_update" BEFORE UPDATE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION reject_append_only('Payment allocations are immutable')`));
};

/// Purge payments + allocations on this DISPOSABLE copy (append-only rows:
/// the DB triggers must be dropped and recreated byte-identical). Invoice
/// deletes in other suites FK-restrict on leftover allocations, and vitest's
/// file order is not guaranteed — so this runs before AND after the suite.
const purgePayments = async () => {
  await dropPaymentTriggers();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await recreatePaymentTriggers();
};

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  propertyId = (await prisma.property.findUniqueOrThrow({ where: { code: "BLR" } })).id;

  await prisma.ownerStatement.deleteMany({}); // this suite owns its rows

  // Fresh copies carry no billing activity — drive August collections the
  // same way M09 does: bill pending periods, pay, backdate the confirmation
  // into August (append-only row; confirmedAt has no update trigger).
  await purgePayments();
  await prisma.creditNote.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();

  await generateInvoices(actor); // LSE-0001: Aug 15 start → prorated Aug + Sept invoices

  const owc1 = await prisma.ownerContract.findUniqueOrThrow({ where: { code: "OWC-0001" } });
  const lease = await prisma.lease.findFirstOrThrow({
    where: { status: "active", room: { floor: { buildingId: owc1.buildingId } } }
  });
  const augInvoice = await prisma.invoice.findFirstOrThrow({
    where: { leaseId: lease.id, status: { not: "void" }, periodStart: { gte: new Date(Date.UTC(2026, 7, 1)), lt: new Date(Date.UTC(2026, 8, 1)) } },
    orderBy: { periodStart: "asc" }
  });
  const pay = await createPayment(
    actor,
    {
      memberProfileId: lease.memberProfileId,
      method: "bank_transfer",
      amountMinor: augInvoice.amountDueMinor,
      allocations: [{ invoiceId: augInvoice.id, amountMinor: augInvoice.amountDueMinor }],
      idempotencyKey: "m24-august-collection"
    },
    "127.0.0.1"
  );
  if (!pay.ok) throw new Error(`fixture createPayment failed: ${pay.code}`);
  const confirmed = await confirmPayment(pay.paymentId, actor, { ip: "127.0.0.1" });
  if (!confirmed.ok) throw new Error(`fixture confirmPayment failed: ${confirmed.code}`);
  await prisma.payment.update({ where: { id: pay.paymentId }, data: { confirmedAt: new Date(Date.UTC(2026, 7, 20)) } });

  // Dedicated pass-through category: fixtures must not touch seeded
  // categories other suites assert budgets/P&L against (e.g. Internet & WiFi).
  const fixtureCat = await prisma.expenseCategory.upsert({
    where: { propertyId_name: { propertyId, name: "Owner passthrough (M24 fixture)" } },
    create: { propertyId, name: "Owner passthrough (M24 fixture)", accountCode: "5000", chargeTo: "passthrough" },
    update: { chargeTo: "passthrough" }
  });

  // August pass-through expense (below the 50_000 threshold → auto-approved;
  // kept small so gross − fee − passthrough stays positive; 2_500 on fresh copies).
  // Guarded: this suite purges payments/invoices/statements but NOT expenses
  // (append-only ledger), so re-runs must not double-book the fixture.
  const existingAug = await prisma.expense.findFirst({
    where: { categoryId: fixtureCat.id, expenseDate: { gte: new Date(Date.UTC(2026, 7, 1)), lt: new Date(Date.UTC(2026, 8, 1)) } }
  });
  if (!existingAug) {
    const exp = await createExpense(
      { propertyId, categoryId: fixtureCat.id, vendorName: "FibreNet", expenseDate: new Date(Date.UTC(2026, 7, 22)), amountMinor: 2_500, paidVia: "bank_transfer" },
      actor
    );
    if (!exp.ok) throw new Error(`fixture createExpense failed: ${exp.code}`);
  }
  runnable = true;
});

afterAll(async () => {
  await purgePayments(); // leave no allocation FKs for suites that run later
  await prisma.$disconnect();
});

describe("M24 owner statements flow", () => {
  let revenueShareStatementId = "";
  let fixedRentStatementId = "";

  it("generation: drafts per contract, idempotent; collections reconcile to ledger allocations", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await generateStatements({ month: MONTH, force: true }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    expect(r.data.created).toBe(2); // OWC-0001 (REVENUE_SHARE) + OWC-0002 (FIXED_RENT)

    const again = await generateStatements({ month: MONTH, force: true }, actor);
    expect(again.ok).toBe(true);
    if (!again.ok || !again.data) return;
    expect(again.data.created).toBe(0); // idempotent per contract+month
    expect(again.data.skippedExisting).toBe(2);

    const owc1 = await prisma.ownerContract.findUniqueOrThrow({ where: { code: "OWC-0001" } });
    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { contractId_month: { contractId: owc1.id, month: MONTH } } });
    revenueShareStatementId = st.id;
    expect(st.code).toMatch(/^STM-\d{4}-\d{4}$/);

    // §M24 acceptance: collections line reconciles exactly to confirmed
    // payment allocations against the contract's building in the month.
    const alloc = await prisma.paymentAllocation.aggregate({
      where: {
        payment: { status: "confirmed", confirmedAt: { gte: new Date(Date.UTC(2026, 7, 1)), lt: new Date(Date.UTC(2026, 8, 1)) } },
        invoice: { lease: { room: { floor: { buildingId: st.buildingId } } } }
      },
      _sum: { amountMinor: true }
    });
    expect(st.collectedMinor).toBe(alloc._sum.amountMinor ?? 0);
    expect(st.collectedMinor).toBeGreaterThan(0);

    // formula: collected × 60% − 10% fee − passthrough (fixture expense)
    expect(st.grossShareMinor).toBe(Math.round((st.collectedMinor * 60) / 100));
    expect(st.managementFeeMinor).toBe(Math.round((st.grossShareMinor * 10) / 100));
    // expenses are attributed property→first contracted building (v1: one
    // contract per property), so the register total for BLR must equal the line
    const augPassthrough = await prisma.expense.aggregate({
      where: {
        status: "approved",
        expenseDate: { gte: new Date(Date.UTC(2026, 7, 1)), lt: new Date(Date.UTC(2026, 8, 1)) },
        category: { chargeTo: "passthrough" },
        propertyId
      },
      _sum: { amountMinor: true }
    });
    expect(st.passthroughMinor).toBe(augPassthrough._sum.amountMinor ?? 0);
    expect(st.ownerMaintenanceMinor).toBe(0);
    expect(st.netMinor).toBe(st.grossShareMinor - st.managementFeeMinor - st.passthroughMinor);
    expect(st.status).toBe("draft");

    // fixed-rent contract: gross = master rent regardless of collections
    const owc2 = await prisma.ownerContract.findUniqueOrThrow({ where: { code: "OWC-0002" } });
    const st2 = await prisma.ownerStatement.findUniqueOrThrow({ where: { contractId_month: { contractId: owc2.id, month: MONTH } } });
    expect(st2.grossShareMinor).toBe(65_000); // fixed master rent
    expect(st2.managementFeeMinor).toBe(0);
    expect(st2.collectedMinor).toBe(0); // Villa Main has no leases in the seed
    fixedRentStatementId = st2.id;
  });

  it("adjustment: reason mandatory, audited, net recomputed (drafts only)", async (ctx) => {
    if (!runnable) ctx.skip();
    const noReason = await adjustStatement(revenueShareStatementId, { adjustmentsMinor: -5_000, reason: "   " }, actor);
    expect(noReason).toMatchObject({ ok: false, code: "REASON_REQUIRED" });

    const r = await adjustStatement(revenueShareStatementId, { adjustmentsMinor: -5_000, reason: "utility reimbursement correction" }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: revenueShareStatementId } });
    expect(st.adjustmentsMinor).toBe(-5_000);
    expect(st.netMinor).toBe(st.grossShareMinor - st.managementFeeMinor - st.passthroughMinor - 5_000);
    expect(st.netMinor).toBeGreaterThan(0); // fixture sized so approval stays possible
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "statement.adjusted", entityId: revenueShareStatementId } });
    expect(JSON.stringify(audit.after)).toContain("utility reimbursement correction");
  });

  it("approval posts the accrual DR 3900 / CR 2200 (statement_accrual) and files the PDF", async (ctx) => {
    if (!runnable) ctx.skip();
    const distBefore = await accountDelta("3900");
    const st0 = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: revenueShareStatementId } });
    const payableBefore = await payableBalance();

    const r = await approveStatement(revenueShareStatementId, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: revenueShareStatementId } });
    expect(st.status).toBe("approved");
    expect(st.approvedAt).toBeTruthy();
    expect(st.ledgerTxId).toBeTruthy();
    expect(st.statementDocId).toBeTruthy(); // PDF auto-filed (§M24 → M17)

    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: st.ledgerTxId! }, include: { entries: { include: { account: true } } } });
    expect(tx.refType).toBe("statement_accrual");
    expect(tx.totalDebit).toBe(st.netMinor);
    const byCode = new Map(tx.entries.map((e) => [e.account.code, e]));
    expect(byCode.get("3900")?.debit).toBe(st.netMinor);
    expect(byCode.get("2200")?.credit).toBe(st.netMinor);
    expect(await accountDelta("3900")).toBe(distBefore + st.netMinor); // EQUITY debit
    expect(await payableBalance()).toBe(payableBefore + st.netMinor); // liability grows

    const again = await approveStatement(revenueShareStatementId, actor);
    expect(again).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    void st0;
  });

  it("payout posts DR 2200 / CR 1200 (payout) and Owner Payable returns to baseline", async (ctx) => {
    if (!runnable) ctx.skip();
    const payableBefore = await payableBalance();
    const r = await payStatement(revenueShareStatementId, { method: "bank_transfer" }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;

    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: revenueShareStatementId } });
    expect(st.status).toBe("paid");
    expect(st.paidVia).toBe("bank_transfer");
    expect(st.paidAt).toBeTruthy();

    const tx = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "payout", refId: st.id }, include: { entries: { include: { account: true } } } });
    const byCode = new Map(tx.entries.map((e) => [e.account.code, e]));
    expect(byCode.get("2200")?.debit).toBe(st.netMinor);
    expect(byCode.get("1200")?.credit).toBe(st.netMinor);

    // §M24 acceptance: Owner Payable is back to its pre-statement balance.
    expect(r.data.ownerPayableBalanceMinor).toBe(payableBefore - st.netMinor);

    const again = await payStatement(revenueShareStatementId, { method: "cash" }, actor);
    expect(again).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("pay requires approval; draft statements cannot be paid", async (ctx) => {
    if (!runnable) ctx.skip();
    const draft = await payStatement(fixedRentStatementId, { method: "cash" }, actor);
    expect(draft).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    const approved = await approveStatement(fixedRentStatementId, actor);
    expect(approved.ok).toBe(true);
    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: fixedRentStatementId } });
    expect(st.status).toBe("approved");
  });

  it("P&L payout term (Σ debits, refType payout) equals the cash distributed", async (ctx) => {
    if (!runnable) ctx.skip();
    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: revenueShareStatementId } });
    const payoutTxs = await prisma.ledgerTransaction.findMany({ where: { refType: "payout", refId: st.id, reversalOfId: null } });
    expect(payoutTxs).toHaveLength(1);
    expect(payoutTxs[0]!.totalDebit).toBe(st.netMinor);
  });

  it("September: pass-through expense flows into the next statement", async (ctx) => {
    if (!runnable) ctx.skip();
    const fixtureCat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Owner passthrough (M24 fixture)" } } });
    const existingSep = await prisma.expense.findFirst({
      where: { categoryId: fixtureCat.id, expenseDate: { gte: new Date(Date.UTC(2026, 8, 1)), lt: new Date(Date.UTC(2026, 9, 1)) } }
    });
    if (!existingSep) {
      const opBefore = await accountDelta("5000");
      const exp = await createExpense(
        { propertyId, categoryId: fixtureCat.id, vendorName: "FibreNet", expenseDate: new Date(Date.UTC(2026, 8, 2)), amountMinor: 30_000, paidVia: "bank_transfer" },
        actor
      );
      expect(exp.ok).toBe(true);
      expect(await accountDelta("5000")).toBe(opBefore + 30_000);
    }

    const r = await generateStatements({ month: "2026-09", force: true }, actor);
    expect(r.ok).toBe(true);
    const owc1 = await prisma.ownerContract.findUniqueOrThrow({ where: { code: "OWC-0001" } });
    const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { contractId_month: { contractId: owc1.id, month: "2026-09" } } });
    const sepPassthrough = await prisma.expense.aggregate({
      where: {
        status: "approved",
        expenseDate: { gte: new Date(Date.UTC(2026, 8, 1)), lt: new Date(Date.UTC(2026, 9, 1)) },
        category: { chargeTo: "passthrough" },
        propertyId
      },
      _sum: { amountMinor: true }
    });
    expect(st.passthroughMinor).toBe(sepPassthrough._sum.amountMinor ?? 0);
    expect(st.passthroughMinor).toBeGreaterThan(0);
    expect(st.collectedMinor).toBeGreaterThanOrEqual(0);
    expect(st.netMinor).toBe(st.grossShareMinor - st.managementFeeMinor - st.passthroughMinor - st.ownerMaintenanceMinor + st.adjustmentsMinor);

    // a negative net (passthrough > share) cannot be accrued — guarded, not a raw UNBALANCED throw
    const negative = await approveStatement(st.id, actor);
    expect(negative).toMatchObject({ ok: false, code: "NOTHING_TO_ACCRUE" });
  });
});
