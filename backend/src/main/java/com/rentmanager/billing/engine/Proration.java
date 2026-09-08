package com.rentmanager.billing.engine;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

/**
 * Pure period &amp; proration math (INTENT.md M06) — a port of
 * {@code src/lib/billing/proration.ts}. All dates are UTC; amounts are integer
 * minor units with half-up rounding on positive values only. No side effects, so
 * every branch is unit-testable (RentEngineTest).
 */
public final class Proration {

  private Proration() {}

  public enum Basis {
    CALENDAR, THIRTY_DAY;

    public static Basis parse(String v) {
      return "thirty_day".equals(v) ? THIRTY_DAY : CALENDAR;
    }
  }

  /** Whole days between two instants, exclusive of the end (half-up). */
  public static long daysBetweenExclusive(Instant start, Instant end) {
    return Math.round((end.toEpochMilli() - start.toEpochMilli()) / 86_400_000.0);
  }

  /** Number of days in the UTC month containing {@code date}. */
  public static int daysInMonthUTC(Instant date) {
    ZonedDateTime z = date.atZone(ZoneOffset.UTC);
    return z.toLocalDate().lengthOfMonth();
  }

  /** Half-up round of a non-negative rational a/b. */
  static int roundDiv(long numerator, long denominator) {
    return (int) Math.round((double) numerator / (double) denominator);
  }

  /**
   * Next cycle boundary strictly after {@code from} (or +1 month when {@code
   * from} already sits on a boundary). Cycle day is clamped to 1–28 (Feb-safe).
   */
  public static Instant nextCycleBoundary(Instant from, int billingCycleDay) {
    int day = Math.min(Math.max(billingCycleDay, 1), 28);
    ZonedDateTime f = from.atZone(ZoneOffset.UTC);
    ZonedDateTime sameMonth = ZonedDateTime.of(f.getYear(), f.getMonthValue(), day, 0, 0, 0, 0, ZoneOffset.UTC);
    if (sameMonth.toInstant().isAfter(from)) return sameMonth.toInstant();
    return sameMonth.plusMonths(1).toInstant();
  }

  /** The cycle anchor: the boundary on/before {@code from}. */
  static Instant cycleAnchor(Instant from, int billingCycleDay) {
    int day = Math.min(Math.max(billingCycleDay, 1), 28);
    ZonedDateTime f = from.atZone(ZoneOffset.UTC);
    ZonedDateTime sameMonth = ZonedDateTime.of(f.getYear(), f.getMonthValue(), day, 0, 0, 0, 0, ZoneOffset.UTC);
    if (!sameMonth.toInstant().isAfter(from)) return sameMonth.toInstant();
    return sameMonth.minusMonths(1).toInstant();
  }

  /** UTC midnight of the day containing {@code date}. */
  public static Instant utcMidnight(Instant date) {
    return date.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
  }

  public static Instant addMonthsUTC(Instant date, int months) {
    return date.atZone(ZoneOffset.UTC).plusMonths(months).toInstant();
  }

  /** Result of prorating a full-cycle amount over a partial period. */
  public record Result(int amountMinor, long days, long cycleDays, boolean isFullCycle, String factor) {}

  /**
   * Prorate {@code fullAmountMinor} over [periodStart, periodEnd):
   * full cycle → full amount; calendar → share of the actual days in the
   * period's start month; thirty_day → share of 30.
   */
  public static Result prorate(int fullAmountMinor, Instant periodStart, Instant periodEnd,
      Basis basis, int billingCycleDay) {
    long days = daysBetweenExclusive(periodStart, periodEnd);
    // Cycle length is measured from the anchor (boundary on/before periodStart),
    // not from periodStart, so a mid-month stub is never read as a full cycle.
    Instant anchor = cycleAnchor(periodStart, billingCycleDay);
    long cycleDays = Math.round(
        (nextCycleBoundary(periodStart, billingCycleDay).toEpochMilli() - anchor.toEpochMilli()) / 86_400_000.0);
    if (days >= cycleDays) {
      return new Result(fullAmountMinor, cycleDays, cycleDays, true, "full");
    }
    int denominator = basis == Basis.THIRTY_DAY ? 30 : daysInMonthUTC(periodStart);
    long clamped = Math.max(0, days);
    int amount = roundDiv((long) fullAmountMinor * clamped, denominator);
    return new Result(amount, clamped, cycleDays, false, clamped + "/" + denominator);
  }
}
