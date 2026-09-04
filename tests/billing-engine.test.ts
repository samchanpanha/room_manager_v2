import { describe, expect, it } from "vitest";
import { nextCycleBoundary, prorate } from "@/lib/billing/proration";
import { composeInvoice, dunningStage, evalLateFee } from "@/lib/billing/engine";
import { canInvoiceTransition, INVOICE_TRANSITIONS } from "@/lib/billing/machines";

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// ── nextCycleBoundary ─────────────────────────────────────────────────────────

describe("nextCycleBoundary", () => {
  it("clamps cycleDay 29/30/31 to day 28 — Feb-safe", () => {
    // from Jan 15 the next boundary of a day-31 cycle is the clamped Jan 28
    expect(nextCycleBoundary(D("2026-01-15"), 31).toISOString().slice(0, 10)).toBe("2026-01-28");
    expect(nextCycleBoundary(D("2026-01-15"), 30).toISOString().slice(0, 10)).toBe("2026-01-28");
    expect(nextCycleBoundary(D("2026-01-15"), 29).toISOString().slice(0, 10)).toBe("2026-01-28");
    // in February the clamp avoids the 29th/30th entirely (non-leap 2026)
    expect(nextCycleBoundary(D("2026-02-10"), 31).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("clamps day 29 even in leap years (consistent 1–28 cycle days)", () => {
    // INTENT.md: cycleDay ∈ 1–28 so a lease never skips February in non-leap years
    expect(nextCycleBoundary(D("2024-02-10"), 29).toISOString().slice(0, 10)).toBe("2024-02-28");
    expect(nextCycleBoundary(D("2026-02-10"), 29).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("returns a boundary strictly after `from` when from sits on the cycle day", () => {
    expect(nextCycleBoundary(D("2026-09-01"), 1).toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(nextCycleBoundary(D("2026-09-28"), 28).toISOString().slice(0, 10)).toBe("2026-10-28");
  });

  it("keeps day 28 intact as a real boundary", () => {
    expect(nextCycleBoundary(D("2026-02-10"), 28).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

// ── prorate ───────────────────────────────────────────────────────────────────

describe("prorate", () => {
  it("full cycle short-circuits to the full amount on both bases", () => {
    const sep = prorate(18000, D("2026-09-01"), D("2026-10-01"), "calendar", 1);
    expect(sep.isFullCycle).toBe(true);
    expect(sep.amountMinor).toBe(18000);
    expect(sep.factor).toBe("full");
    expect(prorate(18000, D("2026-09-01"), D("2026-10-01"), "thirty_day", 1).isFullCycle).toBe(true);
  });

  it("mid-month stub Aug 15 → Sep 1 prorates 17/31 (the anchor bug)", () => {
    const r = prorate(18000, D("2026-08-15"), D("2026-09-01"), "calendar", 1);
    expect(r.isFullCycle).toBe(false);
    expect(r.days).toBe(17);
    expect(r.factor).toBe("17/31");
    expect(r.amountMinor).toBe(9871); // 18000 × 17/31 = 9870.96… → half-up
  });

  it("30-day basis divides by 30 regardless of real month length", () => {
    const r = prorate(30000, D("2026-02-20"), D("2026-03-01"), "thirty_day", 1);
    expect(r.days).toBe(9);
    expect(r.factor).toBe("9/30");
    expect(r.amountMinor).toBe(9000);
  });

  it("calendar basis uses the real (short) February", () => {
    const r = prorate(28000, D("2026-02-25"), D("2026-03-01"), "calendar", 1);
    expect(r.days).toBe(4);
    expect(r.factor).toBe("4/28");
    expect(r.amountMinor).toBe(4000);
  });

  it("rounds half-up on .5 boundaries", () => {
    // 15000 × 1/30 = 500 exact · 5 × 1/2 → 2.5 → 3 (half-up, positive only)
    expect(prorate(5, D("2026-09-01"), D("2026-09-02"), "thirty_day", 1).amountMinor).toBe(0); // 5/30 → 0.16 → 0
    expect(prorate(1500, D("2026-08-16"), D("2026-09-01"), "calendar", 1).amountMinor).toBe(774); // 1500×16/31 = 774.19
    expect(prorate(1000, D("2026-08-17"), D("2026-09-01"), "thirty_day", 1).amountMinor).toBe(500); // 15/30 exact
    expect(prorate(100, D("2026-08-16"), D("2026-09-01"), "thirty_day", 1).amountMinor).toBe(53); // 100×16/30 = 53.33
    expect(prorate(100, D("2026-08-15"), D("2026-09-01"), "thirty_day", 1).amountMinor).toBe(57); // 100×17/30 = 56.67
  });
});

// ── composeInvoice ────────────────────────────────────────────────────────────

const baseLease = {
  rentMinor: 18000,
  billingCycleDay: 1,
  prorationBasis: "calendar" as const,
  services: [{ name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }]
};

describe("composeInvoice", () => {
  it("composes a full-month invoice: rent + fixed service, tax 0", () => {
    const inv = composeInvoice({
      lease: baseLease,
      periodStart: D("2026-09-01"),
      periodEnd: D("2026-10-01"),
      taxPercentBps: 0,
      discountMinor: 0,
      periodLabel: "Sep 1 – Sep 30, 2026"
    });
    expect(inv.lines).toHaveLength(2);
    expect(inv.subtotalMinor).toBe(19500);
    expect(inv.totalMinor).toBe(19500);
    expect(inv.isPartial).toBe(false);
  });

  it("prorates a mid-month stub: rent 17/31 and service with the same factor", () => {
    const inv = composeInvoice({
      lease: baseLease,
      periodStart: D("2026-08-15"),
      periodEnd: D("2026-09-01"),
      taxPercentBps: 0,
      discountMinor: 0,
      periodLabel: "Aug 15 – Aug 31, 2026"
    });
    expect(inv.isPartial).toBe(true);
    const rent = inv.lines.find((l) => l.kind === "rent");
    const wifi = inv.lines.find((l) => l.kind === "service");
    expect(rent?.amountMinor).toBe(9871); // 18000×17/31
    expect(wifi?.amountMinor).toBe(823); // 1500×17/31 = 822.58 → half-up
    expect(rent?.name).toContain("17/31");
    expect(inv.subtotalMinor).toBe(10694);
  });

  it("holds the invariant total = Σ items − discount + tax", () => {
    const inv = composeInvoice({
      lease: baseLease,
      periodStart: D("2026-09-01"),
      periodEnd: D("2026-10-01"),
      taxPercentBps: 1000, // 10%
      discountMinor: 975,
      periodLabel: "Sep 2026"
    });
    expect(inv.discountMinor).toBe(975);
    expect(inv.taxMinor).toBe(1853); // round(18525 × 10%) = 1852.5 → half-up
    expect(inv.totalMinor).toBe(19500 - 975 + 1853);
    expect(inv.totalMinor).toBe(20378);
  });

  it("clamps the discount at the subtotal", () => {
    const inv = composeInvoice({
      lease: baseLease,
      periodStart: D("2026-09-01"),
      periodEnd: D("2026-10-01"),
      taxPercentBps: 0,
      discountMinor: 999999,
      periodLabel: "Sep 2026"
    });
    expect(inv.discountMinor).toBe(19500);
    expect(inv.totalMinor).toBe(0);
  });

  it("excludes per_use/metered services (one-time lines arrive via M12/M14)", () => {
    const inv = composeInvoice({
      lease: {
        ...baseLease,
        services: [
          { name: "Cleaning", amountMinor: 2000, pricingModel: "per_use" },
          { name: "Water", amountMinor: 1200, pricingModel: "metered" },
          { name: "WiFi", amountMinor: 1500, pricingModel: "fixed_monthly" }
        ]
      },
      periodStart: D("2026-09-01"),
      periodEnd: D("2026-10-01"),
      taxPercentBps: 0,
      discountMinor: 0,
      periodLabel: "Sep 2026"
    });
    expect(inv.lines.map((l) => l.name)).toEqual(["Rent — Sep 2026", "WiFi — Sep 2026"]);
    expect(inv.lines.every((l) => l.kind === "rent" || l.kind === "service")).toBe(true);
  });

  it("supports one-time lines with quantity math", () => {
    const inv = composeInvoice({
      lease: { ...baseLease, services: [] },
      periodStart: D("2026-09-01"),
      periodEnd: D("2026-10-01"),
      taxPercentBps: 0,
      discountMinor: 0,
      oneTimeLines: [{ kind: "utility", name: "Electricity", unitMinor: 450, qty: 2 }],
      periodLabel: "Sep 2026"
    });
    const util = inv.lines.find((l) => l.kind === "utility");
    expect(util?.amountMinor).toBe(900); // qty × unit computed by the engine — invariant safe
    expect(inv.totalMinor).toBe(18900);
  });

  it("rejects an invalid period", () => {
    expect(() =>
      composeInvoice({
        lease: baseLease,
        periodStart: D("2026-09-01"),
        periodEnd: D("2026-09-01"),
        taxPercentBps: 0,
        discountMinor: 0,
        periodLabel: "x"
      })
    ).toThrowError(/Invalid period/);
  });
});

// ── evalLateFee (pure part; grace-window filtering lives in the service) ──────

describe("evalLateFee", () => {
  it("FIXED: min(fee, cap?, outstanding); non-positive → null", () => {
    expect(evalLateFee({ type: "FIXED", amountMinor: 500 }, 20000)).toBe(500);
    expect(evalLateFee({ type: "FIXED", amountMinor: 500, capMinor: 300 }, 20000)).toBe(300);
    expect(evalLateFee({ type: "FIXED", amountMinor: 500 }, 300)).toBe(300); // ≤ outstanding
    expect(evalLateFee({ type: "FIXED", amountMinor: 0 }, 5000)).toBeNull();
    expect(evalLateFee({ type: "FIXED" }, 5000)).toBeNull();
  });

  it("PERCENT: bps of outstanding with 1-minor floor and cap", () => {
    expect(evalLateFee({ type: "PERCENT", percentBps: 200, capMinor: 1000 }, 20000)).toBe(400); // 2%
    expect(evalLateFee({ type: "PERCENT", percentBps: 100 }, 30)).toBe(1); // 0.3 → floor 1
    expect(evalLateFee({ type: "PERCENT", percentBps: 10000, capMinor: 5000 }, 99999)).toBe(5000); // 100% capped
    expect(evalLateFee({ type: "PERCENT", percentBps: 0 }, 5000)).toBeNull();
  });

  it("never exceeds the outstanding amount; zero due → null", () => {
    expect(evalLateFee({ type: "PERCENT", percentBps: 10000 }, 200)).toBe(200);
    expect(evalLateFee({ type: "FIXED", amountMinor: 500 }, 0)).toBeNull();
  });
});

// ── dunningStage ──────────────────────────────────────────────────────────────

describe("dunningStage", () => {
  const schedule = [3, 7, 14];
  it("maps days past due onto the +3/+7/+14 ladder", () => {
    expect(dunningStage(0, schedule)).toBe(0);
    expect(dunningStage(2, schedule)).toBe(0);
    expect(dunningStage(3, schedule)).toBe(1);
    expect(dunningStage(6, schedule)).toBe(1);
    expect(dunningStage(7, schedule)).toBe(2);
    expect(dunningStage(13, schedule)).toBe(2);
    expect(dunningStage(14, schedule)).toBe(3);
    expect(dunningStage(90, schedule)).toBe(3); // saturates at the last stage
  });
});

// ── invoice state machine ─────────────────────────────────────────────────────

describe("invoice state machine", () => {
  it("draft → issued only; paid & void are terminal", () => {
    expect(canInvoiceTransition("draft", "issued")).toBe(true);
    expect(canInvoiceTransition("draft", "paid")).toBe(false);
    expect(canInvoiceTransition("draft", "overdue")).toBe(false);
    expect(INVOICE_TRANSITIONS.paid).toEqual([]);
    expect(INVOICE_TRANSITIONS.void).toEqual([]);
  });

  it("issued → partial_paid/paid/overdue/void; overdue recovers via payment", () => {
    expect(canInvoiceTransition("issued", "partial_paid")).toBe(true);
    expect(canInvoiceTransition("issued", "paid")).toBe(true);
    expect(canInvoiceTransition("issued", "overdue")).toBe(true);
    expect(canInvoiceTransition("issued", "void")).toBe(true);
    expect(canInvoiceTransition("overdue", "partial_paid")).toBe(true);
    expect(canInvoiceTransition("overdue", "paid")).toBe(true);
    expect(canInvoiceTransition("partial_paid", "issued")).toBe(false);
    expect(canInvoiceTransition("paid", "void")).toBe(false);
    expect(canInvoiceTransition("void", "issued")).toBe(false);
  });
});
