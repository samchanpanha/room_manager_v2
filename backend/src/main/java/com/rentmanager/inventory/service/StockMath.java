package com.rentmanager.inventory.service;

import java.util.List;

/**
 * M15 Stock — pure math: moving-average cost, valuation and low-stock checks.
 * Faithful port of {@code src/lib/operations/stock-math.ts}. Quantities/costs are
 * integer milli (1 unit = 1000; {@code avgCostMilli} is minor×1000).
 */
public final class StockMath {

  private StockMath() {}

  public static final List<String> MOVEMENT_TYPES =
      List.of("purchase", "sale", "consumption", "maintenance_use", "adjustment", "transfer");

  public static boolean isMovementType(String v) {
    return MOVEMENT_TYPES.contains(v);
  }

  /** Result of a moving-average step: new avg + signed stock-value change. */
  public record MovingAverage(int avgCostAfterMilli, int valueDeltaMilli) {}

  /**
   * Moving-average unit cost (§M15): newAvg = (qty·avg + added·cost)/(qty+added),
   * rounded half-up to integer milli. Adds of 0 never divide by zero.
   * {@code valueMilli} is minor×1000 — qty(milli)×cost(milli) is milli², so
   * divide by 1000 (anything above ~$21 of stock would overflow int otherwise).
   */
  public static MovingAverage movingAverage(int currentQtyMilli, int currentAvgMilli,
      int addedQtyMilli, int unitCostMilli) {
    long totalQty = (long) currentQtyMilli + addedQtyMilli;
    if (totalQty <= 0) return new MovingAverage(currentAvgMilli, 0);
    long newValue = (long) currentQtyMilli * currentAvgMilli + (long) addedQtyMilli * unitCostMilli;
    int avgCostAfterMilli = Math.toIntExact(roundHalfUp(newValue, totalQty));
    long valueNumer = addedQtyMilli > 0
        ? (long) addedQtyMilli * avgCostAfterMilli
        : (long) addedQtyMilli * currentAvgMilli;
    int valueDeltaMilli = Math.toIntExact(roundHalfUp(valueNumer, 1000));
    return new MovingAverage(avgCostAfterMilli, valueDeltaMilli);
  }

  /** Valuation of on-hand stock at moving-average cost (minor×1000). */
  public static int valuationMilli(int qtyMilli, int avgCostMilli) {
    return Math.toIntExact(roundHalfUp((long) qtyMilli * avgCostMilli, 1000));
  }

  /** Low-stock alert (§M15): on-hand at or below the threshold. */
  public static boolean isLowStock(int qtyMilli, int minQtyMilli) {
    return qtyMilli <= minQtyMilli;
  }

  /** Stocktake variance → adjustment delta (counted − expected). */
  public static int stocktakeVariance(int expectedMilli, int countedMilli) {
    return countedMilli - expectedMilli;
  }

  /**
   * Half-up rounding of {@code numer/denom} matching JS {@code Math.round}
   * (ties round toward +∞): {@code Math.round(x) = floor(x + 0.5)}, i.e.
   * {@code floor((2·numer + denom) / (2·denom))}. {@code denom} is always
   * positive here. Uses {@link Math#floorDiv} + {@link Math#multiplyExact} so
   * overflow surfaces rather than silently wrapping.
   */
  static long roundHalfUp(long numer, long denom) {
    if (denom == 0) return 0;
    long n = Math.addExact(Math.multiplyExact(2, numer), denom);
    return Math.floorDiv(n, Math.multiplyExact(2, denom));
  }
}
