/// M24 pure math (§M24): payout formula per contract model, fee rounding,
/// collection/expense rollups, reconciliation identity.
import { describe, expect, it } from "vitest";
import {
  computeStatementLines,
  previousMonth,
  rollupCollections,
  rollupExpensesByCharge,
  statementMonthRange,
  statementReconciles
} from "@/lib/operations/statements-math";

describe("M24 statement math", () => {
  it("statementMonthRange parses YYYY-MM; previousMonth steps back", () => {
    const r = statementMonthRange("2026-08")!;
    expect(r.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(statementMonthRange("2026-99")).toBeNull();
    expect(previousMonth(new Date(Date.UTC(2026, 0, 15)))).toBe("2025-12");
  });

  it("REVENUE_SHARE: gross = collected × share, fee = gross × pct, net per formula", () => {
    const lines = computeStatementLines({
      model: "REVENUE_SHARE",
      sharePercent: 60,
      fixedRentMinor: null,
      managementFeePercent: 10,
      collectedMinor: 145_330,
      passthroughMinor: 2_200,
      ownerMaintenanceMinor: 0,
      adjustmentsMinor: 0
    });
    expect(lines.grossShareMinor).toBe(87_198); // 145330 × 60% (half-up)
    expect(lines.managementFeeMinor).toBe(8_720); // 87198 × 10%
    expect(lines.netMinor).toBe(76_278); // 87198 − 8720 − 2200
    expect(statementReconciles(lines)).toBe(true);
  });

  it("FIXED_RENT: gross = fixed master rent regardless of collections", () => {
    const lines = computeStatementLines({
      model: "FIXED_RENT",
      sharePercent: null,
      fixedRentMinor: 65_000,
      managementFeePercent: 0,
      collectedMinor: 999_999,
      passthroughMinor: 5_000,
      ownerMaintenanceMinor: 1_200,
      adjustmentsMinor: -1_000
    });
    expect(lines.grossShareMinor).toBe(65_000);
    expect(lines.managementFeeMinor).toBe(0);
    expect(lines.netMinor).toBe(57_800); // 65000 − 5000 − 1200 − 1000
    expect(statementReconciles(lines)).toBe(true);
  });

  it("clamps out-of-range percentages and keeps negative nets exact", () => {
    const lines = computeStatementLines({
      model: "REVENUE_SHARE",
      sharePercent: 150, // clamped to 100
      fixedRentMinor: null,
      managementFeePercent: -5, // clamped to 0
      collectedMinor: 10_000,
      passthroughMinor: 12_000, // exceeds the share → negative net
      ownerMaintenanceMinor: 0,
      adjustmentsMinor: 0
    });
    expect(lines.grossShareMinor).toBe(10_000);
    expect(lines.managementFeeMinor).toBe(0);
    expect(lines.netMinor).toBe(-2_000);
    expect(statementReconciles(lines)).toBe(true);
  });

  it("rollupCollections groups allocations per building", () => {
    const m = rollupCollections([
      { buildingId: "b1", amountMinor: 10_000 },
      { buildingId: "b1", amountMinor: 5_500 },
      { buildingId: "b2", amountMinor: 999 }
    ]);
    expect(m.get("b1")).toBe(15_500);
    expect(m.get("b2")).toBe(999);
  });

  it("rollupExpensesByCharge splits passthrough vs owner maintenance", () => {
    const { passthrough, ownerMaintenance } = rollupExpensesByCharge([
      { buildingId: "b1", chargeTo: "passthrough", amountMinor: 2_200 },
      { buildingId: "b1", chargeTo: "owner_maintenance", amountMinor: 1_450 },
      { buildingId: "b1", chargeTo: "company", amountMinor: 50_000 }, // ignored
      { buildingId: "b2", chargeTo: "passthrough", amountMinor: 700 }
    ]);
    expect(passthrough.get("b1")).toBe(2_200);
    expect(ownerMaintenance.get("b1")).toBe(1_450);
    expect(passthrough.get("b2")).toBe(700);
  });
});
