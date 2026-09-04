/// M20 Expenses & P&L — pure math: ledger rollups, the P&L statement,
/// register↔ledger reconciliation and budget variance. DB work lives in
/// expenses-service.ts. All money is integer minor units.
export const EXPENSE_ACCOUNT_CODES = ["5000", "5100"] as const;
export type ExpenseAccountCode = (typeof EXPENSE_ACCOUNT_CODES)[number];

export const EXPENSE_PAID_VIA = ["cash", "bank_transfer"] as const;
export type ExpensePaidVia = (typeof EXPENSE_PAID_VIA)[number];

/// Ledger account used to fund an expense (§M20 "paid_via M09").
export const PAID_VIA_ACCOUNT: Record<ExpensePaidVia, string> = {
  cash: "1100",
  bank_transfer: "1200"
};

export const EXPENSE_STATUSES = ["pending", "approved", "rejected", "voided"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const DEFAULT_APPROVAL_THRESHOLD_MINOR = 50_000; // $500.00

// ── month windows (shared shape with attendance-math) ────────────────────────

export function plMonthRange(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  return { from: new Date(Date.UTC(year, mon - 1, 1)), to: new Date(Date.UTC(year, mon, 1)) };
}

// ── ledger rollups ───────────────────────────────────────────────────────────

export interface LedgerEntryRow {
  accountCode: string;
  accountType: string; // ASSET | LIABILITY | INCOME | EXPENSE | EQUITY
  debit: number;
  credit: number;
  refType: string;
}

export interface AccountLine {
  code: string;
  label: string;
  amountMinor: number; // credit-positive for income, debit-positive for expense
}

export const ACCOUNT_LABELS: Record<string, string> = {
  "4000": "Rent revenue",
  "4100": "Service revenue",
  "4200": "Utility revenue",
  "4300": "Late fee revenue",
  "4900": "Other revenue",
  "5000": "Operating expenses",
  "5100": "Bank fees"
};

/// Roll raw ledger rows into P&L sections. Income = Σcredit − Σdebit on 4xxx;
/// expenses = Σdebit − Σcredit on 5xxx; owner payouts = Σ balanced totals of
/// `payout` transactions (the −owner-payouts term of the §M20 formula).
export function rollupLedger(rows: LedgerEntryRow[]): {
  revenue: AccountLine[];
  expenses: AccountLine[];
  revenueTotalMinor: number;
  expenseTotalMinor: number;
  payoutTotalMinor: number;
} {
  const revenueMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const r of rows) {
    if (r.accountType === "INCOME") {
      revenueMap.set(r.accountCode, (revenueMap.get(r.accountCode) ?? 0) + r.credit - r.debit);
    } else if (r.accountType === "EXPENSE") {
      expenseMap.set(r.accountCode, (expenseMap.get(r.accountCode) ?? 0) + r.debit - r.credit);
    }
  }
  // Owner payouts (the −payouts term) are computed by the service from
  // `payout` transactions' balanced totals and passed into buildPL directly.

  const revenue: AccountLine[] = [...revenueMap.entries()]
    .filter(([, v]) => v !== 0)
    .map(([code, v]) => ({ code, label: ACCOUNT_LABELS[code] ?? code, amountMinor: v }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const expenses: AccountLine[] = [...expenseMap.entries()]
    .filter(([, v]) => v !== 0)
    .map(([code, v]) => ({ code, label: ACCOUNT_LABELS[code] ?? code, amountMinor: v }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    revenue,
    expenses,
    revenueTotalMinor: revenue.reduce((s, l) => s + l.amountMinor, 0),
    expenseTotalMinor: expenses.reduce((s, l) => s + l.amountMinor, 0),
    payoutTotalMinor: 0
  };
}

// ── P&L statement (§M20: revenue − operating expenses − owner payouts = net) ─

export interface RegisterRow {
  accountCode: string;
  category: string;
  amountMinor: number;
}

export interface ReconcileLine {
  code: string;
  label: string;
  ledgerMinor: number;
  registerMinor: number;
  deltaMinor: number; // must be 0 when the P&L reconciles
}

export interface BudgetLine {
  category: string;
  budgetMinor: number | null;
  actualMinor: number;
  varianceMinor: number | null; // budget − actual (positive = under budget)
}

export interface PLReport {
  month: string;
  scope: "property" | "consolidated";
  revenue: AccountLine[];
  expenses: AccountLine[];
  payoutTotalMinor: number;
  revenueTotalMinor: number;
  expenseTotalMinor: number;
  netMinor: number; // revenue − expenses − payouts
  reconciliation: ReconcileLine[];
  reconcilesExactly: boolean;
  budgets: BudgetLine[];
}

/// Assemble the report. `registerByAccount` = approved expenses grouped by the
/// category's ledger account over the same period; `budgetRows` = per-category
/// actuals for the month vs configured budgets.
export function buildPL(input: {
  month: string;
  scope: "property" | "consolidated";
  ledger: ReturnType<typeof rollupLedger>;
  payoutTotalMinor: number;
  registerByAccount: Map<string, number>;
  registerByCategory: Map<string, number>;
  budgetByCategory: Map<string, number>;
}): PLReport {
  const registerByAccount = input.registerByAccount;
  const codes = [...new Set([...input.ledger.expenses.map((l) => l.code), ...registerByAccount.keys()])].sort();
  const reconciliation: ReconcileLine[] = codes.map((code) => {
    const ledgerMinor = input.ledger.expenses.find((l) => l.code === code)?.amountMinor ?? 0;
    const registerMinor = registerByAccount.get(code) ?? 0;
    return { code, label: ACCOUNT_LABELS[code] ?? code, ledgerMinor, registerMinor, deltaMinor: ledgerMinor - registerMinor };
  });

  const budgets: BudgetLine[] = [...input.registerByCategory.entries()]
    .map(([category, actualMinor]) => {
      const budgetMinor = input.budgetByCategory.get(category) ?? null;
      return { category, budgetMinor, actualMinor, varianceMinor: budgetMinor == null ? null : budgetMinor - actualMinor };
    })
    .sort((a, b) => a.category.localeCompare(b.category));
  // categories with a budget but no spend still show their variance
  for (const [category, budgetMinor] of input.budgetByCategory) {
    if (!input.registerByCategory.has(category)) {
      budgets.push({ category, budgetMinor, actualMinor: 0, varianceMinor: budgetMinor });
    }
  }
  budgets.sort((a, b) => a.category.localeCompare(b.category));

  const netMinor = input.ledger.revenueTotalMinor - input.ledger.expenseTotalMinor - input.payoutTotalMinor;
  return {
    month: input.month,
    scope: input.scope,
    revenue: input.ledger.revenue,
    expenses: input.ledger.expenses,
    payoutTotalMinor: input.payoutTotalMinor,
    revenueTotalMinor: input.ledger.revenueTotalMinor,
    expenseTotalMinor: input.ledger.expenseTotalMinor,
    netMinor,
    reconciliation,
    reconcilesExactly: reconciliation.every((r) => r.deltaMinor === 0),
    budgets
  };
}

// ── budget variance (§M20 acceptance: "budget vs actual variance shown") ─────

export function budgetVariance(budgetMinor: number, actualMinor: number): { varianceMinor: number; state: "under" | "over" | "on" } {
  const varianceMinor = budgetMinor - actualMinor;
  return { varianceMinor, state: varianceMinor > 0 ? "under" : varianceMinor < 0 ? "over" : "on" };
}
