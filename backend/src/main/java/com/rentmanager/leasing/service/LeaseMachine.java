package com.rentmanager.leasing.service;

import java.util.List;
import java.util.Map;

/**
 * Lease state machine (INTENT.md M05) — port of {@code src/lib/leases/machine.ts}:
 * draft → active → notice → terminated | completed.
 */
public final class LeaseMachine {

  private LeaseMachine() {}

  private static final Map<String, List<String>> TRANSITIONS = Map.of(
      "draft", List.of("active"),
      "active", List.of("notice", "terminated", "completed"),
      "notice", List.of("terminated", "completed"),
      "terminated", List.of(),
      "completed", List.of());

  public static boolean canTransition(String from, String to) {
    return TRANSITIONS.getOrDefault(from, List.of()).contains(to);
  }
}
