package com.rentmanager.billing.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Pure allocation math (INTENT.md M09, §9.5) — a port of
 * {@code src/lib/payments/allocation.ts}. Applies a payment across a member's
 * open invoices oldest-first; Σ allocations ≤ amount; the remainder stays member
 * credit. No DB access — deterministic and unit-tested.
 */
public final class PaymentAllocator {

  private PaymentAllocator() {}

  /** An open invoice candidate for allocation (due &gt; 0). */
  public record OpenInvoice(String id, int dueMinor, Instant dueDate, Instant periodStart) {}

  /** A single allocation of money onto an invoice. */
  public record Allocation(String invoiceId, int amountMinor) {}

  /** Result of an oldest-first allocation pass. */
  public record Result(List<Allocation> allocations, int remainderMinor) {}

  /**
   * Sort open invoices oldest-first (due date, then period start) and consume
   * the payment amount against their outstanding dues (FIFO, capped per invoice).
   */
  public static Result allocateOldestFirst(List<OpenInvoice> openInvoices, int amountMinor) {
    if (amountMinor <= 0) return new Result(List.of(), 0);
    List<OpenInvoice> ordered = new ArrayList<>(openInvoices.stream()
        .filter(i -> i.dueMinor() > 0)
        .toList());
    ordered.sort(Comparator
        .comparing((OpenInvoice i) -> i.dueDate() != null ? i.dueDate() : i.periodStart())
        .thenComparing(OpenInvoice::periodStart));

    int left = amountMinor;
    List<Allocation> allocations = new ArrayList<>();
    for (OpenInvoice inv : ordered) {
      if (left <= 0) break;
      int applied = Math.min(left, inv.dueMinor());
      allocations.add(new Allocation(inv.id(), applied));
      left -= applied;
    }
    return new Result(allocations, left);
  }

  /**
   * Validate explicit allocations from API input: every share positive, no
   * duplicate invoice, Σ ≤ amount. Per-invoice caps and membership are checked
   * against the DB in the service. Returns null when valid, else the message.
   */
  public static String validateExplicit(List<Allocation> allocations, int amountMinor) {
    int sum = 0;
    Set<String> seen = new HashSet<>();
    for (Allocation a : allocations) {
      if (a.amountMinor() <= 0) {
        return "Allocation amounts must be positive integers (minor units)";
      }
      if (!seen.add(a.invoiceId())) {
        return "Duplicate invoice in allocations";
      }
      sum += a.amountMinor();
    }
    if (sum > amountMinor) {
      return "Allocations exceed the payment amount";
    }
    return null;
  }
}
