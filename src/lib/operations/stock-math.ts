/// M15 Stock — pure math: moving-average cost, valuation and low-stock
/// checks. Quantities/costs are integer milli (1 unit = 1000; minor×1000).
export const STOCK_MOVEMENT_TYPES = ["purchase", "sale", "consumption", "maintenance_use", "adjustment", "transfer"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface MovingAverage {
  avgCostAfterMilli: number;
  valueDeltaMilli: number; // signed stock-value change caused by the movement
}

/// Moving-average unit cost (§M15): newAvg = (qty·avg + added·cost)/(qty+added),
/// rounded half-up to integer milli. Adds of 0 never divide by zero.
export function movingAverage(currentQtyMilli: number, currentAvgMilli: number, addedQtyMilli: number, unitCostMilli: number): MovingAverage {
  const totalQty = currentQtyMilli + addedQtyMilli;
  if (totalQty <= 0) return { avgCostAfterMilli: currentAvgMilli, valueDeltaMilli: 0 };
  const newValue = currentQtyMilli * currentAvgMilli + addedQtyMilli * unitCostMilli;
  const avgCostAfterMilli = Math.round(newValue / totalQty);
  // valueMilli is stored in minor×1000 (§schema): qty(milli) × cost(milli) is
  // milli² — divide by 1000 or anything above ~$21 of stock overflows Int32.
  return {
    avgCostAfterMilli,
    valueDeltaMilli: Math.round((addedQtyMilli > 0 ? addedQtyMilli * avgCostAfterMilli : addedQtyMilli * currentAvgMilli) / 1000)
  };
}

/// Valuation of on-hand stock at moving-average cost (minor×1000).
export function valuationMilli(qtyMilli: number, avgCostMilli: number): number {
  return Math.round((qtyMilli * avgCostMilli) / 1000);
}

/// Low-stock alert (§M15): on-hand at or below the threshold.
export function isLowStock(qtyMilli: number, minQtyMilli: number): boolean {
  return qtyMilli <= minQtyMilli;
}

/// Stocktake variance → adjustment delta (counted − expected).
export function stocktakeVariance(expectedMilli: number, countedMilli: number): number {
  return countedMilli - expectedMilli;
}
