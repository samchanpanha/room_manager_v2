/**
 * M12 Services — engine window math: fixed_monthly lines with
 * [activeFrom, activeThrough) billing windows (mid-month suspend → prorated
 * stop). Backward compatibility with the Phase-6 proration is asserted too.
 */
import { describe, expect, it } from "vitest";
import { composeInvoice, type EngineLease } from "@/lib/billing/engine";

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const baseLease: EngineLease = {
  rentMinor: 25000,
  billingCycleDay: 1,
  prorationBasis: "calendar",
  services: []
};

function linesFor(lease: EngineLease, start: string, end: string) {
  return composeInvoice({
    lease,
    periodStart: D(start),
    periodEnd: D(end),
    taxPercentBps: 0,
    discountMinor: 0,
    periodLabel: "test",
  }).lines;
}

describe("fixed service windows (M12)", () => {
  it("full window on a full cycle bills the full price (unchanged behaviour)", () => {
    const lines = linesFor({ ...baseLease, services: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }] }, "2026-09-01", "2026-10-01");
    expect(lines.find((l) => l.kind === "service")?.amountMinor).toBe(1500);
    expect(lines.find((l) => l.kind === "service")?.name).toBe("WiFi — test");
  });

  it("Phase-6 stub compatibility: no window → prorates with the rent factor (17/31)", () => {
    const lines = linesFor({ ...baseLease, services: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }] }, "2026-08-15", "2026-09-01");
    const wifi = lines.find((l) => l.kind === "service");
    expect(wifi?.amountMinor).toBe(823); // 1500 × 17/31
    expect(wifi?.name).toContain("(prorated 17/31)");
  });

  it("mid-month suspend prorates the stop (§M12 acceptance): Sep 1–10 of a 30-day month", () => {
    const lines = linesFor(
      {
        ...baseLease,
        services: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly", activeThrough: D("2026-09-10") }]
      },
      "2026-09-01",
      "2026-10-01"
    );
    const wifi = lines.find((l) => l.kind === "service");
    expect(wifi?.amountMinor).toBe(450); // 1500 × 9/30
    expect(wifi?.name).toContain("(prorated 9/30)");
  });

  it("assignment starting mid-period bills only the active days", () => {
    const lines = linesFor(
      {
        ...baseLease,
        services: [{ name: "Parking", amountMinor: 3000, pricingModel: "fixed_monthly", activeFrom: D("2026-09-21") }]
      },
      "2026-09-01",
      "2026-10-01"
    );
    expect(lines.find((l) => l.kind === "service")?.amountMinor).toBe(1000); // 3000 × 10/30
  });

  it("window closed before the period produces no line at all", () => {
    const lines = linesFor(
      {
        ...baseLease,
        services: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly", activeThrough: D("2026-08-31") }]
      },
      "2026-09-01",
      "2026-10-01"
    );
    expect(lines.filter((l) => l.kind === "service")).toHaveLength(0);
  });

  it("thirty_day basis uses a 30-day denominator", () => {
    const lines = linesFor(
      {
        ...baseLease,
        prorationBasis: "thirty_day",
        services: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly", activeThrough: D("2026-09-11") }]
      },
      "2026-09-01",
      "2026-10-01"
    );
    expect(lines.find((l) => l.kind === "service")?.amountMinor).toBe(500); // 1500 × 10/30
  });
});
