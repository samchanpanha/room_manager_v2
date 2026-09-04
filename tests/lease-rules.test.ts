import { describe, expect, it } from "vitest";
import { checkPlacement, isMoveInReady } from "@/lib/leases/rules";
import { computeNextBillingDate } from "@/lib/leases/billing";

const bed1 = "bed_1";
const bed2 = "bed_2";

describe("Occupancy rules (M05: one active lease per bed, capacity limits)", () => {
  it("first whole-room lease in a vacant room is fine", () => {
    expect(
      checkPlacement({ roomStatus: "vacant", capacity: 1, activeLeases: [], requestedBedId: null })
    ).toEqual({ ok: true });
  });

  it("whole-room lease conflicts with any active lease", () => {
    const r = checkPlacement({
      roomStatus: "occupied",
      capacity: 2,
      activeLeases: [{ id: "l1", bedId: bed1 }],
      requestedBedId: null
    });
    expect(r).toMatchObject({ ok: false, code: "WHOLE_ROOM_CONFLICT" });
  });

  it("one active lease per bed — double-booking rejected", () => {
    const r = checkPlacement({
      roomStatus: "occupied",
      capacity: 2,
      activeLeases: [{ id: "l1", bedId: bed1 }],
      requestedBedId: bed1
    });
    expect(r).toMatchObject({ ok: false, code: "BED_TAKEN" });
  });

  it("whole-room lease blocks per-bed leases", () => {
    const r = checkPlacement({
      roomStatus: "occupied",
      capacity: 3,
      activeLeases: [{ id: "l1", bedId: null }],
      requestedBedId: bed2
    });
    expect(r).toMatchObject({ ok: false, code: "WHOLE_ROOM_CONFLICT" });
  });

  it("capacity cannot be exceeded", () => {
    const r = checkPlacement({
      roomStatus: "occupied",
      capacity: 2,
      activeLeases: [
        { id: "l1", bedId: bed1 },
        { id: "l2", bedId: bed2 }
      ],
      requestedBedId: "bed_3"
    });
    expect(r).toMatchObject({ ok: false, code: "ROOM_FULL" });
  });

  it("cleaning/maintenance rooms are not move-in ready; occupied is (co-living)", () => {
    for (const s of ["vacant", "reserved", "occupied"]) {
      expect(isMoveInReady(s)).toBe(true);
    }
    for (const s of ["cleaning", "maintenance"]) {
      expect(isMoveInReady(s)).toBe(false);
      expect(
        checkPlacement({ roomStatus: s, capacity: 2, activeLeases: [], requestedBedId: null }).ok
      ).toBe(false);
    }
  });

  it("second bed in a shared room is fine (co-living)", () => {
    expect(
      checkPlacement({
        roomStatus: "occupied",
        capacity: 2,
        activeLeases: [{ id: "l1", bedId: bed1 }],
        requestedBedId: bed2,
        existingBedIds: [bed1, bed2]
      })
    ).toEqual({ ok: true });
  });

  it("foreign bed ids are rejected", () => {
    expect(
      checkPlacement({
        roomStatus: "vacant",
        capacity: 2,
        activeLeases: [],
        requestedBedId: "ghost_bed",
        existingBedIds: [bed1, bed2]
      })
    ).toMatchObject({ ok: false, code: "BED_TAKEN" });
  });
});

describe("Next billing date (M05/M06 groundwork)", () => {
  it("mid-month start after cycle day rolls to next month", () => {
    expect(computeNextBillingDate(new Date(Date.UTC(2026, 7, 15)), 1).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
  it("start on/before cycle day bills in the same month", () => {
    expect(computeNextBillingDate(new Date(Date.UTC(2026, 7, 1)), 1).toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(computeNextBillingDate(new Date(Date.UTC(2026, 7, 3)), 5).toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });
  it("cycle day > 28 is clamped (Feb safety)", () => {
    expect(computeNextBillingDate(new Date(Date.UTC(2026, 0, 10)), 31).getUTCDate()).toBe(28);
    expect(computeNextBillingDate(new Date(Date.UTC(2026, 0, 10)), 0).getUTCDate()).toBe(1);
  });
});
