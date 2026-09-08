package com.rentmanager.finance.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Deposit state machine + settlement math (INTENT.md M10) — a port of
 * {@code src/lib/deposits/machines.ts}. Forward-only: pending → billed → held →
 * settled; a settled deposit stays settled (compensations are new movements,
 * never status rewinds).
 */
public final class DepositMachine {

  public static final List<String> STATUSES = List.of("pending", "billed", "held", "settled");
  public static final List<String> DEDUCTION_REASONS =
      List.of("damage", "cleaning", "unpaid_rent", "other");

  private static final Map<String, Set<String>> TRANSITIONS = Map.of(
      "pending", Set.of("billed"),
      "billed", Set.of("held"),
      "held", Set.of("settled"),
      "settled", Set.of());

  private static final Set<String> SETTLEMENT_LEASE_STATUSES =
      Set.of("notice", "completed", "terminated");

  private DepositMachine() {}

  public static boolean canTransition(String from, String to) {
    return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
  }

  public static boolean isDeductionReason(String v) { return DEDUCTION_REASONS.contains(v); }

  /** Settlement (deduction/refund) opens only in the move-out window. */
  public static boolean leaseAllowsSettlement(String leaseStatus) {
    return SETTLEMENT_LEASE_STATUSES.contains(leaseStatus);
  }

  /**
   * Deduction credit side: damage/cleaning/other are recovered cost (revenue
   * 4900); unpaid_rent settles outstanding receivable (1300) instead of income.
   */
  public static String deductionCreditAccount(String reason) {
    return "unpaid_rent".equals(reason) ? "1300" : "4900";
  }

  /**
   * Installment split: base = floor(total / n), the last installment absorbs the
   * rounding remainder so Σ installments = total exactly.
   */
  public static int[] installmentSplit(int totalMinor, int installments) {
    if (totalMinor <= 0) {
      throw new IllegalArgumentException("deposit total must be a positive integer");
    }
    if (installments < 1 || installments > 12) {
      throw new IllegalArgumentException("installments must be 1..12");
    }
    int base = totalMinor / installments;
    int[] amounts = new int[installments];
    for (int i = 0; i < installments; i++) amounts[i] = base;
    amounts[installments - 1] += totalMinor - base * installments;
    return amounts;
  }
}
