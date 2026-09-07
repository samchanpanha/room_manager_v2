package com.rentmanager.finance.ledger.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure posting builders (INTENT.md M08) — a port of {@code src/lib/ledger/postings.ts}.
 * Domain facts → balanced double-entry lines. No DB access; plain data so the
 * balance invariant is unit-testable. All amounts are integer minor units.
 */
public final class Postings {

  private Postings() {}

  /** One double-entry line (exactly one of debit/credit is positive). */
  public static final class Line {
    public final String code;
    public int debit;
    public int credit;
    public final String memo;

    public Line(String code, int debit, int credit, String memo) {
      this.code = code;
      this.debit = debit;
      this.credit = credit;
      this.memo = memo;
    }

    public static Line debit(String code, int amount, String memo) { return new Line(code, amount, 0, memo); }
    public static Line credit(String code, int amount, String memo) { return new Line(code, 0, amount, memo); }
  }

  /** An aggregated invoice item for revenue splitting. */
  public record Item(String kind, int amountMinor) {}

  /** Sanity guard: a balanced, non-empty, single-sided set. */
  public static void assertBalanced(List<Line> lines) {
    if (lines.size() < 2) {
      throw new IllegalStateException("UNBALANCED: a posting needs at least a debit and a credit line");
    }
    long debits = 0;
    long credits = 0;
    for (Line l : lines) {
      if (l.debit < 0 || l.credit < 0) {
        throw new IllegalStateException("UNBALANCED: invalid line amounts for " + l.code);
      }
      if ((l.debit > 0) == (l.credit > 0)) {
        throw new IllegalStateException("UNBALANCED: line " + l.code + " must be exactly one of debit/credit");
      }
      debits += l.debit;
      credits += l.credit;
    }
    if (debits == 0 || debits != credits) {
      throw new IllegalStateException("UNBALANCED: Σ debits " + debits + " != Σ credits " + credits);
    }
  }

  /**
   * Half-up proportional allocation of {@code total} across positive
   * {@code weights}, largest-remainder fix-up so Σshares = total exactly.
   */
  public static int[] allocateProportional(int total, int[] weights) {
    int[] shares = new int[weights.length];
    long sum = 0;
    for (int w : weights) sum += w;
    if (weights.length == 0 || sum <= 0) return shares;
    long allocated = 0;
    for (int i = 0; i < weights.length; i++) {
      shares[i] = (int) Math.round((double) total * weights[i] / sum);
      allocated += shares[i];
    }
    int diff = (int) (total - allocated);
    if (diff != 0) {
      // Distribute the residual one minor unit at a time, largest weights first
      // (ties by index) — deterministic and keeps big categories whole.
      Integer[] order = new Integer[weights.length];
      for (int i = 0; i < weights.length; i++) order[i] = i;
      java.util.Arrays.sort(order, (a, b) -> weights[b] != weights[a] ? weights[b] - weights[a] : a - b);
      int sign = diff > 0 ? 1 : -1;
      for (int k = 0; k < Math.abs(diff); k++) {
        shares[order[k % order.length]] += sign;
      }
    }
    return shares;
  }

  /**
   * Invoice issue (accrual basis): DR 1300 Rent Receivable with the invoice
   * total; CR revenue by item kind with the invoice-level discount prorated
   * across kinds (largest-remainder); tax → 2300 Tax Payable.
   */
  public static List<Line> invoiceIssueLines(int totalMinor, int discountMinor, int taxMinor, List<Item> items) {
    if (totalMinor <= 0) throw new IllegalStateException("UNBALANCED: invoice total must be positive");
    Map<String, Integer> byKind = new LinkedHashMap<>();
    for (Item item : items) {
      if (item.amountMinor() < 0) {
        throw new IllegalStateException("UNBALANCED: negative item amount (" + item.kind() + ")");
      }
      byKind.merge(item.kind(), item.amountMinor(), Integer::sum);
    }
    List<String> kinds = new ArrayList<>(byKind.keySet());
    int[] gross = new int[kinds.size()];
    for (int i = 0; i < kinds.size(); i++) gross[i] = byKind.get(kinds.get(i));
    int[] discounts = allocateProportional(discountMinor, gross);

    List<Line> lines = new ArrayList<>();
    lines.add(Line.debit(ChartOfAccounts.RENT_RECEIVABLE, totalMinor, null));
    for (int i = 0; i < kinds.size(); i++) {
      int net = gross[i] - discounts[i];
      if (net <= 0) continue; // fully-discounted category contributes nothing
      String code = ChartOfAccounts.creditAccountForKind(kinds.get(i));
      Line existing = null;
      for (Line l : lines) {
        if (l.code.equals(code) && l.credit > 0) { existing = l; break; }
      }
      if (existing != null) existing.credit += net;
      else lines.add(Line.credit(code, net, null));
    }
    if (taxMinor > 0) {
      lines.add(Line.credit(ChartOfAccounts.TAX_PAYABLE, taxMinor, "Output tax"));
    }
    assertBalanced(lines);
    return lines;
  }

  /** Late fee: DR 1300 (the member now owes more), CR 4300 Late Fee Revenue. */
  public static List<Line> lateFeeLines(int amountMinor, String invoiceCode) {
    List<Line> lines = new ArrayList<>();
    lines.add(Line.debit(ChartOfAccounts.RENT_RECEIVABLE, amountMinor, null));
    lines.add(Line.credit(ChartOfAccounts.LATE_FEE_REVENUE, amountMinor, "Late fee on " + invoiceCode));
    assertBalanced(lines);
    return lines;
  }

  /**
   * Credit note against an invoice's original revenue allocation: DR revenue
   * pro-rata of the issue posting's revenue lines, CR 1300. Falls back to Other
   * Revenue when no original posting exists (pre-ledger invoices).
   */
  public static List<Line> creditNoteLines(List<Line> originalRevenue, int amountMinor) {
    if (amountMinor <= 0) throw new IllegalStateException("UNBALANCED: credit amount must be positive");
    List<Line> live = new ArrayList<>();
    for (Line l : originalRevenue) if (l.credit > 0) live.add(l);
    List<Line> lines = new ArrayList<>();
    if (live.isEmpty()) {
      lines.add(Line.debit(ChartOfAccounts.OTHER_REVENUE, amountMinor, "Credit note (no original posting)"));
    } else {
      int[] weights = new int[live.size()];
      for (int i = 0; i < live.size(); i++) weights[i] = live.get(i).credit;
      int[] shares = allocateProportional(amountMinor, weights);
      for (int i = 0; i < live.size(); i++) {
        if (shares[i] <= 0) continue;
        lines.add(Line.debit(live.get(i).code, shares[i], "Credit note"));
      }
    }
    lines.add(Line.credit(ChartOfAccounts.RENT_RECEIVABLE, amountMinor, null));
    assertBalanced(lines);
    return lines;
  }

  /** Mirror of a balanced posting (swap debit/credit per line) — §9.3 reversals. */
  public static List<Line> reversalLines(List<Line> lines) {
    List<Line> out = new ArrayList<>();
    for (Line l : lines) {
      if (l.credit > 0) out.add(Line.debit(l.code, l.credit, l.memo));
      else out.add(Line.credit(l.code, l.debit, l.memo));
    }
    assertBalanced(out);
    return out;
  }
}
