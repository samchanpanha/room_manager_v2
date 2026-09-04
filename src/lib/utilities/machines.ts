/// Utilities (M11) — pure rules: reading math, tier pricing, estimates,
/// anomaly detection, tariff selection. All integer math; readings are
/// milli-units (×1000) so 241.5 kWh is stored as 241500.

export const METER_TYPES = ["elec", "water", "gas"] as const;
export type MeterType = (typeof METER_TYPES)[number];

export function isMeterType(v: string): v is MeterType {
  return (METER_TYPES as readonly string[]).includes(v);
}

export function meterDisplayName(type: string): string {
  return type === "elec" ? "Electricity" : type === "water" ? "Water" : "Gas";
}

/// Parse a display-unit reading ("241.5", up to 3 decimals) into milli-units.
export function toMilli(display: string | number): number {
  const s = String(display).trim();
  if (!/^\d+(\.\d{1,3})?$/.test(s)) throw new Error("INVALID: reading must be a non-negative number with up to 3 decimals");
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 1000 + Number(frac.padEnd(3, "0"));
}

export function fromMilli(milli: number): number {
  return milli / 1000;
}

/// Format milli-units for display, trimming trailing zeros ("241500" → "241.5").
export function formatMilli(milli: number): string {
  return String(Number((milli / 1000).toFixed(3)));
}

export interface TariffTier {
  upToMilli: number | null; // cumulative ceiling in milli-units, null = infinity
  ratePerUnitMinor: number; // minor per 1 whole unit
}

/// Validate a tiers payload (stored as JSON on Tariff).
export function isTierList(v: unknown): v is TariffTier[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every(
    (t) =>
      typeof t === "object" &&
      t !== null &&
      "upToMilli" in t &&
      "ratePerUnitMinor" in t &&
      (t.upToMilli === null || (typeof t.upToMilli === "number" && Number.isInteger(t.upToMilli) && t.upToMilli > 0)) &&
      typeof t.ratePerUnitMinor === "number" &&
      Number.isInteger(t.ratePerUnitMinor) &&
      t.ratePerUnitMinor >= 0
  );
}

/// Price a consumption in milli-units: flat rate, or progressive tiers
/// (each bracket billed at its own rate; last bracket's ceiling must be null).
/// Returns integer minor units, half-up rounded.
export function tieredChargeMinor(
  consumptionMilli: number,
  tariff: { unitRateMinor: number; tiers?: unknown }
): number {
  if (!Number.isInteger(consumptionMilli) || consumptionMilli < 0) {
    throw new Error("INVALID: consumption must be a non-negative integer (milli-units)");
  }
  if (consumptionMilli === 0) return 0;
  if (tariff.tiers != null) {
    if (!isTierList(tariff.tiers)) throw new Error("INVALID: malformed tariff tiers");
    const tiers = [...tariff.tiers].sort((a, b) => (a.upToMilli ?? Infinity) - (b.upToMilli ?? Infinity));
    let priced = 0; // milli-units already priced
    let total = 0;
    for (const tier of tiers) {
      const ceiling = tier.upToMilli ?? Infinity;
      const bracket = Math.min(consumptionMilli, ceiling) - priced;
      if (bracket <= 0) break;
      total += Math.round((bracket * tier.ratePerUnitMinor) / 1000);
      priced += bracket;
      if (priced >= consumptionMilli) break;
    }
    if (priced < consumptionMilli) throw new Error("INVALID: tiers do not cover the consumption (missing infinite last tier)");
    return total;
  }
  return Math.round((consumptionMilli * tariff.unitRateMinor) / 1000);
}

/// Estimated reading (§M11): average of the last 3 readings, flagged estimated.
export function estimateFromHistory(lastValuesMilli: number[]): number {
  if (lastValuesMilli.length < 3) throw new Error("INVALID: estimates need at least 3 prior readings");
  const last3 = lastValuesMilli.slice(0, 3);
  return Math.round(last3.reduce((s, v) => s + v, 0) / 3);
}

/// Spike anomaly (§M11): consumption > 2× the average of the previous
/// consumptions (up to the last 6). Needs ≥ 2 history points; the first
/// reading (baseline) and anything with too little history is never a spike.
export function detectSpike(
  consumptionMilli: number,
  previousConsumptionsMilli: number[]
): { anomaly: boolean; averageMilli: number | null } {
  const history = previousConsumptionsMilli.slice(0, 6);
  if (history.length < 2) return { anomaly: false, averageMilli: null };
  const avg = Math.round(history.reduce((s, v) => s + v, 0) / history.length);
  if (avg <= 0) return { anomaly: false, averageMilli: avg };
  return { anomaly: consumptionMilli > 2 * avg, averageMilli: avg };
}

export interface TariffCandidate {
  id: string;
  utilityType: string;
  propertyId: string | null;
  effectiveFrom: Date;
  isActive: boolean;
}

/// Pick the tariff for a reading: property-specific wins over organisation
/// default; among equals the latest effectiveFrom ≤ `at` wins (§M11).
export function pickTariff<T extends TariffCandidate>(candidates: T[], utilityType: string, propertyId: string, at: Date): T | null {
  const eligible = candidates.filter(
    (t) => t.isActive && t.utilityType === utilityType && t.effectiveFrom.getTime() <= at.getTime()
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const pa = a.propertyId === propertyId ? 1 : 0;
    const pb = b.propertyId === propertyId ? 1 : 0;
    if (pa !== pb) return pb - pa; // property-specific first
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });
  return eligible[0];
}
