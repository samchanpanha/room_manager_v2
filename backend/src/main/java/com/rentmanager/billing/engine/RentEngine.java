package com.rentmanager.billing.engine;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Rent engine (INTENT.md M06) — pure functions {@code (lease, period) → invoice
 * lines}. A port of {@code src/lib/billing/engine.ts}: deterministic and side
 * effect free so the proration / late-fee / dunning edge cases are unit-tested
 * exhaustively (RentEngineTest). Invariant §9.4: total = Σ lines − discount + tax.
 */
public final class RentEngine {

  private RentEngine() {}

  /** A fixed-monthly service that may have an [activeFrom, activeThrough) window. */
  public record ServiceInput(String name, int amountMinor, String pricingModel,
      Instant activeFrom, Instant activeThrough) {}

  /** A pre-priced one-time line (utility read, per-use service, misc fee, credit). */
  public record OneTimeLine(String kind, String name, int unitMinor, int qty) {
    public OneTimeLine(String kind, String name, int unitMinor) { this(kind, name, unitMinor, 1); }
  }

  /** Lease snapshot the engine prices against. */
  public record LeaseInput(int rentMinor, int billingCycleDay, Proration.Basis basis,
      List<ServiceInput> services) {}

  /** One composed invoice line. */
  public record Line(String kind, String name, int qty, int unitMinor, int amountMinor) {}

  public record CompositionInput(LeaseInput lease, Instant periodStart, Instant periodEnd,
      int taxPercentBps, int discountMinor, List<OneTimeLine> oneTimeLines, String periodLabel) {}

  public record CompositionResult(List<Line> lines, int subtotalMinor, int discountMinor,
      int taxMinor, int totalMinor, long days, long cycleDays, boolean isPartial) {}

  /** Compose the invoice body for one lease &amp; billing period. */
  public static CompositionResult composeInvoice(CompositionInput input) {
    if (!input.periodEnd().isAfter(input.periodStart())) {
      throw new IllegalArgumentException("Invalid period: end must be after start");
    }
    LeaseInput lease = input.lease();
    List<Line> lines = new ArrayList<>();

    // Rent line (prorated per basis on partial cycles).
    Proration.Result rent = Proration.prorate(lease.rentMinor(), input.periodStart(),
        input.periodEnd(), lease.basis(), lease.billingCycleDay());
    String basisLabel = lease.basis() == Proration.Basis.THIRTY_DAY ? "30-day" : "calendar";
    String rentName = rent.isFullCycle()
        ? "Rent — " + input.periodLabel()
        : "Rent — " + input.periodLabel() + " (prorated " + rent.factor() + " · " + basisLabel + ")";
    lines.add(new Line("rent", rentName, 1, rent.amountMinor(), rent.amountMinor()));

    // Fixed-monthly services, priced over their overlap with the period on the
    // same denominator the rent proration uses (M12 mid-cycle suspend support).
    int denominator = lease.basis() == Proration.Basis.THIRTY_DAY ? 30 : Proration.daysInMonthUTC(input.periodStart());
    for (ServiceInput svc : lease.services()) {
      if (!"fixed_monthly".equals(svc.pricingModel())) continue;
      Instant from = svc.activeFrom() == null || !svc.activeFrom().isAfter(input.periodStart())
          ? input.periodStart() : svc.activeFrom();
      Instant through = svc.activeThrough() == null || !svc.activeThrough().isBefore(input.periodEnd())
          ? input.periodEnd() : svc.activeThrough();
      if (!through.isAfter(from)) continue; // window closed before this period
      long svcDays = Proration.daysBetweenExclusive(from, through);
      int amount = Proration.roundDiv((long) svc.amountMinor() * svcDays, denominator);
      if (amount <= 0) continue;
      boolean full = amount == svc.amountMinor();
      String name = full
          ? svc.name() + " — " + input.periodLabel()
          : svc.name() + " — " + input.periodLabel() + " (prorated " + svcDays + "/" + denominator + ")";
      lines.add(new Line("service", name, 1, amount, amount));
    }

    // One-time lines (utilities, POS charge-to-room, misc, credits).
    if (input.oneTimeLines() != null) {
      for (OneTimeLine l : input.oneTimeLines()) {
        int qty = l.qty();
        lines.add(new Line(l.kind(), l.name(), qty, l.unitMinor(), l.unitMinor() * qty));
      }
    }

    int subtotal = lines.stream().mapToInt(Line::amountMinor).sum();
    int discount = Math.min(Math.max(0, input.discountMinor()), subtotal);
    int taxable = subtotal - discount;
    int tax = Proration.roundDiv((long) taxable * input.taxPercentBps(), 10_000);
    int total = taxable + tax;
    if (total != subtotal - discount + tax) {
      throw new IllegalStateException("Invariant violated: total != subtotal - discount + tax");
    }
    return new CompositionResult(lines, subtotal, discount, tax, total,
        rent.days(), rent.cycleDays(), !rent.isFullCycle());
  }

  /** Late-fee rule inputs (M06): FIXED → amount; PERCENT → bps of outstanding. */
  public record LateFeeRule(String type, Integer amountMinor, Integer percentBps, Integer capMinor,
      int graceDays) {}

  /**
   * Evaluate a late fee against an outstanding balance (pure). Returns null when
   * the rule yields nothing chargeable. Port of {@code evalLateFee}.
   */
  public static Integer evalLateFee(LateFeeRule rule, int outstandingMinor) {
    if (outstandingMinor <= 0) return null;
    if ("FIXED".equals(rule.type())) {
      int base = rule.amountMinor() == null ? 0 : rule.amountMinor();
      if (base <= 0) return null;
      int capped = rule.capMinor() != null ? Math.min(base, rule.capMinor()) : base;
      return Math.min(capped, outstandingMinor);
    }
    if ("PERCENT".equals(rule.type())) {
      int bps = rule.percentBps() == null ? 0 : rule.percentBps();
      if (bps <= 0) return null;
      int raw = Proration.roundDiv((long) outstandingMinor * bps, 10_000);
      int capped = rule.capMinor() != null ? Math.min(raw, rule.capMinor()) : raw;
      int fee = Math.max(1, capped);
      return Math.min(fee, outstandingMinor);
    }
    return null;
  }

  /** Dunning stage from days past due for the schedule (+3/+7/+14). */
  public static int dunningStage(long daysPastDue, List<Integer> scheduleDays) {
    int stage = 0;
    for (int i = 0; i < scheduleDays.size(); i++) {
      if (daysPastDue >= scheduleDays.get(i)) stage = i + 1;
    }
    return stage;
  }

  private static final DateTimeFormatter DAY_MON_YEAR =
      DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).withZone(ZoneOffset.UTC);

  /**
   * Human period label, e.g. "Aug 15, 2026 – Aug 30, 2026" (the inclusive last
   * day is endExclusive − 1 day). Matches {@code formatPeriodLabel} in the TS
   * service, which renders both endpoints with the year.
   */
  public static String formatPeriodLabel(Instant start, Instant endExclusive) {
    Instant lastDay = endExclusive.minusMillis(86_400_000L);
    return DAY_MON_YEAR.format(start) + " – " + DAY_MON_YEAR.format(lastDay);
  }
}
