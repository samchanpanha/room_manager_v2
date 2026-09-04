/// M20 Expenses & P&L service — categories mapped to ledger expense accounts,
/// expenses with mandatory-approval-above-threshold (auto-approve below), the
/// receipt attachment (M17 entity EXPENSE), void-via-reversal, recurring
/// templates, and the P&L report that reconciles register↔ledger exactly.
/// Approval gate = GLOBAL M20:update (Accountant+), mirroring the deposit
/// refund gate (§M10); recording = M20:create in property scope (Staff W).
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { postTransaction, reverseTransaction } from "@/lib/ledger/service";
import type { ActorCtx } from "@/lib/payments/service";
import {
  buildPL,
  DEFAULT_APPROVAL_THRESHOLD_MINOR,
  EXPENSE_ACCOUNT_CODES,
  PAID_VIA_ACCOUNT,
  plMonthRange,
  rollupLedger,
  type ExpenseAccountCode,
  type ExpensePaidVia,
  type LedgerEntryRow,
  type PLReport
} from "./pl-math";

interface Result<T> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
}

const HEAVY_TX = { maxWait: 5_000, timeout: 20_000 } as const;

const EXPENSE_ACCOUNT_SET = new Set<string>(EXPENSE_ACCOUNT_CODES);

function isExpenseAccount(code: string): code is ExpenseAccountCode {
  return EXPENSE_ACCOUNT_SET.has(code);
}

async function approvalThresholdMinor(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: "expenses.approvalThresholdMinor" } });
  const v = s ? Number(s.value) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_APPROVAL_THRESHOLD_MINOR;
}

// ── categories ───────────────────────────────────────────────────────────────

export async function createCategory(
  input: { propertyId: string; name: string; accountCode: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  if (!input.name.trim()) return { ok: false, code: "NAME_REQUIRED", message: "Category name is required" };
  if (!isExpenseAccount(input.accountCode)) {
    return { ok: false, code: "ACCOUNT_INVALID", message: "accountCode must be a ledger expense account (5000 or 5100)" };
  }
  const property = await prisma.property.findUnique({ where: { id: input.propertyId }, select: { id: true } });
  if (!property) return { ok: false, code: "NOT_FOUND", message: "Property not found" };
  const dupe = await prisma.expenseCategory.findUnique({
    where: { propertyId_name: { propertyId: input.propertyId, name: input.name.trim() } }
  });
  if (dupe) return { ok: false, code: "DUPLICATE", message: "A category with this name already exists" };
  const cat = await prisma.expenseCategory.create({
    data: { propertyId: input.propertyId, name: input.name.trim(), accountCode: input.accountCode }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: "expense.category_created",
    entityType: "expense_category",
    entityId: cat.id,
    summary: `Category "${cat.name}" → account ${cat.accountCode}`,
    propertyId: input.propertyId,
    ip
  });
  return { ok: true, data: { id: cat.id } };
}

export async function listCategories(propertyId: string) {
  return prisma.expenseCategory.findMany({
    where: { propertyId, isActive: true },
    orderBy: { name: "asc" },
    include: { budgets: { orderBy: { month: "desc" }, take: 1 } }
  });
}

// ── budgets (§M20 per property/category/month) ───────────────────────────────

export async function setBudget(
  input: { categoryId: string; month: string; amountMinor: number },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  if (!plMonthRange(input.month)) return { ok: false, code: "INVALID_MONTH", message: "month must be a valid YYYY-MM" };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "amountMinor must be a non-negative integer" };
  }
  const cat = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId } });
  if (!cat) return { ok: false, code: "NOT_FOUND", message: "Category not found" };
  const budget = await prisma.expenseBudget.upsert({
    where: { categoryId_month: { categoryId: cat.id, month: input.month } },
    create: { categoryId: cat.id, month: input.month, amountMinor: input.amountMinor },
    update: { amountMinor: input.amountMinor }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: "expense.budget_set",
    entityType: "expense_budget",
    entityId: budget.id,
    summary: `Budget ${input.month} for "${cat.name}": ${(input.amountMinor / 100).toFixed(2)}`,
    propertyId: cat.propertyId,
    ip
  });
  return { ok: true, data: { id: budget.id } };
}

// ── expenses ─────────────────────────────────────────────────────────────────

export interface CreateExpenseInput {
  propertyId: string;
  categoryId: string;
  vendorName: string;
  description?: string | null;
  expenseDate: Date;
  amountMinor: number;
  paidVia: ExpensePaidVia;
  receiptDocId?: string | null;
}

export type ExpenseDTO = {
  id: string;
  code: string;
  status: string;
  autoApproved: boolean;
};

async function validateExpenseRefs(input: CreateExpenseInput) {
  const cat = await prisma.expenseCategory.findUnique({ where: { id: input.categoryId }, include: { property: { select: { id: true } } } });
  if (!cat || !cat.isActive) return { error: { ok: false as const, code: "CATEGORY_INVALID", message: "Category not found or inactive" } };
  if (cat.propertyId !== input.propertyId) return { error: { ok: false as const, code: "CATEGORY_MISMATCH", message: "Category belongs to another property" } };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { error: { ok: false as const, code: "INVALID_AMOUNT", message: "amountMinor must be a positive integer" } };
  }
  if (!input.vendorName.trim()) return { error: { ok: false as const, code: "VENDOR_REQUIRED", message: "Vendor name is required" } };
  if (Number.isNaN(input.expenseDate.getTime())) return { error: { ok: false as const, code: "INVALID_DATE", message: "expenseDate is invalid" } };
  if (input.receiptDocId) {
    const doc = await prisma.documentRegistry.findUnique({ where: { id: input.receiptDocId } });
    if (!doc) return { error: { ok: false as const, code: "RECEIPT_NOT_FOUND", message: "Receipt document not found" } };
    if (doc.entity !== "EXPENSE") return { error: { ok: false as const, code: "RECEIPT_ENTITY", message: "Receipt must be an EXPENSE document" } };
  }
  return { cat };
}

/// The ledger leg: DR category account / CR cash|bank, refType `expense`.
function postingLines(amountMinor: number, accountCode: string, paidVia: ExpensePaidVia, memo: string) {
  return [
    { code: accountCode, debit: amountMinor, credit: 0, memo },
    { code: PAID_VIA_ACCOUNT[paidVia], debit: 0, credit: amountMinor, memo }
  ];
}

export async function createExpense(
  input: CreateExpenseInput,
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<ExpenseDTO>> {
  const refs = await validateExpenseRefs(input);
  if (refs.error) return refs.error;
  const cat = refs.cat!;
  const threshold = await approvalThresholdMinor();
  const autoApprove = input.amountMinor <= threshold;
  const code = await nextNumber("EXPENSE", (n) => `EXP-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);

  const created = await prisma.$transaction(
    async (tx) => {
      const expense = await tx.expense.create({
        data: {
          code,
          propertyId: input.propertyId,
          categoryId: cat.id,
          vendorName: input.vendorName.trim(),
          description: input.description?.trim() ?? null,
          expenseDate: input.expenseDate,
          amountMinor: input.amountMinor,
          paidVia: input.paidVia,
          status: autoApprove ? "approved" : "pending",
          autoApproved: autoApprove,
          submittedById: actor.id,
          ...(autoApprove ? { approvedById: actor.id, approvedAt: new Date() } : {}),
          receiptDocId: input.receiptDocId ?? null
        }
      });
      if (autoApprove) {
        const memo = `Expense ${code} — ${input.vendorName.trim()} (${cat.name})`;
        const ledgerTxId = await postTransaction(tx, {
          memo,
          refType: "expense",
          refId: expense.id,
          propertyId: input.propertyId,
          actorId: actor.id,
          lines: postingLines(input.amountMinor, cat.accountCode, input.paidVia, memo)
        });
        await tx.expense.update({ where: { id: expense.id }, data: { ledgerTxId } });
      }
      return expense;
    },
    HEAVY_TX
  );

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: autoApprove ? "expense.created_auto_approved" : "expense.created",
    entityType: "expense",
    entityId: created.id,
    summary: `${code}: ${(input.amountMinor / 100).toFixed(2)} to ${input.vendorName.trim()} (${cat.name}${autoApprove ? ", auto-approved ≤ threshold" : ", pending approval"})`,
    propertyId: input.propertyId,
    after: { amountMinor: input.amountMinor, paidVia: input.paidVia, status: created.status, autoApproved: created.autoApproved },
    ip
  });
  await emitDomainEvent("expense.created", { expenseId: created.id, code, autoApprove, amountMinor: input.amountMinor }, input.propertyId);
  return { ok: true, data: { id: created.id, code: created.code, status: created.status, autoApproved: created.autoApproved } };
}

/// Approve a pending expense — posts the ledger leg (§M20 acceptance).
export async function approveExpense(expenseId: string, actor: ActorCtx, ip?: string | null): Promise<Result<ExpenseDTO>> {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId }, include: { category: true } });
  if (!expense) return { ok: false, code: "NOT_FOUND", message: "Expense not found" };
  if (expense.status !== "pending") return { ok: false, code: "INVALID_TRANSITION", message: `Cannot approve from ${expense.status}` };

  await prisma.$transaction(
    async (tx) => {
      const memo = `Expense ${expense.code} — ${expense.vendorName} (${expense.category.name})`;
      const ledgerTxId = await postTransaction(tx, {
        memo,
        refType: "expense",
        refId: expense.id,
        propertyId: expense.propertyId,
        actorId: actor.id,
        lines: postingLines(expense.amountMinor, expense.category.accountCode, expense.paidVia as ExpensePaidVia, memo)
      });
      await tx.expense.update({
        where: { id: expense.id },
        data: { status: "approved", approvedById: actor.id, approvedAt: new Date(), ledgerTxId }
      });
    },
    HEAVY_TX
  );
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: "expense.approved",
    entityType: "expense",
    entityId: expense.id,
    summary: `Approved ${expense.code}: ${(expense.amountMinor / 100).toFixed(2)} — posted DR ${expense.category.accountCode}/CR ${PAID_VIA_ACCOUNT[expense.paidVia as ExpensePaidVia]}`,
    propertyId: expense.propertyId,
    ip
  });
  await emitDomainEvent("expense.approved", { expenseId: expense.id, code: expense.code }, expense.propertyId);
  return { ok: true, data: { id: expense.id, code: expense.code, status: "approved", autoApproved: expense.autoApproved } };
}

export async function rejectExpense(expenseId: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<Result<ExpenseDTO>> {
  if (!reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "A rejection reason is required" };
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false, code: "NOT_FOUND", message: "Expense not found" };
  if (expense.status !== "pending") return { ok: false, code: "INVALID_TRANSITION", message: `Cannot reject from ${expense.status}` };
  await prisma.expense.update({
    where: { id: expense.id },
    data: { status: "rejected", rejectReason: reason.trim() }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: "expense.rejected",
    entityType: "expense",
    entityId: expense.id,
    summary: `Rejected ${expense.code} — "${reason.trim()}" (no ledger posting)`,
    propertyId: expense.propertyId,
    ip
  });
  return { ok: true, data: { id: expense.id, code: expense.code, status: "rejected", autoApproved: expense.autoApproved } };
}

/// Void an approved expense — the ledger leg is reversed (append-only ledger;
/// nothing is ever deleted) and the register row flips to `voided`, so the P&L
/// reconciliation stays exact.
export async function voidExpense(expenseId: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<Result<ExpenseDTO>> {
  if (!reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "A void reason is required" };
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false, code: "NOT_FOUND", message: "Expense not found" };
  if (expense.status !== "approved") return { ok: false, code: "INVALID_TRANSITION", message: `Cannot void from ${expense.status}` };
  if (!expense.ledgerTxId) return { ok: false, code: "NO_POSTING", message: "Approved expense has no ledger posting — data integrity issue" };

  await prisma.$transaction(
    async (tx) => {
      await reverseTransaction(tx, expense.ledgerTxId!, {
        memo: `Expense ${expense.code} voided — ${reason.trim()}`,
        refType: "expense_void",
        refId: expense.id,
        actorId: actor.id
      });
      await tx.expense.update({
        where: { id: expense.id },
        data: { status: "voided", voidedById: actor.id, voidedAt: new Date(), voidReason: reason.trim() }
      });
    },
    HEAVY_TX
  );
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: "expense.voided",
    entityType: "expense",
    entityId: expense.id,
    summary: `Voided ${expense.code}: ${(expense.amountMinor / 100).toFixed(2)} — ledger reversed — "${reason.trim()}"`,
    propertyId: expense.propertyId,
    ip
  });
  await emitDomainEvent("expense.voided", { expenseId: expense.id, code: expense.code }, expense.propertyId);
  return { ok: true, data: { id: expense.id, code: expense.code, status: "voided", autoApproved: expense.autoApproved } };
}

// ── recurring templates (§M20 entities) ──────────────────────────────────────

export async function createRecurring(
  input: { propertyId: string; categoryId: string; vendorName: string; description?: string | null; amountMinor: number; paidVia: ExpensePaidVia; dayOfMonth: number },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  const refs = await validateExpenseRefs({ ...input, expenseDate: new Date() });
  if (refs.error) return refs.error;
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 28) {
    return { ok: false, code: "INVALID_DAY", message: "dayOfMonth must be 1–28" };
  }
  const rec = await prisma.recurringExpense.create({
    data: {
      propertyId: input.propertyId,
      categoryId: input.categoryId,
      vendorName: input.vendorName.trim(),
      description: input.description?.trim() ?? null,
      amountMinor: input.amountMinor,
      paidVia: input.paidVia,
      dayOfMonth: input.dayOfMonth
    }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M20",
    action: "expense.recurring_created",
    entityType: "recurring_expense",
    entityId: rec.id,
    summary: `Recurring "${input.vendorName.trim()}" ${(input.amountMinor / 100).toFixed(2)} on day ${input.dayOfMonth}`,
    propertyId: input.propertyId,
    ip
  });
  return { ok: true, data: { id: rec.id } };
}

/// Materialize the month's expense for a template (idempotent per month).
export async function runRecurring(recId: string, actor: ActorCtx, ip?: string | null): Promise<Result<ExpenseDTO | { skipped: true }>> {
  const rec = await prisma.recurringExpense.findUnique({ where: { id: recId }, include: { category: true } });
  if (!rec || !rec.isActive) return { ok: false, code: "NOT_FOUND", message: "Recurring template not found or inactive" };
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (rec.lastRunMonth === month) return { ok: true, data: { skipped: true } };
  if (now.getUTCDate() < rec.dayOfMonth) return { ok: false, code: "NOT_DUE", message: `Not due until day ${rec.dayOfMonth}` };

  const result = await createExpense(
    {
      propertyId: rec.propertyId,
      categoryId: rec.categoryId,
      vendorName: rec.vendorName,
      description: `${rec.description ? `${rec.description} — ` : ""}recurring ${month}`,
      expenseDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), rec.dayOfMonth)),
      amountMinor: rec.amountMinor,
      paidVia: rec.paidVia as ExpensePaidVia
    },
    actor,
    ip
  );
  if (!result.ok) return result;
  await prisma.recurringExpense.update({ where: { id: rec.id }, data: { lastRunMonth: month } });
  return result;
}

// ── P&L (§M20 acceptance: matches ledger totals exactly) ─────────────────────

export async function profitAndLoss(input: { month?: string; propertyId?: string | null; scopePropertyIds: string[] }): Promise<Result<PLReport>> {
  const month = input.month ?? new Date().toISOString().slice(0, 7);
  const range = plMonthRange(month);
  if (!range) return { ok: false, code: "INVALID_MONTH", message: "month must be YYYY-MM" };
  const scoped = input.propertyId ? [input.propertyId] : input.scopePropertyIds;
  if (scoped.length === 0) {
    return { ok: true, data: buildPL({ month, scope: input.propertyId ? "property" : "consolidated", ledger: rollupLedger([]), payoutTotalMinor: 0, registerByAccount: new Map(), registerByCategory: new Map(), budgetByCategory: new Map() }) };
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { transaction: { postedAt: { gte: range.from, lt: range.to } }, propertyId: { in: scoped } },
    include: { account: { select: { code: true, type: true, name: true } }, transaction: { select: { refType: true, totalDebit: true, reversalOfId: true } } }
  });
  const rows: LedgerEntryRow[] = entries.map((e) => ({
    accountCode: e.account.code,
    accountType: e.account.type,
    debit: e.debit,
    credit: e.credit,
    refType: e.transaction.refType
  }));
  const ledger = rollupLedger(rows);

  // owner payouts: balanced totals of payout transactions in period+scope
  const payoutTxs = await prisma.ledgerTransaction.findMany({
    where: { refType: "payout", postedAt: { gte: range.from, lt: range.to }, propertyId: { in: scoped }, reversalOfId: null },
    select: { totalDebit: true }
  });
  const payoutTotalMinor = payoutTxs.reduce((s, t) => s + t.totalDebit, 0);

  // register side (same period basis as the ledger: the approval posting).
  // Voided expenses are excluded — their reversals net out of the ledger too.
  const expenses = await prisma.expense.findMany({
    where: { propertyId: { in: scoped }, status: "approved", approvedAt: { gte: range.from, lt: range.to } },
    include: { category: { select: { name: true, accountCode: true } } }
  });
  const registerByAccount = new Map<string, number>();
  const registerByCategory = new Map<string, number>();
  for (const e of expenses) {
    registerByAccount.set(e.category.accountCode, (registerByAccount.get(e.category.accountCode) ?? 0) + e.amountMinor);
    registerByCategory.set(e.category.name, (registerByCategory.get(e.category.name) ?? 0) + e.amountMinor);
  }

  // budgets are business-month based (expenseDate month)
  const fromDay = range.from.toISOString().slice(0, 10);
  const budgetRows = await prisma.expenseBudget.findMany({
    where: { month, category: { propertyId: { in: scoped } } },
    include: { category: { select: { name: true } } }
  });
  const monthExpenses = await prisma.expense.findMany({
    where: { propertyId: { in: scoped }, status: "approved", expenseDate: { gte: range.from, lt: range.to } },
    include: { category: { select: { name: true } } }
  });
  const registerByCategoryMonth = new Map<string, number>();
  for (const e of monthExpenses) {
    registerByCategoryMonth.set(e.category.name, (registerByCategoryMonth.get(e.category.name) ?? 0) + e.amountMinor);
  }
  void fromDay;
  const budgetByCategory = new Map(budgetRows.map((b) => [b.category.name, b.amountMinor]));

  const report = buildPL({
    month,
    scope: input.propertyId ? "property" : "consolidated",
    ledger,
    payoutTotalMinor,
    registerByAccount,
    registerByCategory: registerByCategoryMonth,
    budgetByCategory
  });
  return { ok: true, data: report };
}

export const EXPENSE_LEDGER_ACCOUNTS = EXPENSE_ACCOUNT_CODES;
export type { Prisma };
