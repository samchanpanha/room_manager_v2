package com.rentmanager.leasing.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

/**
 * Billing-date math — port of {@code src/lib/leases/billing.ts}:
 * nextBillingDate = first occurrence of billingCycleDay (clamped 1..28) on/after
 * startDate; a start past the cycle day rolls to next month.
 */
public final class BillingDates {

  private BillingDates() {}

  public static Instant computeNextBillingDate(Instant startDate, int billingCycleDay) {
    int day = Math.min(Math.max(billingCycleDay, 1), 28);
    ZonedDateTime start = startDate.atZone(ZoneOffset.UTC);
    ZonedDateTime candidate = ZonedDateTime.of(start.getYear(), start.getMonthValue(), day,
        0, 0, 0, 0, ZoneOffset.UTC);
    if (candidate.toInstant().isBefore(startDate)) {
      candidate = candidate.plusMonths(1);
    }
    return candidate.toInstant();
  }
}
