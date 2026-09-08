package com.rentmanager.utilities.service;

import java.util.ArrayList;
import java.util.List;

/**
 * Utilities pure rules (INTENT.md M11) — a port of {@code src/lib/utilities/machines.ts}.
 * Reading math, tier pricing, estimates, spike detection and tariff selection.
 * All integer math; readings are milli-units (×1000) so 241.5 kWh is 241500.
 * No I/O, so every branch is unit-testable (UtilityRulesTest).
 */
public final class UtilityRules {

  private UtilityRules() {}

  public static final List<String> METER_TYPES = List.of("elec", "water", "gas");

  public static boolean isMeterType(String v) { return METER_TYPES.contains(v); }

  public static String meterDisplayName(String type) {
    return "elec".equals(type) ? "Electricity" : "water".equals(type) ? "Water" : "Gas";
  }

  /** Parse a display-unit reading ("241.5", up to 3 decimals) into milli-units. */
  public static int toMilli(String display) {
    String s = display == null ? "" : display.trim();
    if (!s.matches("\\d+(\\.\\d{1,3})?")) {
      throw new IllegalArgumentException(
          "INVALID: reading must be a non-negative number with up to 3 decimals");
    }
    String[] parts = s.split("\\.");
    String whole = parts[0];
    String frac = parts.length > 1 ? parts[1] : "";
    while (frac.length() < 3) frac += "0";
    return Integer.parseInt(whole) * 1000 + Integer.parseInt(frac);
  }

  /** Format milli-units for display, trimming trailing zeros ("241500" → "241.5"). */
  public static String formatMilli(int milli) {
    java.math.BigDecimal v = java.math.BigDecimal.valueOf(milli, 3).stripTrailingZeros();
    return v.toPlainString();
  }

  /** A tariff tier: cumulative ceiling in milli-units (null = infinity) + rate. */
  public record TariffTier(Integer upToMilli, int ratePerUnitMinor) {}

  static int roundDiv(long numerator, long denominator) {
    return (int) Math.round((double) numerator / (double) denominator);
  }

  /**
   * Price a consumption (milli-units): flat rate, or progressive tiers (each
   * bracket billed at its own rate; the last bracket's ceiling must be null).
   * Returns integer minor units, half-up rounded. Port of {@code tieredChargeMinor}.
   */
  public static int tieredChargeMinor(int consumptionMilli, int unitRateMinor, List<TariffTier> tiers) {
    if (consumptionMilli < 0) {
      throw new IllegalArgumentException("INVALID: consumption must be a non-negative integer");
    }
    if (consumptionMilli == 0) return 0;
    if (tiers != null) {
      if (tiers.isEmpty()) throw new IllegalArgumentException("INVALID: malformed tariff tiers");
      List<TariffTier> sorted = new ArrayList<>(tiers);
      sorted.sort((a, b) -> Long.compare(
          a.upToMilli() == null ? Long.MAX_VALUE : a.upToMilli(),
          b.upToMilli() == null ? Long.MAX_VALUE : b.upToMilli()));
      long priced = 0;
      int total = 0;
      for (TariffTier tier : sorted) {
        long ceiling = tier.upToMilli() == null ? Long.MAX_VALUE : tier.upToMilli();
        long bracket = Math.min(consumptionMilli, ceiling) - priced;
        if (bracket <= 0) break;
        total += roundDiv(bracket * tier.ratePerUnitMinor(), 1000);
        priced += bracket;
        if (priced >= consumptionMilli) break;
      }
      if (priced < consumptionMilli) {
        throw new IllegalArgumentException(
            "INVALID: tiers do not cover the consumption (missing infinite last tier)");
      }
      return total;
    }
    return roundDiv((long) consumptionMilli * unitRateMinor, 1000);
  }

  /** Estimated reading: average of the last 3 readings, flagged estimated. */
  public static int estimateFromHistory(List<Integer> lastValuesMilli) {
    if (lastValuesMilli.size() < 3) {
      throw new IllegalArgumentException("INVALID: estimates need at least 3 prior readings");
    }
    long sum = 0;
    for (int i = 0; i < 3; i++) sum += lastValuesMilli.get(i);
    return (int) Math.round(sum / 3.0);
  }

  /** Spike-detection result: whether it is a spike + the average consumption. */
  public record Spike(boolean anomaly, Integer averageMilli) {}

  /**
   * Spike anomaly: consumption > 2× the average of the previous consumptions (up
   * to the last 6). Needs ≥ 2 history points; the first reading and anything
   * with too little history is never a spike. Port of {@code detectSpike}.
   */
  public static Spike detectSpike(int consumptionMilli, List<Integer> previousConsumptionsMilli) {
    List<Integer> history = previousConsumptionsMilli.size() > 6
        ? previousConsumptionsMilli.subList(0, 6) : previousConsumptionsMilli;
    if (history.size() < 2) return new Spike(false, null);
    long sum = 0;
    for (int v : history) sum += v;
    int avg = (int) Math.round((double) sum / history.size());
    if (avg <= 0) return new Spike(false, avg);
    return new Spike(consumptionMilli > 2 * avg, avg);
  }

  /** Invoice-line label for a computed charge. Port of {@code chargeLabel}. */
  public static String chargeLabel(String meterType, String meterCode, int consumptionMilli,
      String unitLabel, boolean anomaly) {
    String base = meterDisplayName(meterType) + " — " + meterCode + " ("
        + formatMilli(consumptionMilli) + " " + unitLabel + ")";
    return anomaly ? base + " ⚠" : base;
  }
}
