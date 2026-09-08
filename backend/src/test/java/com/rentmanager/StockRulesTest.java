package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.inventory.service.StockMath;
import org.junit.jupiter.api.Test;

/**
 * Ports the M15 stock math from {@code src/lib/operations/stock-math.ts} so both
 * stacks compute the same moving-average cost, valuation, low-stock flag and
 * stocktake variance — including JS {@code Math.round}'s half-up-toward-+∞ ties.
 * Quantities/costs are integer milli (1 unit = 1000; cost is minor×1000).
 */
class StockRulesTest {

  @Test
  void movingAverageBlendsCostOnPurchase() {
    // 6 units @ 1.000 avg, add 4 units @ 2.000 → 10 units @ 1.400 avg.
    StockMath.MovingAverage ma = StockMath.movingAverage(6_000, 1_000, 4_000, 2_000);
    assertThat(ma.avgCostAfterMilli()).isEqualTo(1_400);
    assertThat(ma.valueDeltaMilli()).isEqualTo(5_600); // 4000·1400/1000
  }

  @Test
  void movingAverageFromEmptyAdoptsPurchaseCost() {
    StockMath.MovingAverage ma = StockMath.movingAverage(0, 0, 10_000, 200_000);
    assertThat(ma.avgCostAfterMilli()).isEqualTo(200_000);
    assertThat(ma.valueDeltaMilli()).isEqualTo(2_000_000);
  }

  @Test
  void movingAverageKeepsAvgWhenTotalNonPositive() {
    // A full wipe-out keeps the last known average (re-purchase re-blends).
    StockMath.MovingAverage ma = StockMath.movingAverage(3_000, 1_500, -3_000, 0);
    assertThat(ma.avgCostAfterMilli()).isEqualTo(1_500);
    assertThat(ma.valueDeltaMilli()).isZero();
  }

  @Test
  void valuationValuesOnHandAtMovingAverage() {
    assertThat(StockMath.valuationMilli(10_000, 1_400)).isEqualTo(14_000);
  }

  @Test
  void valuationRoundsHalfUpTowardPositiveInfinity() {
    assertThat(StockMath.valuationMilli(5, 500)).isEqualTo(3);   // 2.5 → 3
    assertThat(StockMath.valuationMilli(-5, 500)).isEqualTo(-2); // -2.5 → -2
  }

  @Test
  void lowStockAtOrBelowThreshold() {
    assertThat(StockMath.isLowStock(6_000, 6_000)).isTrue();
    assertThat(StockMath.isLowStock(6_001, 6_000)).isFalse();
    assertThat(StockMath.isLowStock(0, 0)).isTrue();
  }

  @Test
  void stocktakeVarianceIsCountedMinusExpected() {
    assertThat(StockMath.stocktakeVariance(6_000, 4_000)).isEqualTo(-2_000); // short
    assertThat(StockMath.stocktakeVariance(6_000, 6_500)).isEqualTo(500);    // over
    assertThat(StockMath.stocktakeVariance(6_000, 6_000)).isZero();
  }

  @Test
  void movementTypesMatchSchema() {
    assertThat(StockMath.isMovementType("maintenance_use")).isTrue();
    assertThat(StockMath.isMovementType("transfer")).isTrue();
    assertThat(StockMath.isMovementType("nope")).isFalse();
  }
}
