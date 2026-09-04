/**
 * M16 room moves — pure rules (no DB): state machine transitions and the
 * proration-delta math that the adjustment invoice must reproduce exactly.
 */
import { describe, expect, it } from "vitest";

import { canRoomMoveTransition, computeMoveProration, currentCycleStart, ROOM_MOVE_TRANSITIONS } from "@/lib/rooms/moves-machine";
import { nextCycleBoundary } from "@/lib/billing/proration";

describe("M16 state machine", () => {
  it("allows only requested→approved/cancelled and approved→executed/cancelled", () => {
    expect(canRoomMoveTransition("requested", "approved")).toBe(true);
    expect(canRoomMoveTransition("requested", "cancelled")).toBe(true);
    expect(canRoomMoveTransition("requested", "executed")).toBe(false);
    expect(canRoomMoveTransition("approved", "executed")).toBe(true);
    expect(canRoomMoveTransition("approved", "cancelled")).toBe(true);
    expect(canRoomMoveTransition("approved", "requested")).toBe(false);
  });

  it("executed and cancelled are terminal", () => {
    expect(ROOM_MOVE_TRANSITIONS.executed).toEqual([]);
    expect(ROOM_MOVE_TRANSITIONS.cancelled).toEqual([]);
    expect(canRoomMoveTransition("executed", "cancelled")).toBe(false);
    expect(canRoomMoveTransition("cancelled", "requested")).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(canRoomMoveTransition("pending", "approved")).toBe(false);
    expect(canRoomMoveTransition("requested", "void")).toBe(false);
  });
});

describe("M16 proration delta", () => {
  const eff = new Date("2026-09-03T00:00:00.000Z");
  const periodEnd = nextCycleBoundary(eff, 1); // 2026-10-01
  const base = { effectiveAt: eff, periodEnd, prorationBasis: "calendar" as const, billingCycleDay: 1 };

  it("equal rents + fee → net is exactly the move fee (28/30 of September)", () => {
    const p = computeMoveProration({ ...base, oldRentMinor: 25_000, newRentMinor: 25_000, moveFeeMinor: 2_000 });
    expect(p.days).toBe(28);
    expect(p.denominator).toBe(30); // September has 30 days (calendar basis)
    expect(p.newRentChargeMinor).toBe(23_333); // 25000*28/30 → 23333.33
    expect(p.oldRentCreditMinor).toBe(23_333);
    expect(p.netMinor).toBe(2_000); // 23333 + 2000 − 23333
    expect(p.factor).toBe("28/30");
  });

  it("rent upgrade charges the exact delta plus the fee", () => {
    const p = computeMoveProration({ ...base, oldRentMinor: 25_000, newRentMinor: 32_000, moveFeeMinor: 2_000 });
    expect(p.newRentChargeMinor).toBe(29_867); // 32000*28/30 → 29866.67
    expect(p.oldRentCreditMinor).toBe(23_333);
    expect(p.netMinor).toBe(29_867 + 2_000 - 23_333); // 8534
  });

  it("zero fee → net is the pure rent delta", () => {
    const p = computeMoveProration({ ...base, oldRentMinor: 25_000, newRentMinor: 32_000, moveFeeMinor: 0 });
    expect(p.netMinor).toBe(29_867 - 23_333); // 6534
  });

  it("full-cycle move (effective on a boundary) charges full rent, credits full old rent", () => {
    const p = computeMoveProration({
      oldRentMinor: 25_000,
      newRentMinor: 32_000,
      moveFeeMinor: 2_000,
      effectiveAt: new Date("2026-10-01T00:00:00.000Z"),
      periodEnd: new Date("2026-11-01T00:00:00.000Z"),
      prorationBasis: "calendar",
      billingCycleDay: 1
    });
    expect(p.days).toBe(31);
    expect(p.newRentChargeMinor).toBe(32_000);
    expect(p.oldRentCreditMinor).toBe(25_000);
    expect(p.netMinor).toBe(32_000 + 2_000 - 25_000);
  });

  it("thirty_day basis uses a fixed 30-day denominator (February diverges from calendar)", () => {
    const input = {
      oldRentMinor: 25_000,
      newRentMinor: 25_000,
      moveFeeMinor: 0,
      effectiveAt: new Date("2027-02-03T00:00:00.000Z"),
      periodEnd: new Date("2027-03-01T00:00:00.000Z"),
      billingCycleDay: 1
    };
    const cal = computeMoveProration({ ...input, prorationBasis: "calendar" });
    const t30 = computeMoveProration({ ...input, prorationBasis: "thirty_day" });
    expect(cal.days).toBe(26);
    expect(cal.denominator).toBe(28); // cycle length: Feb 1 → Mar 1 = 28 days
    expect(cal.newRentChargeMinor).toBe(23_214); // calendar: 25000*26/28 → 23214.29
    expect(cal.netMinor).toBe(0); // charge == credit (equal rents, no fee)
    expect(t30.denominator).toBe(28); // cycle length is basis-independent
    expect(t30.newRentChargeMinor).toBe(21_667); // thirty_day: 25000*26/30 → 21666.67
    expect(t30.netMinor).toBe(0); // equal rents always net to the fee (0 here)
  });
});

describe("M16 currentCycleStart", () => {
  it("returns the 1st when today is past it (cycleDay 1)", () => {
    expect(currentCycleStart(new Date("2026-09-03T00:00:00.000Z"), 1).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
  it("rolls back to last month when the cycle day has not come yet", () => {
    expect(currentCycleStart(new Date("2026-09-03T00:00:00.000Z"), 5).toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(currentCycleStart(new Date("2026-09-05T00:00:00.000Z"), 5).toISOString()).toBe("2026-09-05T00:00:00.000Z");
  });
});

describe("M16 HTTP newRent conversion", () => {
  // Regression (Phase 22 golden path): the room-moves POST route converted the
  // dollar `newRent` with the meter-reading helper toMilli()/1000, storing
  // 310 as 310 minor = $3.10 (execute then crashed on nonsense proration).
  // The route must use toMinor — dollars → minor.
  it("route contract: dollars from the API body convert to minor via toMinor", async () => {
    const { toMinor } = await import("@/lib/money");
    const { toMilli } = await import("@/lib/utilities/machines");
    expect(toMinor(310)).toBe(31_000); // $310.00 → 31000 minor ✓
    expect(toMilli("310") / 1000).toBe(310); // the old bug: 310 minor = $3.10 ✗
    expect(toMinor(310)).not.toBe(toMilli("310") / 1000);
  });
});
