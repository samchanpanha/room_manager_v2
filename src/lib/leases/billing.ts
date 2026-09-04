/// Billing-date math for leases (Phase 6 rent engine expands on this).
/// nextBillingDate = first occurrence of billingCycleDay on/after startDate
/// (advance billing); mid-month starts later than the cycle day roll to the
/// next month.
export function computeNextBillingDate(startDate: Date, billingCycleDay: number): Date {
  const day = Math.min(Math.max(billingCycleDay, 1), 28);
  const candidate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), day));
  if (candidate.getTime() < startDate.getTime()) {
    return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, day));
  }
  return candidate;
}
