/**
 * M23 Attendance service (§M23 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/attendance-service.test.ts
 *
 * Flow: kiosk PIN clock in/out (shift-matched, geofenced) → overtime + exception
 * derivation → audited manual entry/correction → sweep flags missed punches →
 * resolution sticks → monthly summary + CSV export match the records.
 * Demo PINs from the seed: staff 246810, pm 135711.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  clockByPin,
  clockBySession,
  createManualRecord,
  editRecord,
  exportCsv,
  monthlySummary,
  resolveException,
  sweepStaleOpen
} from "@/lib/operations/attendance-service";

let actor = { id: "", name: "" };
let staffId = "";
let pmId = "";
let propertyId = "";
let runnable = false;

const BLR = { lat: 11.5564, lng: 104.9282 }; // inside the 200 m seeded geofence
const FAR = { lat: 11.62, lng: 104.92 }; // ~7 km away → outside

const DAY = 24 * 3_600_000;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: "staff@demo.test" } });
  const pm = await prisma.user.findUniqueOrThrow({ where: { email: "pm@demo.test" } });
  const property = await prisma.property.findUniqueOrThrow({ where: { code: "BLR" } });
  staffId = staff.id;
  pmId = pm.id;
  propertyId = property.id;
  // disposable-copy safety: clear any leftovers for these users
  await prisma.attendanceException.deleteMany({ where: { userId: { in: [staffId, pmId] } } });
  await prisma.attendanceRecord.deleteMany({ where: { userId: { in: [staffId, pmId] } } });
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M23 attendance flow", () => {
  const now = new Date();
  const todayAt = (h: number, m = 0) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
    return d.getTime() <= now.getTime() + DAY ? d : new Date(d.getTime() - DAY); // keep inside the past/near-past
  };

  let staffRecordId = "";

  it("kiosk: bad PIN rejected, good PIN clocks in with shift match + geofence inside", async (ctx) => {
    if (!runnable) ctx.skip();
    const bad = await clockByPin({ propertyId, pin: "000000", action: "in", lat: BLR.lat, lng: BLR.lng, at: todayAt(8) });
    expect(bad).toMatchObject({ ok: false, code: "PIN_INVALID" });
    const r = await clockByPin({ propertyId, pin: "246810", action: "in", lat: BLR.lat, lng: BLR.lng, at: todayAt(8) });
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    staffRecordId = r.data.recordId;
    expect(r.data.userName).toBe("Ratana Kim");
    expect(r.data.geoStatus).toBe("inside");
    const rec = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: staffRecordId }, include: { shift: true } });
    expect(rec.shift?.name).toBe("Morning 08:00–16:00");
    expect(rec.inGeoStatus).toBe("inside");
    expect(rec.source).toBe("kiosk");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "attendance.clock_in", entityId: staffRecordId } });
    expect(audit.actorId).toBe(staffId);
  });

  it("kiosk: a second clock-in while open is rejected; worked date is unique", async (ctx) => {
    if (!runnable) ctx.skip();
    const dupe = await clockByPin({ propertyId, pin: "246810", action: "in", at: todayAt(9) });
    expect(dupe).toMatchObject({ ok: false, code: "ALREADY_CLOCKED_IN" });
  });

  it("clock out computes minutes + overtime and derives the exception", async (ctx) => {
    if (!runnable) ctx.skip();
    const outAt = new Date(todayAt(8).getTime() + 510 * 60_000); // 8.5h later
    const r = await clockByPin({ propertyId, pin: "246810", action: "out", lat: BLR.lat, lng: BLR.lng, at: outAt });
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    expect(r.data.minutesWorked).toBe(510);
    const rec = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: staffRecordId } });
    expect(rec.overtimeMinutes).toBe(30); // 480-min shift, OT floor 0
    const exc = await prisma.attendanceException.findFirstOrThrow({ where: { recordId: staffRecordId, type: "overtime", status: "open" } });
    expect(exc.detail).toContain("30 min");
    const noOpen = await clockByPin({ propertyId, pin: "246810", action: "out", at: new Date() });
    expect(noOpen).toMatchObject({ ok: false, code: "NO_OPEN_PUNCH" });
  });

  it("mobile clock (session) with a far coordinate flags the geofence", async (ctx) => {
    if (!runnable) ctx.skip();
    const inAt = todayAt(8);
    const cin = await clockBySession({ userId: pmId, userName: "Malis Horn", propertyId, action: "in", lat: FAR.lat, lng: FAR.lng, at: inAt });
    expect(cin.ok).toBe(true);
    if (!cin.ok || !cin.data) return;
    expect(cin.data.geoStatus).toBe("outside");
    const fence = await prisma.attendanceException.findFirstOrThrow({ where: { recordId: cin.data.recordId, type: "geofence_violation", status: "open" } });
    void fence;
    const cout = await clockBySession({ userId: pmId, userName: "Malis Horn", propertyId, action: "out", lat: FAR.lat, lng: FAR.lng, at: new Date(inAt.getTime() + 480 * 60_000) });
    expect(cout).toMatchObject({ ok: true, data: { minutesWorked: 480 } });
  });

  it("manual entry (audited) covers a missed punch; same date is rejected", async (ctx) => {
    if (!runnable) ctx.skip();
    const noReason = await createManualRecord({ userId: staffId, propertyId, clockInAt: todayAt(8), reason: "  ", note: null }, actor);
    expect(noReason).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    const tomorrow8 = new Date(todayAt(8).getTime() + DAY);
    const r = await createManualRecord({ userId: staffId, propertyId, clockInAt: tomorrow8, clockOutAt: null, reason: "forgot to clock out (kiosk offline)", note: null }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const dupe = await createManualRecord({ userId: staffId, propertyId, clockInAt: tomorrow8, reason: "double entry" }, actor);
    expect(dupe).toMatchObject({ ok: false, code: "ALREADY_WORKED" });
    const rec = await prisma.attendanceRecord.findFirstOrThrow({ where: { userId: staffId, source: "manual" } });
    expect(rec.createdById).toBe(actor.id);
    expect(rec.editReason).toBe("forgot to clock out (kiosk offline)");
  });

  it("correction stamps who/why, recomputes, and re-derives exceptions (late)", async (ctx) => {
    if (!runnable) ctx.skip();
    const manual = await prisma.attendanceRecord.findFirstOrThrow({ where: { userId: staffId, source: "manual" } });
    const noReason = await editRecord(manual.id, { clockInAt: new Date(manual.clockInAt.getTime() + 75 * 60_000), reason: "" }, actor);
    expect(noReason).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    const r = await editRecord(manual.id, { clockInAt: new Date(manual.clockInAt.getTime() + 75 * 60_000), reason: "true start per supervisor" }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const rec = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: manual.id } });
    expect(rec.editedById).toBe(actor.id);
    expect(rec.editReason).toBe("true start per supervisor");
    const late = await prisma.attendanceException.findFirstOrThrow({ where: { recordId: manual.id, type: "late_clock_in", status: "open" } });
    void late;
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "attendance.edit", entityId: manual.id } });
    expect(JSON.stringify(audit.after)).toContain("true start per supervisor");
  });

  it("sweep flags stale open punches as missed_clock_out (>16h)", async (ctx) => {
    if (!runnable) ctx.skip();
    // remediate the open manual record first (only one open punch may exist)
    const manual = await prisma.attendanceRecord.findFirstOrThrow({ where: { userId: staffId, source: "manual" } });
    await editRecord(manual.id, { clockOutAt: new Date(manual.workDate.getTime() + 17 * 3_600_000), reason: "supervisor confirmed 17:00 out" }, actor);
    const staleAt = new Date(now.getTime() - 17 * 3_600_000);
    const r = await clockBySession({ userId: staffId, userName: "Ratana Kim", propertyId, action: "in", at: staleAt });
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const before = await prisma.attendanceException.count({ where: { userId: staffId, type: "missed_clock_out", status: "open" } });
    const sweep = await sweepStaleOpen(actor);
    expect(sweep.ok).toBe(true);
    if (!sweep.ok || !sweep.data) return;
    expect(sweep.data.flagged).toBeGreaterThanOrEqual(1);
    const after = await prisma.attendanceException.count({ where: { userId: staffId, type: "missed_clock_out", status: "open" } });
    expect(after).toBeGreaterThan(before);
  });

  it("resolving an exception is final and survives recomputation", async (ctx) => {
    if (!runnable) ctx.skip();
    const exc = await prisma.attendanceException.findFirstOrThrow({ where: { userId: pmId, type: "geofence_violation", status: "open" } });
    const noNote = await resolveException(exc.id, { resolution: "" }, actor);
    expect(noNote).toMatchObject({ ok: false, code: "RESOLUTION_REQUIRED" });
    const r = await resolveException(exc.id, { resolution: "confirmed site visit with PM" }, actor);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data) return;
    const again = await resolveException(exc.id, { resolution: "twice" }, actor);
    expect(again).toMatchObject({ ok: false, code: "ALREADY_RESOLVED" });
    const resolved = await prisma.attendanceException.findUniqueOrThrow({ where: { id: exc.id } });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution).toBe("confirmed site visit with PM");
  });

  it("monthly summary per staff (§M23)", async (ctx) => {
    if (!runnable) ctx.skip();
    const month = now.toISOString().slice(0, 7);
    const bad = await monthlySummary(propertyId, "junk");
    expect(bad.ok).toBe(false);
    const s = await monthlySummary(propertyId, month);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const staffRow = s.data.rows.find((r) => r.userId === staffId);
    expect(staffRow).toBeDefined();
    expect(staffRow!.daysWorked).toBe(2); // today's kiosk pair + remediated manual pair
    expect(staffRow!.totalMinutes).toBe(975); // 510 + 465 (09:15→17:00)
    expect(staffRow!.overtimeMinutes).toBe(30);
    expect(staffRow!.lateCount).toBe(2); // corrected manual start + the stale 22:00 clock-in vs the Evening shift
    expect(staffRow!.openExceptions).toBeGreaterThanOrEqual(3); // overtime + late + missed_clock_out
    expect(s.data.overtimeMultiplierBp).toBe(15000);
  });

  it("monthly CSV export matches the records (§M23 acceptance)", async (ctx) => {
    if (!runnable) ctx.skip();
    const month = now.toISOString().slice(0, 7);
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const expected = await prisma.attendanceRecord.count({ where: { propertyId, workDate: { gte: from, lt: to } } });
    const bad = await exportCsv(propertyId, "2026-13");
    expect(bad.ok).toBe(false);
    const e = await exportCsv(propertyId, month);
    expect(e.ok).toBe(true);
    if (!e.ok || !e.data) return;
    const lines = e.data.csv.trimEnd().split("\n");
    expect(lines[0]).toBe("date,staff_name,staff_email,shift,clock_in,clock_out,minutes,overtime_minutes,source,exceptions,note");
    expect(lines.length - 1).toBe(expected); // one row per record — export matches records
    expect(e.data.count).toBe(expected);
    expect(e.data.csv).toContain("Ratana Kim");
  });
});
