/**
 * M11 Utilities — pure rules: reading math, tier pricing, estimates,
 * anomaly detection, tariff selection. No DB.
 */
import { describe, expect, it } from "vitest";
import {
  detectSpike,
  estimateFromHistory,
  formatMilli,
  isTierList,
  pickTariff,
  tieredChargeMinor,
  toMilli
} from "@/lib/utilities/machines";

describe("reading math (milli-units)", () => {
  it("parses display units into integer milli-units (3 decimals max)", () => {
    expect(toMilli("241.5")).toBe(241500);
    expect(toMilli("0.001")).toBe(1);
    expect(toMilli("1200")).toBe(1_200_000);
    expect(() => toMilli("-5")).toThrow();
    expect(() => toMilli("1.2345")).toThrow();
    expect(() => toMilli("abc")).toThrow();
  });

  it("formats back without trailing zeros", () => {
    expect(formatMilli(241500)).toBe("241.5");
    expect(formatMilli(1_200_000)).toBe("1200");
    expect(formatMilli(1)).toBe("0.001");
  });
});

describe("tieredChargeMinor", () => {
  it("prices flat rates: consumption × rate, half-up to minor units", () => {
    expect(tieredChargeMinor(100_500, { unitRateMinor: 35 })).toBe(3518); // 100.5 kWh × 0.35
    expect(tieredChargeMinor(0, { unitRateMinor: 35 })).toBe(0);
  });

  it("prices progressive tiers per bracket", () => {
    const tariff = {
      unitRateMinor: 0,
      tiers: [
        { upToMilli: 100_000, ratePerUnitMinor: 30 }, // first 100 units at 0.30
        { upToMilli: null, ratePerUnitMinor: 50 } // beyond at 0.50
      ]
    };
    expect(tieredChargeMinor(60_000, tariff)).toBe(1800); // 60 × 30
    expect(tieredChargeMinor(150_000, tariff)).toBe(5500); // 100×30 + 50×50
    expect(isTierList(tariff.tiers)).toBe(true);
    expect(isTierList([{ upToMilli: 100 }])).toBe(false); // missing rate
    expect(isTierList([])).toBe(false);
  });

  it("rejects consumption not covered by tiers (missing infinite bracket)", () => {
    const tariff = { unitRateMinor: 0, tiers: [{ upToMilli: 1000, ratePerUnitMinor: 10 }] };
    expect(() => tieredChargeMinor(2000, tariff)).toThrow(/cover/);
  });
});

describe("estimateFromHistory (§M11 avg of last 3)", () => {
  it("averages the three most recent readings and needs 3", () => {
    expect(estimateFromHistory([100_000, 110_000, 122_000])).toBe(110_667); // avg 110666.67, half-up
    expect(() => estimateFromHistory([100_000, 110_000])).toThrow(/3 prior/);
  });
});

describe("detectSpike (§M11 > 2× average)", () => {
  it("flags consumption above twice the recent average", () => {
    const { anomaly, averageMilli } = detectSpike(500_000, [100_000, 110_000, 90_000]);
    expect(anomaly).toBe(true);
    expect(averageMilli).toBe(100_000);
  });

  it("passes normal consumption and needs 2+ history points", () => {
    expect(detectSpike(120_000, [100_000, 110_000]).anomaly).toBe(false);
    expect(detectSpike(999_999, [100_000]).anomaly).toBe(false); // too little history
    expect(detectSpike(999_999, []).anomaly).toBe(false); // baseline reading
  });
});

describe("pickTariff (property-specific wins, then latest effective)", () => {
  const t = (id: string, propertyId: string | null, from: string) => ({
    id,
    utilityType: "elec",
    propertyId,
    effectiveFrom: new Date(from),
    isActive: true
  });

  it("prefers the property tariff over the organisation default", () => {
    const org = t("org", null, "2026-01-01");
    const prop = t("prop", "P1", "2026-01-01");
    expect(pickTariff([org, prop], "elec", "P1", new Date("2026-06-01"))?.id).toBe("prop");
  });

  it("falls back to the org default and honours effectiveFrom ≤ readAt", () => {
    const old = t("old", null, "2026-01-01");
    const newer = t("new", null, "2026-05-01");
    expect(pickTariff([old, newer], "elec", "P1", new Date("2026-06-01"))?.id).toBe("new");
    expect(pickTariff([newer], "elec", "P1", new Date("2026-04-01"))).toBeNull();
  });

  it("ignores inactive tariffs and other utility types", () => {
    const off = { ...t("off", "P1", "2026-01-01"), isActive: false };
    const water = { ...t("w", "P1", "2026-01-01"), utilityType: "water" };
    expect(pickTariff([off, water], "elec", "P1", new Date("2026-06-01"))).toBeNull();
  });
});
