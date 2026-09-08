package com.rentmanager.billing.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Invoice state machine (INTENT.md M07) — a port of {@code src/lib/billing/machines.ts}.
 * draft → issued → partial_paid → paid · issued/partial_paid → overdue ·
 * any live state → void (reason required). paid &amp; void are terminal.
 */
public final class InvoiceMachine {

  public static final List<String> STATUSES =
      List.of("draft", "issued", "partial_paid", "paid", "overdue", "void");

  public static final List<String> ITEM_KINDS =
      List.of("rent", "service", "utility", "one_time", "late_fee", "credit", "deposit");

  private static final Map<String, Set<String>> TRANSITIONS = Map.of(
      "draft", Set.of("issued", "void"),
      "issued", Set.of("partial_paid", "paid", "overdue", "void"),
      "partial_paid", Set.of("paid", "overdue", "void"),
      "overdue", Set.of("partial_paid", "paid", "void"),
      "paid", Set.of(),
      "void", Set.of());

  private InvoiceMachine() {}

  public static boolean isStatus(String v) { return STATUSES.contains(v); }

  public static boolean isItemKind(String v) { return ITEM_KINDS.contains(v); }

  public static boolean canTransition(String from, String to) {
    return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
  }
}
