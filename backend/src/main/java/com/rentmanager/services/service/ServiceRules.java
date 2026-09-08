package com.rentmanager.services.service;

import java.util.List;

/** Services pure rules (INTENT.md M12) — pricing-model validation + code shape. */
public final class ServiceRules {

  private ServiceRules() {}

  public static final List<String> PRICING_MODELS = List.of("fixed_monthly", "per_use", "metered");

  public static boolean isPricingModel(String v) { return PRICING_MODELS.contains(v); }

  /** Catalog code shape: 2–20 chars of A–Z, 0–9 and dash. */
  public static boolean isValidCode(String code) {
    return code != null && code.matches("[A-Z0-9-]{2,20}");
  }

  /**
   * Parse a per-use quantity (display units, e.g. "2.5", up to 3 decimals) into
   * milli-units (×1000). Mirrors the M11 {@code toMilli} used by the TS service.
   */
  public static int toMilli(String display) {
    String s = display == null ? "" : display.trim();
    if (!s.matches("\\d+(\\.\\d{1,3})?")) {
      throw new IllegalArgumentException("INVALID: qty must be a non-negative number with up to 3 decimals");
    }
    String[] parts = s.split("\\.");
    String frac = parts.length > 1 ? parts[1] : "";
    while (frac.length() < 3) frac += "0";
    return Integer.parseInt(parts[0]) * 1000 + Integer.parseInt(frac);
  }

  /** Format milli-units for display, trimming trailing zeros ("2500" → "2.5"). */
  public static String formatMilli(int milli) {
    return java.math.BigDecimal.valueOf(milli, 3).stripTrailingZeros().toPlainString();
  }
}
