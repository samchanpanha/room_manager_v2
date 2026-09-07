package com.rentmanager.billing.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Payment state machine (INTENT.md M09) — a port of {@code src/lib/payments/machines.ts}.
 * pending → confirmed → refunded · pending → failed. refunded &amp; failed are terminal.
 */
public final class PaymentMachine {

  public static final List<String> STATUSES =
      List.of("pending", "confirmed", "refunded", "failed");

  public static final List<String> METHODS =
      List.of("cash", "bank_transfer", "qr", "card", "cheque");

  private static final Map<String, Set<String>> TRANSITIONS = Map.of(
      "pending", Set.of("confirmed", "failed"),
      "confirmed", Set.of("refunded"),
      "refunded", Set.of(),
      "failed", Set.of());

  private PaymentMachine() {}

  public static boolean isStatus(String v) { return STATUSES.contains(v); }

  public static boolean isMethod(String v) { return METHODS.contains(v); }

  public static boolean canTransition(String from, String to) {
    return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
  }

  /** Cash-drawer accounts: cash &amp; cheque land in 1100, everything else 1200. */
  public static String settlementAccountCode(String method) {
    return "cash".equals(method) || "cheque".equals(method) ? "1100" : "1200";
  }
}
