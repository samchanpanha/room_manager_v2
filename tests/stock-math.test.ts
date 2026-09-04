/**
 * Phase 14 — pure stock math (M15): moving-average cost, valuation,
 * low-stock threshold and stocktake variance.
 */
import { describe, expect, it } from "vitest";

import { isLowStock, movingAverage, stocktakeVariance, valuationMilli } from "@/lib/operations/stock-math";

describe("M15 moving average", () => {
  it("blends the new purchase into the average (10 @ 20 then 10 @ 30 → 25)", () => {
    const first = movingAverage(0, 0, 10_000, 20_000);
    expect(first.avgCostAfterMilli).toBe(20_000);
    const second = movingAverage(10_000, 20_000, 10_000, 30_000);
    expect(second.avgCostAfterMilli).toBe(25_000); // (10000·20000 + 10000·30000)/20000
    expect(second.valueDeltaMilli).toBe(250_000); // added qty × new average, in minor×1000
  });

  it("keeps milli-unit precision with rounding (1 @ 33 + 2 @ 40 → 37.67)", () => {
    const ma = movingAverage(1_000, 33_000, 2_000, 40_000);
    expect(ma.avgCostAfterMilli).toBe(37_667); // 113000/3 → 37666.67 → 37667
  });

  it("a zero-qty base keeps the incoming cost", () => {
    expect(movingAverage(0, 99_999, 5_000, 42_000).avgCostAfterMilli).toBe(42_000);
  });

  it("valuation is qty × average cost", () => {
    expect(valuationMilli(6_000, 25_000)).toBe(150_000); // qty(milli) × avg(milli) / 1000 → minor×1000
  });

  it("purchase value stays inside Int32 for real-world costs (regression: P2023 overflow)", () => {
    // 2 pcs @ $12.50 — the milli² scale used to produce 2.5e9 > Int32.Max
    const ma = movingAverage(0, 0, 2_000, 1_250_000);
    expect(ma.avgCostAfterMilli).toBe(1_250_000);
    expect(ma.valueDeltaMilli).toBe(2_500_000); // $25.00 in minor×1000
    expect(ma.valueDeltaMilli).toBeLessThanOrEqual(2_147_483_647);
    // valuation of 1 pc @ $21.48 (formerly already > Int32)
    expect(valuationMilli(1_000, 21_480_000)).toBe(21_480_000);
  });

  it("low stock fires at or below the threshold", () => {
    expect(isLowStock(5_000, 5_000)).toBe(true);
    expect(isLowStock(4_999, 5_000)).toBe(true);
    expect(isLowStock(5_001, 5_000)).toBe(false);
  });

  it("stocktake variance is counted − expected", () => {
    expect(stocktakeVariance(10_000, 9_000)).toBe(-1_000);
    expect(stocktakeVariance(10_000, 10_500)).toBe(500);
    expect(stocktakeVariance(7_000, 7_000)).toBe(0);
  });
});
