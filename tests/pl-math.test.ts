/// M20 pure math (§M20): ledger rollups (credit-positive income,
/// debit-positive expenses), P&L assembly, register↔ledger reconciliation
/// (Δ must be 0), budget variance.
import { describe, expect, it } from "vitest";
import { buildPL, budgetVariance, plMonthRange, rollupLedger, type LedgerEntryRow } from "@/lib/operations/pl-math";

const inc = (code: string, credit: number): LedgerEntryRow => ({ accountCode: code, accountType: "INCOME", debit: 0, credit, refType: "invoice" });
const exp = (code: string, debit: number): LedgerEntryRow => ({ accountCode: code, accountType: "EXPENSE", debit, credit: 0, refType: "expense" });

describe("M20 P&L math", () => {
  it("plMonthRange parses YYYY-MM, rejects junk", () => {
    const r = plMonthRange("2026-09")!;
    expect(r.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(plMonthRange("2026-00")).toBeNull();
    expect(plMonthRange("x")).toBeNull();
  });

  it("rollupLedger: revenue = credits − debits; expenses = debits − credits; zero lines dropped", () => {
    const rows = [
      inc("4000", 250_000),
      inc("4200", 10_500),
      { accountCode: "4000", accountType: "INCOME", debit: 5_000, credit: 0, refType: "credit_note" }, // reversal shrinks revenue
      exp("5000", 22_000),
      { accountCode: "1100", accountType: "ASSET", debit: 30_000, credit: 0, refType: "payment" } // not a P&L account
    ];
    const r = rollupLedger(rows);
    expect(r.revenueTotalMinor).toBe(255_500);
    expect(r.expenseTotalMinor).toBe(22_000);
    expect(r.revenue.map((l) => l.code)).toEqual(["4000", "4200"]);
    expect(r.revenue[0].amountMinor).toBe(245_000);
  });

  it("buildPL: net = revenue − expenses − payouts", () => {
    const ledger = rollupLedger([inc("4000", 100_000), exp("5000", 30_000)]);
    const report = buildPL({
      month: "2026-09",
      scope: "property",
      ledger: { ...ledger, payoutTotalMinor: 0 },
      payoutTotalMinor: 20_000,
      registerByAccount: new Map([["5000", 30_000]]),
      registerByCategory: new Map([["Repairs", 30_000]]),
      budgetByCategory: new Map()
    });
    expect(report.netMinor).toBe(50_000);
    expect(report.reconcilesExactly).toBe(true);
  });

  it("buildPL: reconciliation flags register↔ledger drift", () => {
    const ledger = rollupLedger([exp("5000", 30_000), exp("5100", 1_000)]);
    const report = buildPL({
      month: "2026-09",
      scope: "consolidated",
      ledger,
      payoutTotalMinor: 0,
      registerByAccount: new Map([["5000", 28_000]]), // register missing 2_000
      registerByCategory: new Map(),
      budgetByCategory: new Map()
    });
    expect(report.reconcilesExactly).toBe(false);
    const op = report.reconciliation.find((r) => r.code === "5000")!;
    expect(op.deltaMinor).toBe(2_000);
    const fees = report.reconciliation.find((r) => r.code === "5100")!;
    expect(fees.registerMinor).toBe(0); // account appears from the ledger side alone
  });

  it("buildPL: budget variance per category incl. budget-without-spend rows", () => {
    const report = buildPL({
      month: "2026-09",
      scope: "property",
      ledger: rollupLedger([exp("5000", 40_000)]),
      payoutTotalMinor: 0,
      registerByAccount: new Map([["5000", 40_000]]),
      registerByCategory: new Map([["Internet & WiFi", 22_000], ["Repairs", 80_000]]),
      budgetByCategory: new Map([["Internet & WiFi", 30_000], ["Repairs", 60_000], ["Cleaning", 25_000]])
    });
    const net = report.budgets.find((b) => b.category === "Internet & WiFi")!;
    expect(net.varianceMinor).toBe(8_000); // under budget
    const repairs = report.budgets.find((b) => b.category === "Repairs")!;
    expect(repairs.varianceMinor).toBe(-20_000); // over budget
    const cleaning = report.budgets.find((b) => b.category === "Cleaning")!;
    expect(cleaning.actualMinor).toBe(0);
    expect(cleaning.varianceMinor).toBe(25_000);
  });

  it("budgetVariance states", () => {
    expect(budgetVariance(100, 90)).toEqual({ varianceMinor: 10, state: "under" });
    expect(budgetVariance(100, 110)).toEqual({ varianceMinor: -10, state: "over" });
    expect(budgetVariance(100, 100)).toEqual({ varianceMinor: 0, state: "on" });
  });
});
