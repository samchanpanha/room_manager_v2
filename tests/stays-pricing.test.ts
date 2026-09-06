/// M32 pricing engine (§M32 "Short Stays"): pure duration-bucket math.
/// Both strategies agree inside the ladder (first covering bucket wins); beyond
/// the last bucket they diverge — progressive plateaus at the top price,
/// blended bills whole 24h days + the cheapest remainder bucket (capped at the
/// next whole day).
import { describe, expect, it } from "vitest";
import {
  DAY_MINUTES,
  STAY_MINUTES,
  normalizeStrategy,
  priceBreakdown,
  priceStay,
  progressiveBucketPrice
} from "@/lib/operations/stay-service";
import type { RateBucket } from "@/lib/operations/stay-service";

const ladder: RateBucket[] = [
  { id: "r1", toMinutes: 240, priceMinor: 1800 },
  { id: "r2", toMinutes: 480, priceMinor: 3000 },
  { id: "r3", toMinutes: DAY_MINUTES, priceMinor: 8000 }
];

describe("M32 priceStay", () => {
  it("agrees for every stay inside the ladder: first covering bucket wins", () => {
    for (const mins of [60, 240, 300, 480, 720, 1440]) {
      expect(priceStay(ladder, mins, "progressive")).toBe(priceStay(ladder, mins, "blended"));
    }
    expect(priceStay(ladder, 300, "progressive")).toBe(3000); // ≤8h bucket, not 2×4h
    expect(priceStay(ladder, 60, "progressive")).toBe(1800); // falls into the ≤4h bucket
    expect(priceStay(ladder, 1440, "progressive")).toBe(8000); // a full day = the day bucket
  });

  it("progressive plateaus at the top bucket beyond the ladder", () => {
    expect(priceStay(ladder, 2000, "progressive")).toBe(8000);
    expect(priceStay(ladder, 2880, "progressive")).toBe(8000);
    expect(priceStay(ladder, 5000, "progressive")).toBe(8000);
  });

  it("blended bills whole days + cheapest remainder, capped at the next day", () => {
    // 25h = 1 day (8000) + 1h remainder → ≤4h bucket 1800 → 9800 (< cap 16000).
    expect(priceStay(ladder, 1500, "blended")).toBe(8000 + 1800);
    // 33h = 1 day + 9h remainder → ≤24h bucket → 16000 = exactly 2 days (cap equal).
    expect(priceStay(ladder, 1980, "blended")).toBe(8000 + 8000);
    // 2 full days = 16000, and the next-day cap never makes it cheaper.
    expect(priceStay(ladder, 2880, "blended")).toBe(16000);
    // A span just under a full extra day must still beat paying for that day:
    expect(priceStay(ladder, 1439 + 1440, "blended")).toBeLessThan(24000);
  });

  it("blended diverges from progressive only beyond the ladder", () => {
    // A 33⅓h stay (2000 min): progressive caps at one day (8000), blended bills
    // 1 day + the 9⅓h remainder (8000) — the overstay actually costs.
    expect(priceStay(ladder, 2000, "progressive")).toBe(8000);
    expect(priceStay(ladder, 2000, "blended")).toBeGreaterThan(8000);
  });

  it("falls back to the last bucket when no 1440 (day) bucket exists", () => {
    const noDay = ladder.filter((b) => b.toMinutes !== DAY_MINUTES);
    expect(priceStay(noDay, 2000, "blended")).toBe(3000);
    expect(priceStay(noDay, 2000, "progressive")).toBe(3000);
  });

  it("is zero-safe on an empty ladder and indistinguishable from itself", () => {
    expect(priceStay([], 500, "progressive")).toBe(0);
    expect(priceStay([], 500, "blended")).toBe(0);
    expect(progressiveBucketPrice(ladder, 2000)).toBe(priceStay(ladder, 2000, "progressive"));
    expect(progressiveBucketPrice(ladder, 300)).toBe(3000);
  });
});

describe("M32 priceBreakdown", () => {
  it("attributes in-ladder stays to the covering bucket", () => {
    expect(priceBreakdown(ladder, 300, "progressive")).toEqual({ hitToMinutes: 480, dayCount: 0, remainderMinutes: 0 });
    expect(priceBreakdown(ladder, 300, "blended")).toEqual({ hitToMinutes: 480, dayCount: 0, remainderMinutes: 0 });
  });

  it("attributes progressive overstays to the top bucket plateau", () => {
    expect(priceBreakdown(ladder, 2000, "progressive")).toEqual({ hitToMinutes: 1440, dayCount: 0, remainderMinutes: 0 });
  });

  it("splits blended overstays into days + remainder", () => {
    expect(priceBreakdown(ladder, 1500, "blended")).toEqual({ hitToMinutes: 0, dayCount: 1, remainderMinutes: 60 });
    expect(priceBreakdown(ladder, 2000, "blended")).toEqual({ hitToMinutes: 0, dayCount: 1, remainderMinutes: 560 });
    expect(priceBreakdown(ladder, 2880, "blended")).toEqual({ hitToMinutes: 0, dayCount: 2, remainderMinutes: 0 });
  });
});

describe("M32 strategy normalization", () => {
  it("maps only 'blended' specially and defaults everything else to progressive", () => {
    expect(normalizeStrategy("blended")).toBe("blended");
    expect(normalizeStrategy("progressive")).toBe("progressive");
    expect(normalizeStrategy(undefined)).toBe("progressive");
    expect(normalizeStrategy("")).toBe("progressive");
    expect(normalizeStrategy("something-else")).toBe("progressive");
  });
});

describe("M32 constants", () => {
  it("defines the day/minute unit contracts used by pricing", () => {
    expect(STAY_MINUTES).toBe(60_000);
    expect(DAY_MINUTES).toBe(1440);
    expect(DAY_MINUTES).toBe(24 * 60);
  });
});