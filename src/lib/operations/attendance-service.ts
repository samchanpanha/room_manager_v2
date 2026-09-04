/// M23 Attendance service — kiosk-PIN / mobile clock in-out, audited manual
/// edits, exception derivation + resolution, monthly summary and CSV export.
/// §M23: "no edit without audit" — every write path calls logAudit, and edits
/// additionally stamp who/why on the record. Pure math in attendance-math.ts.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import type { ActorCtx } from "@/lib/payments/service";
import {
  ATTENDANCE_SOURCES,
  attendanceCsv,
  computePunch,
  geoStatus,
  matchShift,
  monthRange,
  STALE_OPEN_HOURS,
  summarize,
  workDateOf,
  type AttendanceSource,
  type CsvRow,
  type GeofenceCfg
} from "./attendance-math";

interface Result<T> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
}

const HEAVY_TX = { maxWait: 5_000, timeout: 20_000 } as const;

/// Kiosk PINs are low-entropy by nature — indexed sha256 (with pepper) is the
/// deliberate choice so a PIN maps to at most one user; the kiosk endpoint is
/// rate-limited like login (same 10/min/IP budget). Never a password path.
function pinHash(pin: string): string {
  const pepper = process.env.KIOSK_PIN_PEPPER ?? "rm-kiosk-pepper-v1";
  return createHash("sha256").update(`${pepper}:${pin}`).digest("hex");
}

/// Route-facing hash setter (kiosk-pin endpoint); keeps `pinHash` private.
export function pinHashFor(pin: string): string {
  return pinHash(pin);
}

type PunchGeo = "inside" | "outside" | "unknown";

async function propertyGeofence(propertyId: string): Promise<GeofenceCfg> {
  const p = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { geoLat: true, geoLng: true, geofenceRadiusM: true }
  });
  return { geoLat: p?.geoLat ?? null, geoLng: p?.geoLng ?? null, geofenceRadiusM: p?.geofenceRadiusM ?? null };
}

async function activeShifts(propertyId: string) {
  return prisma.shift.findMany({ where: { propertyId, isActive: true }, orderBy: { startMinute: "asc" } });
}

async function overtimeRule(propertyId: string) {
  return prisma.overtimeRule.findFirst({ where: { propertyId, isActive: true } });
}

/// Replace the record's open derived exceptions with the current set
/// (resolved ones are history and never re-opened).
async function reconcileExceptions(
  tx: Prisma.TransactionClient,
  record: { id: string; userId: string; propertyId: string; workDate: Date },
  derived: Array<{ type: string; detail: string }>
): Promise<void> {
  await tx.attendanceException.deleteMany({ where: { recordId: record.id, status: "open" } });
  const existingResolved = await tx.attendanceException.findMany({
    where: { recordId: record.id, status: "resolved" },
    select: { type: true }
  });
  const resolvedTypes = new Set(existingResolved.map((e) => e.type));
  for (const d of derived) {
    if (resolvedTypes.has(d.type)) continue;
    await tx.attendanceException.create({
      data: { recordId: record.id, userId: record.userId, propertyId: record.propertyId, workDate: record.workDate, type: d.type, detail: d.detail }
    });
  }
}

async function recomputeInto(
  tx: Prisma.TransactionClient,
  recordId: string
): Promise<{ minutesWorked: number | null; overtimeMinutes: number }> {
  const record = await tx.attendanceRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { shift: true }
  });
  const rule = await overtimeRule(record.propertyId);
  const comp = computePunch({
    workDate: record.workDate,
    clockInAt: record.clockInAt,
    clockOutAt: record.clockOutAt,
    shift: record.shift,
    rule,
    inGeo: (record.inGeoStatus ?? "unknown") as PunchGeo,
    outGeo: (record.outGeoStatus ?? "unknown") as PunchGeo
  });
  await tx.attendanceRecord.update({
    where: { id: record.id },
    data: { minutesWorked: comp.minutesWorked, overtimeMinutes: comp.overtimeMinutes }
  });
  await reconcileExceptions(tx, record, comp.exceptions);
  return { minutesWorked: comp.minutesWorked, overtimeMinutes: comp.overtimeMinutes };
}

// ── clock in / out ───────────────────────────────────────────────────────────

export interface ClockResult {
  recordId: string;
  action: "in" | "out";
  userName: string;
  at: Date;
  workDate: Date;
  minutesWorked?: number | null;
  shiftName?: string | null;
  geoStatus?: PunchGeo;
}

/// Kiosk path (§M23 "kiosk PIN"): the PIN identifies the staff member; no
/// browser session involved. `at` is injectable for tests.
export async function clockByPin(
  input: { propertyId: string; pin: string; action: "in" | "out"; lat?: number | null; lng?: number | null; at?: Date },
  ip?: string | null
): Promise<Result<ClockResult>> {
  if (!/^\d{4,8}$/.test(input.pin)) return { ok: false, code: "PIN_INVALID", message: "PIN must be 4–8 digits" };
  const user = await prisma.user.findFirst({ where: { kioskPinHash: pinHash(input.pin), status: "active" } });
  if (!user) return { ok: false, code: "PIN_INVALID", message: "Unknown PIN" };
  return clockCore(
    { userId: user.id, userName: user.name, propertyId: input.propertyId, action: input.action, lat: input.lat ?? null, lng: input.lng ?? null, source: "kiosk", at: input.at ?? new Date() },
    ip
  );
}

/// Mobile path (§M23 "or mobile"): session-authenticated self clock.
export async function clockBySession(
  input: { userId: string; userName: string; propertyId: string; action: "in" | "out"; lat?: number | null; lng?: number | null; at?: Date },
  ip?: string | null
): Promise<Result<ClockResult>> {
  return clockCore({ ...input, lat: input.lat ?? null, lng: input.lng ?? null, source: "mobile", at: input.at ?? new Date() }, ip);
}

async function clockCore(
  input: { userId: string; userName: string; propertyId: string; action: "in" | "out"; lat: number | null; lng: number | null; source: AttendanceSource; at: Date },
  ip?: string | null
): Promise<Result<ClockResult>> {
  const property = await prisma.property.findUnique({ where: { id: input.propertyId }, select: { id: true, name: true } });
  if (!property) return { ok: false, code: "NOT_FOUND", message: "Property not found" };
  const geo = geoStatus(input.lat, input.lng, await propertyGeofence(input.propertyId));

  if (input.action === "in") {
    const open = await prisma.attendanceRecord.findFirst({ where: { userId: input.userId, clockOutAt: null } });
    if (open) return { ok: false, code: "ALREADY_CLOCKED_IN", message: "An open punch exists — clock out first" };
    const workDate = workDateOf(input.at);
    const dupe = await prisma.attendanceRecord.findUnique({ where: { userId_workDate: { userId: input.userId, workDate } } });
    if (dupe) return { ok: false, code: "ALREADY_WORKED", message: "Already clocked in for this date" };

    const shifts = await activeShifts(input.propertyId);
    const shift = matchShift(shifts, input.at, workDate);
    const record = await prisma.attendanceRecord.create({
      data: {
        userId: input.userId,
        propertyId: input.propertyId,
        shiftId: shift?.id ?? null,
        workDate,
        clockInAt: input.at,
        inLat: input.lat,
        inLng: input.lng,
        inGeoStatus: geo,
        source: input.source
      }
    });
    // Clock-in can already be late — derive immediately.
    const comp = computePunch({ workDate, clockInAt: input.at, clockOutAt: null, shift, rule: await overtimeRule(input.propertyId), inGeo: geo, outGeo: "unknown" });
    await prisma.$transaction(async (tx) => reconcileExceptions(tx, record, comp.exceptions), HEAVY_TX);
    await logAudit({
      actorId: input.userId,
      actorName: input.userName,
      module: "M23",
      action: "attendance.clock_in",
      entityType: "attendance_record",
      entityId: record.id,
      summary: `Clocked IN via ${input.source} at ${input.at.toISOString()}${geo !== "unknown" ? ` (${geo})` : ""}`,
      propertyId: input.propertyId,
      ip
    });
    await emitDomainEvent("attendance.clock_in", { recordId: record.id, userId: input.userId, source: input.source, geo }, input.propertyId);
    return { ok: true, data: { recordId: record.id, action: "in", userName: input.userName, at: input.at, workDate, shiftName: shift?.name ?? null, geoStatus: geo } };
  }

  // clock out: attach to the most recent open punch (any date — night shifts)
  const open = await prisma.attendanceRecord.findFirst({
    where: { userId: input.userId, clockOutAt: null },
    orderBy: { clockInAt: "desc" }
  });
  if (!open) return { ok: false, code: "NO_OPEN_PUNCH", message: "No open punch to close" };
  if (input.at.getTime() <= open.clockInAt.getTime()) {
    return { ok: false, code: "INVALID_CLOCK_OUT", message: "Clock-out must be after clock-in" };
  }
  await prisma.attendanceRecord.update({
    where: { id: open.id },
    data: { clockOutAt: input.at, outLat: input.lat, outLng: input.lng, outGeoStatus: geo }
  });
  const { minutesWorked } = await prisma.$transaction(async (tx) => recomputeInto(tx, open.id), HEAVY_TX);
  await logAudit({
    actorId: input.userId,
    actorName: input.userName,
    module: "M23",
    action: "attendance.clock_out",
    entityType: "attendance_record",
    entityId: open.id,
    summary: `Clocked OUT via ${input.source} at ${input.at.toISOString()} — ${minutesWorked ?? 0} min worked`,
    propertyId: open.propertyId,
    ip
  });
  await emitDomainEvent("attendance.clock_out", { recordId: open.id, userId: input.userId, minutesWorked, source: input.source, geo }, open.propertyId);
  return { ok: true, data: { recordId: open.id, action: "out", userName: input.userName, at: input.at, workDate: open.workDate, minutesWorked, geoStatus: geo } };
}

// ── manual entry / correction (M23:update — audited, reason mandatory) ──────

export async function createManualRecord(
  input: { userId: string; propertyId: string; clockInAt: Date; clockOutAt?: Date | null; reason: string; note?: string | null },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ recordId: string }>> {
  if (!input.reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "A correction reason is required (§M23: no edit without audit)" };
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, status: true } });
  if (!user) return { ok: false, code: "NOT_FOUND", message: "Staff user not found" };
  if (input.clockOutAt && input.clockOutAt.getTime() <= input.clockInAt.getTime()) {
    return { ok: false, code: "INVALID_RANGE", message: "Clock-out must be after clock-in" };
  }
  const workDate = workDateOf(input.clockInAt);
  const existing = await prisma.attendanceRecord.findUnique({ where: { userId_workDate: { userId: input.userId, workDate } } });
  if (existing) return { ok: false, code: "ALREADY_WORKED", message: "A record already exists for this date — edit it instead" };

  const shifts = await activeShifts(input.propertyId);
  const shift = matchShift(shifts, input.clockInAt, workDate);
  const record = await prisma.attendanceRecord.create({
    data: {
      userId: input.userId,
      propertyId: input.propertyId,
      shiftId: shift?.id ?? null,
      workDate,
      clockInAt: input.clockInAt,
      clockOutAt: input.clockOutAt ?? null,
      inGeoStatus: "unknown",
      outGeoStatus: "unknown",
      source: "manual",
      note: input.note ?? null,
      createdById: actor.id,
      editedById: actor.id,
      editedAt: new Date(),
      editReason: input.reason.trim()
    }
  });
  if (input.clockOutAt) await prisma.$transaction(async (tx) => recomputeInto(tx, record.id), HEAVY_TX);
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M23",
    action: "attendance.manual_create",
    entityType: "attendance_record",
    entityId: record.id,
    summary: `Manual record for ${user.name}: ${input.clockInAt.toISOString()} → ${input.clockOutAt?.toISOString() ?? "open"} — "${input.reason.trim()}"`,
    propertyId: input.propertyId,
    after: { clockInAt: input.clockInAt, clockOutAt: input.clockOutAt ?? null, reason: input.reason.trim() },
    ip
  });
  await emitDomainEvent("attendance.manual_create", { recordId: record.id, targetUserId: input.userId, actorId: actor.id }, input.propertyId);
  return { ok: true, data: { recordId: record.id } };
}

export async function editRecord(
  recordId: string,
  input: { clockInAt?: Date; clockOutAt?: Date | null; reason: string; note?: string | null },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ recordId: string; minutesWorked: number | null }>> {
  if (!input.reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "A correction reason is required (§M23: no edit without audit)" };
  const record = await prisma.attendanceRecord.findUnique({ where: { id: recordId } });
  if (!record) return { ok: false, code: "NOT_FOUND", message: "Attendance record not found" };
  const nextIn = input.clockInAt ?? record.clockInAt;
  const nextOut = input.clockOutAt === undefined ? record.clockOutAt : input.clockOutAt;
  if (nextOut && nextOut.getTime() <= nextIn.getTime()) {
    return { ok: false, code: "INVALID_RANGE", message: "Clock-out must be after clock-in" };
  }
  await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      clockInAt: nextIn,
      clockOutAt: nextOut,
      workDate: workDateOf(nextIn),
      note: input.note ?? record.note,
      editedById: actor.id,
      editedAt: new Date(),
      editReason: input.reason.trim()
    }
  });
  const { minutesWorked } = await prisma.$transaction(async (tx) => recomputeInto(tx, record.id), HEAVY_TX);
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M23",
    action: "attendance.edit",
    entityType: "attendance_record",
    entityId: record.id,
    summary: `Edited ${record.source} record: ${record.clockInAt.toISOString()}→${nextIn.toISOString()}, out ${record.clockOutAt?.toISOString() ?? "–"}→${nextOut?.toISOString() ?? "–"} — "${input.reason.trim()}"`,
    propertyId: record.propertyId,
    before: { clockInAt: record.clockInAt, clockOutAt: record.clockOutAt, minutesWorked: record.minutesWorked },
    after: { clockInAt: nextIn, clockOutAt: nextOut, reason: input.reason.trim() },
    ip
  });
  await emitDomainEvent("attendance.edited", { recordId: record.id, actorId: actor.id, reason: input.reason.trim() }, record.propertyId);
  return { ok: true, data: { recordId: record.id, minutesWorked } };
}

// ── sweep: flag missed punches (§M23 exception report) ───────────────────────

export async function sweepStaleOpen(actor: ActorCtx, ip?: string | null): Promise<Result<{ flagged: number; staleHours: number }>> {
  const cutoff = new Date(Date.now() - STALE_OPEN_HOURS * 3_600_000);
  const open = await prisma.attendanceRecord.findMany({ where: { clockOutAt: null, clockInAt: { lt: cutoff } } });
  let flagged = 0;
  for (const record of open) {
    const ageHours = (Date.now() - record.clockInAt.getTime()) / 3_600_000;
    const comp = computePunch({
      workDate: record.workDate,
      clockInAt: record.clockInAt,
      clockOutAt: null,
      shift: record.shiftId ? await prisma.shift.findUnique({ where: { id: record.shiftId } }) : null,
      rule: null,
      inGeo: (record.inGeoStatus ?? "unknown") as PunchGeo,
      outGeo: "unknown",
      openAgeHours: ageHours
    });
    if (comp.exceptions.length === 0) continue;
    await prisma.$transaction(async (tx) => reconcileExceptions(tx, record, comp.exceptions), HEAVY_TX);
    flagged += 1;
    await emitDomainEvent("attendance.exception_flagged", { recordId: record.id, types: comp.exceptions.map((e) => e.type) }, record.propertyId);
  }
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M23",
    action: "attendance.sweep",
    entityType: "attendance_record",
    entityId: "sweep",
    summary: `Attendance sweep: ${flagged} stale open punch(es) flagged missed_clock_out (> ${STALE_OPEN_HOURS}h)`,
    ip
  });
  return { ok: true, data: { flagged, staleHours: STALE_OPEN_HOURS } };
}

// ── exceptions ───────────────────────────────────────────────────────────────

export async function resolveException(
  exceptionId: string,
  input: { resolution: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  if (!input.resolution.trim()) return { ok: false, code: "RESOLUTION_REQUIRED", message: "A resolution note is required" };
  const exc = await prisma.attendanceException.findUnique({ where: { id: exceptionId } });
  if (!exc) return { ok: false, code: "NOT_FOUND", message: "Exception not found" };
  if (exc.status === "resolved") return { ok: false, code: "ALREADY_RESOLVED", message: "Exception already resolved" };
  await prisma.attendanceException.update({
    where: { id: exc.id },
    data: { status: "resolved", resolvedById: actor.id, resolvedAt: new Date(), resolution: input.resolution.trim() }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M23",
    action: "attendance.exception_resolved",
    entityType: "attendance_exception",
    entityId: exc.id,
    summary: `Resolved ${exc.type} (${exc.detail}) — "${input.resolution.trim()}"`,
    propertyId: exc.propertyId,
    ip
  });
  return { ok: true, data: { id: exc.id } };
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listRecords(input: { propertyId: string; from: Date; to: Date; userId?: string | null }) {
  return prisma.attendanceRecord.findMany({
    where: { propertyId: input.propertyId, workDate: { gte: input.from, lt: input.to }, ...(input.userId ? { userId: input.userId } : {}) },
    include: {
      user: { select: { name: true, email: true } },
      shift: { select: { name: true } },
      exceptions: { select: { id: true, type: true, status: true } }
    },
    orderBy: [{ workDate: "desc" }, { clockInAt: "asc" }]
  });
}

export async function monthlySummary(propertyId: string, month: string) {
  const range = monthRange(month);
  if (!range) return { ok: false as const, code: "INVALID_MONTH", message: "month must be YYYY-MM" };
  const [records, rule] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { propertyId, workDate: { gte: range.from, lt: range.to } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shift: true,
        exceptions: { select: { status: true } }
      }
    }),
    overtimeRule(propertyId)
  ]);
  const rows = summarize(
    records.map((r) => {
      const comp = computePunch({
        workDate: r.workDate,
        clockInAt: r.clockInAt,
        clockOutAt: r.clockOutAt,
        shift: r.shift,
        rule,
        inGeo: (r.inGeoStatus ?? "unknown") as PunchGeo,
        outGeo: (r.outGeoStatus ?? "unknown") as PunchGeo
      });
      return {
        userId: r.user.id,
        userName: r.user.name,
        email: r.user.email,
        clockOutAt: r.clockOutAt,
        minutesWorked: r.minutesWorked,
        overtimeMinutes: r.overtimeMinutes,
        lateMinutes: comp.lateMinutes,
        earlyMinutes: comp.earlyMinutes,
        openExceptions: r.exceptions.filter((e) => e.status === "open").length
      };
    })
  );
  return {
    ok: true as const,
    data: { month, rows, overtimeMultiplierBp: rule?.multiplierBp ?? null }
  };
}

export async function exportCsv(propertyId: string, month: string) {
  const range = monthRange(month);
  if (!range) return { ok: false as const, code: "INVALID_MONTH", message: "month must be YYYY-MM" };
  const records = await prisma.attendanceRecord.findMany({
    where: { propertyId, workDate: { gte: range.from, lt: range.to } },
    include: {
      user: { select: { name: true, email: true } },
      shift: { select: { name: true } },
      _count: { select: { exceptions: true } }
    },
    orderBy: [{ workDate: "asc" }, { clockInAt: "asc" }]
  });
  const rows: CsvRow[] = records.map((r) => ({
    workDate: r.workDate,
    userName: r.user.name,
    email: r.user.email,
    shiftName: r.shift?.name ?? null,
    clockInAt: r.clockInAt,
    clockOutAt: r.clockOutAt,
    minutesWorked: r.minutesWorked,
    overtimeMinutes: r.overtimeMinutes,
    source: r.source,
    exceptionCount: r._count.exceptions,
    note: r.note
  }));
  return { ok: true as const, data: { csv: attendanceCsv(rows), count: rows.length } };
}

export const ATTENDANCE_SOURCES_EXPORT = ATTENDANCE_SOURCES;
