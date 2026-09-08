package com.rentmanager.inventory.pos.service;

/**
 * EAN-13 barcode helpers (INTENT.md M14) — port of the check-digit + normalize
 * logic in {@code src/lib/barcode.ts}. Rendering (SVG/PNG bars) is deferred with
 * the label-printing endpoint (M17/print); only validation is needed here.
 */
public final class Ean13 {

  private Ean13() {}

  /** EAN-13 check digit for the first 12 digits (odd positions ×1, even ×3). */
  public static int checkDigit(String code) {
    int sum = 0;
    for (int i = 0; i < 12; i++) {
      int d = code.charAt(i) - '0';
      sum += (i % 2 == 0) ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  /**
   * Accepts 12 or 13 digits; returns the normalized 13-digit EAN-13 (computing
   * the check digit for 12) or {@code null} if invalid / check-digit mismatch.
   */
  public static String normalize(String raw) {
    if (raw == null) return null;
    String digits = raw.replaceAll("\\D", "");
    if (digits.length() == 12) return digits + checkDigit(digits);
    if (digits.length() == 13 && (digits.charAt(12) - '0') == checkDigit(digits.substring(0, 12))) {
      return digits;
    }
    return null;
  }
}
