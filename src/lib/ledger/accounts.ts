/// System chart of accounts (INTENT.md M08 fixed codes). The 2300 Tax Payable
/// liability extends the named 21xx/22xx scheme so invoice tax has a home;
/// everything else follows the spec verbatim.
export type AccountType = "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";

export const SYSTEM_ACCOUNTS: Array<{ code: string; name: string; type: AccountType }> = [
  { code: "1100", name: "Cash", type: "ASSET" },
  { code: "1200", name: "Bank", type: "ASSET" },
  { code: "1300", name: "Rent Receivable", type: "ASSET" },
  { code: "2100", name: "Deposit Liability", type: "LIABILITY" },
  { code: "2200", name: "Owner Payable", type: "LIABILITY" },
  { code: "2300", name: "Tax Payable", type: "LIABILITY" },
  /// §15 v1.2: balance-sheet-only home for M24 owner-distribution accruals —
  /// an expense account would double-count in the §M20 P&L payout term and
  /// break the M20 register↔ledger reconciliation. Debit balance in practice.
  { code: "3900", name: "Owner Distributions", type: "EQUITY" },
  { code: "4000", name: "Rent Revenue", type: "INCOME" },
  { code: "4100", name: "Service Revenue", type: "INCOME" },
  { code: "4200", name: "Utility Revenue", type: "INCOME" },
  { code: "4300", name: "Late Fee Revenue", type: "INCOME" },
  { code: "4900", name: "Other Revenue", type: "INCOME" },
  { code: "5000", name: "Operating Expenses", type: "EXPENSE" },
  { code: "5100", name: "Bank Fees", type: "EXPENSE" }
];

export const ACC = {
  CASH: "1100",
  BANK: "1200",
  RENT_RECEIVABLE: "1300",
  DEPOSIT_LIABILITY: "2100",
  OWNER_PAYABLE: "2200",
  TAX_PAYABLE: "2300",
  OWNER_DISTRIBUTIONS: "3900",
  RENT_REVENUE: "4000",
  SERVICE_REVENUE: "4100",
  UTILITY_REVENUE: "4200",
  LATE_FEE_REVENUE: "4300",
  OTHER_REVENUE: "4900",
  OPERATING_EXPENSES: "5000",
  BANK_FEES: "5100"
} as const;

/// Invoice item kind → the account credited on issue. Everything is revenue
/// except `deposit`, which credits the 2100 liability (the member owes us a
/// deposit obligation; payment settles the receivable, settlement releases it).
export const CREDIT_ACCOUNT_BY_KIND: Record<string, string> = {
  rent: ACC.RENT_REVENUE,
  service: ACC.SERVICE_REVENUE,
  utility: ACC.UTILITY_REVENUE,
  one_time: ACC.OTHER_REVENUE,
  late_fee: ACC.LATE_FEE_REVENUE,
  credit: ACC.OTHER_REVENUE,
  deposit: ACC.DEPOSIT_LIABILITY
};

/// Debit-normal accounts grow with debits; the rest with credits.
export function isDebitNormal(type: string): boolean {
  return type === "ASSET" || type === "EXPENSE";
}
