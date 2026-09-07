package com.rentmanager.finance.ledger.service;

import java.util.List;
import java.util.Map;

/**
 * System chart of accounts (INTENT.md M08 fixed codes) — a port of
 * {@code src/lib/ledger/accounts.ts}. The 2300 Tax Payable liability extends the
 * named 21xx/22xx scheme so invoice tax has a home; everything else follows the
 * spec verbatim. Shared reference data (not tenant-scoped) — the books
 * (transactions/entries) are what carry {@code tenantId}.
 */
public final class ChartOfAccounts {

  private ChartOfAccounts() {}

  /** A system account definition. */
  public record SystemAccount(String code, String name, String type) {}

  // Account code constants (mirror the TS ACC map).
  public static final String CASH = "1100";
  public static final String BANK = "1200";
  public static final String RENT_RECEIVABLE = "1300";
  public static final String DEPOSIT_LIABILITY = "2100";
  public static final String OWNER_PAYABLE = "2200";
  public static final String TAX_PAYABLE = "2300";
  public static final String OWNER_DISTRIBUTIONS = "3900";
  public static final String RENT_REVENUE = "4000";
  public static final String SERVICE_REVENUE = "4100";
  public static final String UTILITY_REVENUE = "4200";
  public static final String LATE_FEE_REVENUE = "4300";
  public static final String OTHER_REVENUE = "4900";
  public static final String OPERATING_EXPENSES = "5000";
  public static final String BANK_FEES = "5100";

  public static final List<SystemAccount> SYSTEM_ACCOUNTS = List.of(
      new SystemAccount(CASH, "Cash", "ASSET"),
      new SystemAccount(BANK, "Bank", "ASSET"),
      new SystemAccount(RENT_RECEIVABLE, "Rent Receivable", "ASSET"),
      new SystemAccount(DEPOSIT_LIABILITY, "Deposit Liability", "LIABILITY"),
      new SystemAccount(OWNER_PAYABLE, "Owner Payable", "LIABILITY"),
      new SystemAccount(TAX_PAYABLE, "Tax Payable", "LIABILITY"),
      new SystemAccount(OWNER_DISTRIBUTIONS, "Owner Distributions", "EQUITY"),
      new SystemAccount(RENT_REVENUE, "Rent Revenue", "INCOME"),
      new SystemAccount(SERVICE_REVENUE, "Service Revenue", "INCOME"),
      new SystemAccount(UTILITY_REVENUE, "Utility Revenue", "INCOME"),
      new SystemAccount(LATE_FEE_REVENUE, "Late Fee Revenue", "INCOME"),
      new SystemAccount(OTHER_REVENUE, "Other Revenue", "INCOME"),
      new SystemAccount(OPERATING_EXPENSES, "Operating Expenses", "EXPENSE"),
      new SystemAccount(BANK_FEES, "Bank Fees", "EXPENSE"));

  /**
   * Invoice item kind → the account credited on issue. Everything is revenue
   * except {@code deposit}, which credits the 2100 liability.
   */
  public static final Map<String, String> CREDIT_ACCOUNT_BY_KIND = Map.of(
      "rent", RENT_REVENUE,
      "service", SERVICE_REVENUE,
      "utility", UTILITY_REVENUE,
      "one_time", OTHER_REVENUE,
      "late_fee", LATE_FEE_REVENUE,
      "credit", OTHER_REVENUE,
      "deposit", DEPOSIT_LIABILITY);

  public static String creditAccountForKind(String kind) {
    return CREDIT_ACCOUNT_BY_KIND.getOrDefault(kind, OTHER_REVENUE);
  }

  /** Debit-normal accounts grow with debits; the rest with credits. */
  public static boolean isDebitNormal(String type) {
    return "ASSET".equals(type) || "EXPENSE".equals(type);
  }

  /** Cash-drawer settlement account: cash & cheque → 1100, else 1200. */
  public static String settlementAccountCode(String method) {
    return "cash".equals(method) || "cheque".equals(method) ? CASH : BANK;
  }
}
