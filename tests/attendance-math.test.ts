/// M23 pure math (§M23): month windows, geofence distance, shift spans,
/// punch derivation (late/early/overtime/missed), CSV export, summary.
import { describe, expect, it } from "vitest";
import {
  attendanceCsv,
  computePunch,
  geoStatus,
  haversineMeters,
  isoDay,
  matchShift,
  monthRange,
  shiftSpanFor,
  summarize,
  workDateOf,
  type CsvRow
} from "@/lib/operations/attendance-math";

const DAY = new Date(Date.UTC(2026, 8, 3)); // 2026-09-03 00:00 UTC
const at = (h: number, m = 0) => new Date(DAY.getTime() + (h * 60 + m) * 60_000);
const MORNING = { startMinute: 480, endMinute: 960, graceMinutes: 10 };
const EVENING = { id: "sh-evening", name: "Evening", startMinute: 960, endMinute: 1440, graceMinutes: 10, isActive: true };
const BLR = { geoLat: 11.5564, geoLng: 104.9282, geofenceRadiusM: 200 };

describe("M23 attendance math", () => {
  it("monthRange parses YYYY-MM into [from, to) and rejects junk", () => {
    const r = monthRange("2026-09")!;
    expect(r.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("september")).toBeNull();
  });

  it("workDateOf / isoDay roll to UTC midnight keys", () => {
    expect(workDateOf(at(23, 59)).toISOString()).toBe("2026-09-03T00:00:00.000Z");
    expect(isoDay(workDateOf(at(0, 1)))).toBe("2026-09-03");
  });

  it("haversine + geoStatus: inside, outside, unknown", () => {
    expect(haversineMeters(BLR.geoLat!, BLR.geoLng!, BLR.geoLat!, BLR.geoLng!)).toBe(0);
    // ~0.002° of latitude ≈ 222 m
    expect(haversineMeters(BLR.geoLat!, BLR.geoLng!, BLR.geoLat! + 0.002, BLR.geoLng!)).toBeGreaterThan(200);
    expect(geoStatus(BLR.geoLat, BLR.geoLng, BLR)).toBe("inside");
    expect(geoStatus(BLR.geoLat! + 0.01, BLR.geoLng, BLR)).toBe("outside");
    expect(geoStatus(null, null, BLR)).toBe("unknown");
    expect(geoStatus(11.5, 104.9, { geoLat: null, geoLng: null, geofenceRadiusM: null })).toBe("unknown");
  });

  it("shiftSpanFor materializes templates; night shifts cross midnight", () => {
    const day = shiftSpanFor(MORNING, DAY);
    expect(day.spanMinutes).toBe(480);
    expect(day.start.toISOString()).toBe("2026-09-03T08:00:00.000Z");
    const night = shiftSpanFor({ startMinute: 960, endMinute: 1500 }, DAY);
    expect(night.end.toISOString()).toBe("2026-09-04T01:00:00.000Z");
  });

  it("matchShift picks the containing window, else nearest start", () => {
    expect(matchShift([EVENING], at(18), DAY)?.id).toBe("sh-evening");
    expect(matchShift([EVENING], at(7), DAY)?.id).toBe("sh-evening"); // nearest anyway
  });

  it("computePunch: on-time in, on-time out → clean record, no OT", () => {
    const c = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: at(16), shift: MORNING, rule: { afterMinutes: 0, isActive: true }, inGeo: "inside", outGeo: "inside" });
    expect(c.minutesWorked).toBe(480);
    expect(c.overtimeMinutes).toBe(0);
    expect(c.lateMinutes).toBe(0);
    expect(c.exceptions).toHaveLength(0);
  });

  it("computePunch: late in (beyond grace) and early out are flagged", () => {
    const late = computePunch({ workDate: DAY, clockInAt: at(9, 30), clockOutAt: null, shift: MORNING, rule: null, inGeo: "unknown", outGeo: "unknown" });
    expect(late.lateMinutes).toBe(90);
    expect(late.exceptions.map((e) => e.type)).toContain("late_clock_in");
    const early = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: at(12), shift: MORNING, rule: null, inGeo: "inside", outGeo: "inside" });
    expect(early.earlyMinutes).toBe(240);
    expect(early.exceptions.map((e) => e.type)).toContain("early_clock_out");
  });

  it("computePunch: overtime counts minutes beyond span + rule floor", () => {
    const c = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: at(16, 30), shift: MORNING, rule: { afterMinutes: 0, isActive: true }, inGeo: "inside", outGeo: "inside" });
    expect(c.overtimeMinutes).toBe(30);
    expect(c.exceptions.map((e) => e.type)).toContain("overtime");
    const floored = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: at(16, 30), shift: MORNING, rule: { afterMinutes: 60, isActive: true }, inGeo: "inside", outGeo: "inside" });
    expect(floored.overtimeMinutes).toBe(0);
  });

  it("computePunch: missed_clock_out only past the stale threshold; geofence outside flagged", () => {
    const fresh = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: null, shift: MORNING, rule: null, inGeo: "inside", outGeo: "unknown", openAgeHours: 8 });
    expect(fresh.exceptions).toHaveLength(0);
    const stale = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: null, shift: MORNING, rule: null, inGeo: "inside", outGeo: "unknown", openAgeHours: 17 });
    expect(stale.exceptions.map((e) => e.type)).toContain("missed_clock_out");
    const fence = computePunch({ workDate: DAY, clockInAt: at(8), clockOutAt: at(16), shift: MORNING, rule: null, inGeo: "inside", outGeo: "outside" });
    expect(fence.exceptions.map((e) => e.type)).toContain("geofence_violation");
  });

  it("attendanceCsv: header, one row per record, RFC-escaping", () => {
    const rows: CsvRow[] = [
      { workDate: DAY, userName: "Kim, Ratana", email: "staff@demo.test", shiftName: "Morning", clockInAt: at(8), clockOutAt: at(16), minutesWorked: 480, overtimeMinutes: 0, source: "kiosk", exceptionCount: 0, note: null },
      { workDate: DAY, userName: "Open Punch", email: "pm@demo.test", shiftName: null, clockInAt: at(9), clockOutAt: null, minutesWorked: null, overtimeMinutes: null, source: "mobile", exceptionCount: 2, note: 'said "hi", left' }
    ];
    const csv = attendanceCsv(rows);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("date,staff_name,staff_email,shift,clock_in,clock_out,minutes,overtime_minutes,source,exceptions,note");
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith("2026-09-03,\"Kim, Ratana\",staff@demo.test,Morning,")).toBe(true);
    expect(lines[2]).toContain('"said ""hi"", left"');
  });

  it("summarize: per-staff days/minutes/OT/late counts and open exceptions", () => {
    const rows = summarize([
      { userId: "u1", userName: "A", email: "a@x", clockOutAt: at(16), minutesWorked: 480, overtimeMinutes: 30, lateMinutes: 0, earlyMinutes: 0, openExceptions: 0 },
      { userId: "u1", userName: "A", email: "a@x", clockOutAt: at(16), minutesWorked: 450, overtimeMinutes: 0, lateMinutes: 75, earlyMinutes: 0, openExceptions: 1 },
      { userId: "u1", userName: "A", email: "a@x", clockOutAt: null, minutesWorked: null, overtimeMinutes: null, lateMinutes: 0, earlyMinutes: 0, openExceptions: 2 },
      { userId: "u2", userName: "B", email: "b@x", clockOutAt: at(16), minutesWorked: 480, overtimeMinutes: 0, lateMinutes: 0, earlyMinutes: 0, openExceptions: 0 }
    ]);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.userId === "u1")!;
    expect(a.daysWorked).toBe(2); // open punch not a completed day
    expect(a.totalMinutes).toBe(930);
    expect(a.overtimeMinutes).toBe(30);
    expect(a.lateCount).toBe(1);
    expect(a.openExceptions).toBe(3);
  });
});
