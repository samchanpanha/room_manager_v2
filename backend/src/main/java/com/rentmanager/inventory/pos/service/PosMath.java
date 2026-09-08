package com.rentmanager.inventory.pos.service;

/**
 * M14 POS — pure money math shared by the service and its tests. Line totals and
 * the cash-drawer variance, matching {@code pos-service.tsx} (JS {@code Math.round},
 * half-up toward +∞). Quantities are integer milli (1 unit = 1000); prices/cash
 * are integer minor units.
 */
public final class PosMath {

  private PosMath() {}

  /** Line total: qtyMilli × unit price / 1000, rounded half-up. */
  public static int lineMinor(int qtyMilli, int unitPriceMinor) {
    long numer = (long) qtyMilli * unitPriceMinor;
    return Math.toIntExact(Math.floorDiv(2 * numer + 1000, 2 * 1000L));
  }

  /** Net settled amount after a sale-level discount. */
  public static int netMinor(int totalMinor, int discountMinor) {
    return totalMinor - discountMinor;
  }

  /** Expected drawer cash at close: opening float + Σ net cash sales. */
  public static int expectedCashMinor(int openingFloatMinor, int netCashSalesMinor) {
    return openingFloatMinor + netCashSalesMinor;
  }

  /** Cash-drawer variance at close: counted − expected. */
  public static int varianceMinor(int countedCashMinor, int expectedCashMinor) {
    return countedCashMinor - expectedCashMinor;
  }
}
