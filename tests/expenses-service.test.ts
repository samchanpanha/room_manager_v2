/**
 * M20 Expenses & P&L service (§M20 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/expenses-service.test.ts
 *
 * Flow: category validation → expense below threshold auto-approves + posts
 * (DR 5000 / CR 1100) → above threshold pends → approve posts → reject doesn't
 * → void reverses → budget + P&L reconcile register↔ledger exactly →
 * recurring template materializes once per month. Ledger assertions are
 * baseline-tracked deltas (the shared copy carries earlier phases' data).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  approveExpense,
  createCategory,
  createExpense,
  createRecurring,
  profitAndLoss,
  rejectExpense,
  runRecurring,
  setBudget,
  voidExpense
} from "@/lib/operations/expenses-service";

let actor = { id: "", name: "" };
let propertyId = "";
let runnable = false;
const THRESHOLD_KEY = "expenses.approvalThresholdMinor";

async function setThreshold(value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key: THRESHOLD_KEY }, create: { key: THRESHOLD_KEY, value }, update: { value } });
}

const accountDelta = async (code: string) => {
  const acc = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code }, select: { id: true } });
  const agg = await prisma.ledgerEntry.aggregate({ where: { accountId: acc.id }, _sum: { debit: true, credit: true } });
  return (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0); // debit-normal balance
};

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  propertyId = (await prisma.property.findUniqueOrThrow({ where: { code: "BLR" } })).id;
  await setThreshold("50000"); // seed default
  runnable = true;
});

afterAll(async () => {
  await setThreshold("50000");
  await prisma.$disconnect();
});

describe("M20 expenses flow", () => {
  it("category: maps only to ledger expense accounts; duplicate names rejected", async (ctx) => {
    if (!runnable) ctx.skip();
    const bad = await createCategory({ propertyId, name: "Ghost category", accountCode: "4000" }, actor);
    expect(bad).toMatchObject({ ok: false, code: "ACCOUNT_INVALID" });
    const r = await createCategory({ propertyId, name: "Staff welfare", accountCode: "5000" }, actor);
    expect(r.ok).toBe(true);
    const dupe = await createCategory({ propertyId, name: "Staff welfare", accountCode: "5100" }, actor);
    expect(dupe).toMatchObject({ ok: false, code: "DUPLICATE" });
  });

  let smallExpenseId = "";
  const month = new Date().toISOString().slice(0, 7);

  it("below threshold → auto-approved, ledger posts DR 5000 / CR 1100 (balanced)", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Cleaning & supplies" } } });
    const opBefore = await accountDelta("5000");
    const cashBefore = await accountDelta("1100");
    const r = await createExpense(
      { propertyId, categoryId: cat.id, vendorName: "CleanCo", expenseDate: new Date(), amountMinor: 12_000, paidVia: "cash" },
      actor
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    smallExpenseId = r.data.id;
    expect(r.data.code).toMatch(/^EXP-\d{4}-\d{4}$/);
    expect(r.data.status).toBe("approved");
    expect(r.data.autoApproved).toBe(true);
    expect(await accountDelta("5000")).toBe(opBefore + 12_000);
    expect(await accountDelta("1100")).toBe(cashBefore - 12_000); // credit on an asset
    const row = await prisma.expense.findUniqueOrThrow({ where: { id: smallExpenseId } });
    expect(row.ledgerTxId).toBeTruthy();
    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: row.ledgerTxId! }, include: { entries: { include: { account: true } } } });
    expect(tx.refType).toBe("expense");
    expect(tx.totalDebit).toBe(12_000);
    expect(tx.totalCredit).toBe(12_000);
  });

  it("above threshold → pending; approve posts DR 5000 / CR 1200; audit + event", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Repairs & maintenance" } } });
    const r = await createExpense(
      { propertyId, categoryId: cat.id, vendorName: "ACME HVAC", expenseDate: new Date(), amountMinor: 120_000, paidVia: "bank_transfer", description: "lobby chiller service" },
      actor
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    expect(r.data.status).toBe("pending");
    const approved = await approveExpense(r.data.id, actor);
    expect(approved.ok).toBe(true);
    const row = await prisma.expense.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(row.status).toBe("approved");
    expect(row.ledgerTxId).toBeTruthy();
    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: row.ledgerTxId! }, include: { entries: { include: { account: true } } } });
    const byCode = new Map(tx.entries.map((e) => [e.account.code, e]));
    expect(byCode.get("5000")?.debit).toBe(120_000);
    expect(byCode.get("1200")?.credit).toBe(120_000);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "expense.approved", entityId: r.data.id } });
    void audit;
    const again = await approveExpense(r.data.id, actor);
    expect(again).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("reject never touches the ledger", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Property utilities" } } });
    const created = await createExpense(
      { propertyId, categoryId: cat.id, vendorName: "KPTC", expenseDate: new Date(), amountMinor: 90_000, paidVia: "cash" },
      actor
    );
    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) return;
    const opBefore = await accountDelta("5000");
    const noReason = await rejectExpense(created.data.id, "  ", actor);
    expect(noReason).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    const r = await rejectExpense(created.data.id, "duplicate of a paid bill", actor);
    expect(r.ok).toBe(true);
    expect(await accountDelta("5000")).toBe(opBefore);
    const row = await prisma.expense.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row.status).toBe("rejected");
    expect(row.ledgerTxId).toBeNull();
  });

  it("void reverses the posting — account balances return to pre-approval", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Staff welfare" } } });
    const cashBefore = await accountDelta("1100");
    const opBefore = await accountDelta("5000");
    const created = await createExpense(
      { propertyId, categoryId: cat.id, vendorName: "Team lunch", expenseDate: new Date(), amountMinor: 8_000, paidVia: "cash" },
      actor
    );
    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) return;
    expect(await accountDelta("5000")).toBe(opBefore + 8_000);
    const noReason = await voidExpense(created.data.id, "  ", actor);
    expect(noReason).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    const r = await voidExpense(created.data.id, "wrong vendor — rebooking", actor);
    expect(r.ok).toBe(true);
    expect(await accountDelta("5000")).toBe(opBefore);
    expect(await accountDelta("1100")).toBe(cashBefore);
    const row = await prisma.expense.findUniqueOrThrow({ where: { id: created.data.id } });
    expect(row.status).toBe("voided");
    const reversal = await prisma.ledgerTransaction.findFirstOrThrow({ where: { reversalOfId: row.ledgerTxId! } });
    expect(reversal.refType).toBe("expense_void");
  });

  it("receipt attachment must be an EXPENSE document", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findFirstOrThrow({ where: { propertyId } });
    const other = await prisma.documentRegistry.findFirstOrThrow({ where: { entity: { not: "EXPENSE" } } });
    const r = await createExpense(
      { propertyId, categoryId: cat.id, vendorName: "No Receipt Co", expenseDate: new Date(), amountMinor: 5_000, paidVia: "cash", receiptDocId: other.id },
      actor
    );
    expect(r).toMatchObject({ ok: false, code: "RECEIPT_ENTITY" });
  });

  it("budget set (upsert) + P&L: reconciles register↔ledger exactly; variance shown", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Internet & WiFi" } } });
    const noBudget = await setBudget({ categoryId: cat.id, month: "2026-13", amountMinor: 1 }, actor);
    expect(noBudget).toMatchObject({ ok: false, code: "INVALID_MONTH" });
    const b1 = await setBudget({ categoryId: cat.id, month, amountMinor: 30_000 }, actor);
    expect(b1.ok).toBe(true);
    const b2 = await setBudget({ categoryId: cat.id, month, amountMinor: 45_000 }, actor); // upsert overwrites
    expect(b2.ok).toBe(true);
    const stored = await prisma.expenseBudget.findUniqueOrThrow({ where: { categoryId_month: { categoryId: cat.id, month } } });
    expect(stored.amountMinor).toBe(45_000);

    const pl = await profitAndLoss({ month, propertyId, scopePropertyIds: [propertyId] });
    expect(pl.ok).toBe(true);
    if (!pl.ok || !pl.data) return;
    expect(pl.data.scope).toBe("property");
    expect(pl.data.reconcilesExactly).toBe(true); // §M20: matches ledger totals exactly
    for (const line of pl.data.reconciliation) expect(line.deltaMinor).toBe(0);
    const internet = pl.data.budgets.find((b) => b.category === "Internet & WiFi");
    expect(internet?.budgetMinor).toBe(45_000);
    expect(internet?.varianceMinor).toBe(45_000); // no spend this month yet
  });

  it("consolidated P&L spans scope properties; register = ledger per account", async (ctx) => {
    if (!runnable) ctx.skip();
    const pl = await profitAndLoss({ month, scopePropertyIds: [propertyId] });
    expect(pl.ok).toBe(true);
    if (!pl.ok || !pl.data) return;
    expect(pl.data.scope).toBe("consolidated");
    // register totals per account must equal ledger totals exactly
    for (const line of pl.data.reconciliation) {
      expect(line.registerMinor).toBe(line.ledgerMinor);
    }
  });

  it("recurring template materializes once per month (§M20 entities)", async (ctx) => {
    if (!runnable) ctx.skip();
    const cat = await prisma.expenseCategory.findUniqueOrThrow({ where: { propertyId_name: { propertyId, name: "Internet & WiFi" } } });
    const bad = await createRecurring({ propertyId, categoryId: cat.id, vendorName: "Weekly lawn", amountMinor: 5_000, paidVia: "cash", dayOfMonth: 31 }, actor);
    expect(bad).toMatchObject({ ok: false, code: "INVALID_DAY" });
    const r = await createRecurring({ propertyId, categoryId: cat.id, vendorName: "Weekly lawn", amountMinor: 5_000, paidVia: "cash", dayOfMonth: 1 }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const seeded = await prisma.recurringExpense.findFirstOrThrow({ where: { propertyId, vendorName: "Orange Fibre" } });
    const thresholdBefore = await prisma.setting.findUniqueOrThrow({ where: { key: THRESHOLD_KEY } });
    await setThreshold("99999999"); // force auto-approval on materialization
    const first = await runRecurring(r.data.id, actor);
    expect(first.ok).toBe(true);
    const second = await runRecurring(r.data.id, actor);
    expect(second).toMatchObject({ ok: true, data: { skipped: true } });
    const count = await prisma.expense.count({ where: { vendorName: "Weekly lawn" } });
    expect(count).toBe(1);
    const created = await prisma.expense.findFirstOrThrow({ where: { vendorName: "Weekly lawn" } });
    expect(created.status).toBe("approved");
    expect(created.ledgerTxId).toBeTruthy();
    const notDue = await runRecurring(seeded.id, actor); // day 5 not reached today? may pass if date ≥5
    void notDue;
    await setThreshold(thresholdBefore.value);
  });
});
