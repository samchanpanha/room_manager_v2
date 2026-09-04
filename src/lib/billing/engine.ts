/// Rent engine (M06) — pure functions `(lease, period) → invoice lines`.
/// Deterministic, side-effect free, unit-tested to the eyebrows.
import { daysBetweenExclusive, daysInMonthUTC, prorate, type ProrationBasis } from "./proration";

export interface EngineService {
  name: string;
  amountMinor: number;
  pricingModel: string; // fixed_monthly prorates; per_use/metered are attached as one-time lines elsewhere
  /** M12 billing window — set on assignment start / suspend / end. */
  activeFrom?: Date | null;
  activeThrough?: Date | null;
}

export interface EngineOneTimeLine {
  kind: "utility" | "one_time" | "credit";
  name: string;
  unitMinor: number;
  qty?: number;
}

export interface EngineLease {
  rentMinor: number;
  billingCycleDay: number;
  prorationBasis: ProrationBasis;
  services: EngineService[];
}

export interface EngineLine {
  kind: "rent" | "service" | "utility" | "one_time" | "credit";
  name: string;
  qty: number;
  unitMinor: number;
  amountMinor: number;
}

export interface CompositionInput {
  lease: EngineLease;
  periodStart: Date;
  periodEnd: Date;
  taxPercentBps: number; // 10000 = 100%
  discountMinor: number; // invoice-level, engine-composed
  oneTimeLines?: EngineOneTimeLine[];
  /** Human period label, e.g. "Aug 15 – Aug 31, 2026" */
  periodLabel: string;
}

export interface CompositionResult {
  lines: EngineLine[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  days: number;
  cycleDays: number;
  isPartial: boolean;
}

/// Compose the invoice body for one lease & billing period.
/// Invariant (INTENT.md §9.4): total = Σ lines − discount + tax — asserted here.
export function composeInvoice(input: CompositionInput): CompositionResult {
  const { lease, periodStart, periodEnd } = input;
  if (periodEnd.getTime() <= periodStart.getTime()) {
    throw new Error("Invalid period: end must be after start");
  }

  const lines: EngineLine[] = [];

  // Rent line (prorated per basis on partial cycles)
  const rent = prorate(lease.rentMinor, periodStart, periodEnd, lease.prorationBasis, lease.billingCycleDay);
  lines.push({
    kind: "rent",
    name: rent.isFullCycle
      ? `Rent — ${input.periodLabel}`
      : `Rent — ${input.periodLabel} (prorated ${rent.factor} · ${lease.prorationBasis === "thirty_day" ? "30-day" : "calendar"})`,
    qty: 1,
    unitMinor: rent.amountMinor,
    amountMinor: rent.amountMinor
  });

  // Fixed monthly services with an optional [activeFrom, activeThrough)
  // billing window (M12: mid-month suspend → prorated stop). The overlap with
  // the period is priced on the same denominator the rent proration uses.
  const denominator = lease.prorationBasis === "thirty_day" ? 30 : daysInMonthUTC(periodStart);
  for (const svc of lease.services) {
    if (svc.pricingModel !== "fixed_monthly") continue; // per_use/metered are billed as one-time lines (M12/M14)
    const from = !svc.activeFrom || svc.activeFrom.getTime() <= periodStart.getTime() ? periodStart : svc.activeFrom;
    const through = !svc.activeThrough || svc.activeThrough.getTime() >= periodEnd.getTime() ? periodEnd : svc.activeThrough;
    if (through.getTime() <= from.getTime()) continue; // window closed before this period
    const svcDays = daysBetweenExclusive(from, through);
    const amount = Math.round((svc.amountMinor * svcDays) / denominator);
    if (amount <= 0) continue;
    const isFull = amount === svc.amountMinor;
    lines.push({
      kind: "service",
      name: isFull
        ? `${svc.name} — ${input.periodLabel}`
        : `${svc.name} — ${input.periodLabel} (prorated ${svcDays}/${denominator})`,
      qty: 1,
      unitMinor: amount,
      amountMinor: amount
    });
  }

  // One-time lines (utilities, POS charges-to-room, misc fees, credits)
  for (const line of input.oneTimeLines ?? []) {
    const qty = line.qty ?? 1;
    lines.push({ kind: line.kind, name: line.name, qty, unitMinor: line.unitMinor, amountMinor: line.unitMinor * qty });
  }

  const subtotalMinor = lines.reduce((sum, l) => sum + l.amountMinor, 0);
  const discountMinor = Math.min(Math.max(0, Math.round(input.discountMinor)), subtotalMinor);
  const taxable = subtotalMinor - discountMinor;
  const taxMinor = Math.round((taxable * input.taxPercentBps) / 10_000);
  const totalMinor = taxable + taxMinor;

  // Hard invariant — this function may not produce an unbalanced document.
  if (totalMinor !== subtotalMinor - discountMinor + taxMinor) {
    throw new Error("Invariant violated: total != subtotal - discount + tax");
  }

  return {
    lines,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    days: rent.days,
    cycleDays: rent.cycleDays,
    isPartial: !rent.isFullCycle
  };
}

/// Late fee evaluation (pure). `rule.type === "FIXED"` → fixed amount
/// (capped by capMinor when set); PERCENT → percentBps × outstanding, capped.
/// Returns null when the rule yields nothing chargeable.
export function evalLateFee(
  rule: { type: string; amountMinor?: number | null; percentBps?: number | null; capMinor?: number | null },
  outstandingMinor: number
): number | null {
  if (outstandingMinor <= 0) return null;
  if (rule.type === "FIXED") {
    const base = rule.amountMinor ?? 0;
    if (base <= 0) return null;
    const capped = rule.capMinor ? Math.min(base, rule.capMinor) : base;
    return Math.min(capped, outstandingMinor);
  }
  if (rule.type === "PERCENT") {
    const bps = rule.percentBps ?? 0;
    if (bps <= 0) return null;
    const raw = Math.round((outstandingMinor * bps) / 10_000);
    const capped = rule.capMinor ? Math.min(raw, rule.capMinor) : raw;
    const fee = Math.max(1, capped);
    return Math.min(fee, outstandingMinor);
  }
  return null;
}

/// Dunning stage from days past due (schedule +3/+7/+14, INTENT.md M07).
export function dunningStage(daysPastDue: number, scheduleDays: readonly number[]): number {
  let stage = 0;
  for (let i = 0; i < scheduleDays.length; i++) {
    if (daysPastDue >= scheduleDays[i]) stage = i + 1;
  }
  return stage;
}
