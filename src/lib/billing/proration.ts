/// Pure period & proration math (M06). All dates UTC; integer minor units;
/// half-up rounding via Math.round on positive values only.

export function daysBetweenExclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function daysInMonthUTC(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

/// Next cycle boundary strictly after `from` (or +1 month when `from` sits on
/// a boundary). Cycle day clamped to 1–28 (Feb-safe).
export function nextCycleBoundary(from: Date, billingCycleDay: number): Date {
  const day = Math.min(Math.max(billingCycleDay, 1), 28);
  const sameMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day));
  if (sameMonth.getTime() > from.getTime()) return sameMonth;
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, day));
}

export type ProrationBasis = "calendar" | "thirty_day";

export function isProrationBasis(v: string): v is ProrationBasis {
  return v === "calendar" || v === "thirty_day";
}

export interface ProrationResult {
  amountMinor: number;
  days: number;
  cycleDays: number;
  isFullCycle: boolean;
  factor: string; // human-readable exact factor, e.g. "17/31"
}

/// Prorate `fullAmountMinor` over [periodStart, periodEnd).
///  - full cycle (days === cycleDays) → full amount
///  - calendar basis → share of the actual days in the period's start month
///  - thirty_day basis → share of 30
export function prorate(
  fullAmountMinor: number,
  periodStart: Date,
  periodEnd: Date,
  basis: ProrationBasis,
  billingCycleDay: number
): ProrationResult {
  const days = daysBetweenExclusive(periodStart, periodEnd);
  // Cycle length is measured from the cycle ANCHOR (the boundary on/before
  // periodStart), not from periodStart itself — otherwise a mid-month stub
  // (e.g. Aug 15 → Sep 1 on a day-1 cycle) would read as a "full cycle".
  const day = Math.min(Math.max(billingCycleDay, 1), 28);
  const sameMonthMs = Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), day);
  const anchorMs = sameMonthMs <= periodStart.getTime() ? sameMonthMs : Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, day);
  const cycleDays = Math.round((nextCycleBoundary(periodStart, billingCycleDay).getTime() - anchorMs) / 86_400_000);
  if (days >= cycleDays) {
    return { amountMinor: fullAmountMinor, days: cycleDays, cycleDays, isFullCycle: true, factor: "full" };
  }
  const denominator = basis === "thirty_day" ? 30 : daysInMonthUTC(periodStart);
  const clamped = Math.max(0, days);
  return {
    amountMinor: Math.round((fullAmountMinor * clamped) / denominator),
    days: clamped,
    cycleDays,
    isFullCycle: false,
    factor: `${clamped}/${denominator}`
  };
}

export function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
