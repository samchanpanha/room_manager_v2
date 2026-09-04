/// M23 Attendance — pure rules: month windows, shift spans, overtime,
/// geofence distance, exception derivation, CSV export and monthly summary.
/// DB work lives in attendance-service.ts. All instants are UTC; shift
/// minute offsets are evaluated against the property day (UTC demo convention).
import type { OvertimeRule, Shift } from "@prisma/client";

export const EXCEPTION_TYPES = [
  "late_clock_in",
  "early_clock_out",
  "missed_clock_in",
  "missed_clock_out",
  "overtime",
  "geofence_violation"
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export const ATTENDANCE_SOURCES = ["kiosk", "mobile", "manual"] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

/// Open punches older than this are flagged missed_clock_out by the sweep.
export const STALE_OPEN_HOURS = 16;

// ── windows ──────────────────────────────────────────────────────────────────

/// Parse "YYYY-MM" → [first of month 00:00 UTC, first of next month 00:00 UTC).
export function monthRange(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const from = new Date(Date.UTC(year, mon - 1, 1));
  const to = new Date(Date.UTC(year, mon, 1));
  return { from, to };
}

/// UTC midnight of the day containing `at` (the record's workDate key).
export function workDateOf(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── geofence (§M23 "optional geofence") ──────────────────────────────────────

/// Great-circle distance in meters (haversine, mean earth radius).
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export interface GeofenceCfg {
  geoLat: number | null;
  geoLng: number | null;
  geofenceRadiusM: number | null;
}

/// "unknown" when no coordinates captured or the property has no geofence.
export function geoStatus(lat: number | null | undefined, lng: number | null | undefined, cfg: GeofenceCfg): "inside" | "outside" | "unknown" {
  if (lat == null || lng == null || cfg.geoLat == null || cfg.geoLng == null || cfg.geofenceRadiusM == null) {
    return "unknown";
  }
  return haversineMeters(lat, lng, cfg.geoLat, cfg.geoLng) <= cfg.geofenceRadiusM ? "inside" : "outside";
}

// ── shifts & overtime ─────────────────────────────────────────────────────────

export interface ShiftSpan {
  start: Date;
  end: Date;
  spanMinutes: number;
}

/// Materialize a shift template on a work date. endMinute > 1440 rolls past
/// midnight (night shift). Minutes are offsets from the workDate's midnight.
export function shiftSpanFor(shift: Pick<Shift, "startMinute" | "endMinute">, workDate: Date): ShiftSpan {
  const start = new Date(workDate.getTime() + shift.startMinute * 60_000);
  const end = new Date(workDate.getTime() + shift.endMinute * 60_000);
  return { start, end, spanMinutes: shift.endMinute - shift.startMinute };
}

/// Pick the active shift whose window contains `at`, else the nearest start,
/// else null (unscheduled day).
export function matchShift(
  shifts: Array<Pick<Shift, "id" | "name" | "startMinute" | "endMinute" | "graceMinutes" | "isActive">>,
  at: Date,
  workDate: Date
): Pick<Shift, "id" | "name" | "startMinute" | "endMinute" | "graceMinutes"> | null {
  const active = shifts.filter((s) => s.isActive);
  if (active.length === 0) return null;
  const minuteOfDay = (at.getTime() - workDate.getTime()) / 60_000;
  const containing = active.find((s) => minuteOfDay >= s.startMinute && minuteOfDay < s.endMinute);
  if (containing) return containing;
  return [...active].sort(
    (a, b) => Math.abs(a.startMinute - minuteOfDay) - Math.abs(b.startMinute - minuteOfDay)
  )[0];
}

export interface PunchComputation {
  minutesWorked: number | null;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  exceptions: Array<{ type: ExceptionType; detail: string }>;
}

/// Derive minutes + exceptions for a punch pair (§M23 rules). `openAgeHours`
/// feeds the missed_clock_out heuristic (sweep passes the record's age).
export function computePunch(input: {
  workDate: Date;
  clockInAt: Date;
  clockOutAt: Date | null;
  shift: Pick<Shift, "startMinute" | "endMinute" | "graceMinutes"> | null;
  rule: Pick<OvertimeRule, "afterMinutes" | "isActive"> | null;
  inGeo: "inside" | "outside" | "unknown";
  outGeo: "inside" | "outside" | "unknown";
  openAgeHours?: number;
}): PunchComputation {
  const { workDate, clockInAt, clockOutAt, shift, rule } = input;
  const minutesWorked = clockOutAt
    ? Math.max(0, Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60_000))
    : null;
  const exceptions: PunchComputation["exceptions"] = [];
  let overtimeMinutes = 0;
  let lateMinutes = 0;
  let earlyMinutes = 0;

  const span = shift ? shiftSpanFor(shift, workDate) : null;

  if (shift && span) {
    const grace = (shift.graceMinutes ?? 0) * 60_000;
    if (clockInAt.getTime() > span.start.getTime() + grace) {
      lateMinutes = Math.round((clockInAt.getTime() - span.start.getTime()) / 60_000);
      exceptions.push({ type: "late_clock_in", detail: `Clocked in ${lateMinutes} min after shift start (${shift.startMinute} min)` });
    }
    if (clockOutAt && clockOutAt.getTime() < span.end.getTime() - grace) {
      earlyMinutes = Math.round((span.end.getTime() - clockOutAt.getTime()) / 60_000);
      exceptions.push({ type: "early_clock_out", detail: `Clocked out ${earlyMinutes} min before shift end (${shift.endMinute} min)` });
    }
    if (clockOutAt) {
      const otFloor = span.spanMinutes + (rule?.isActive ? rule.afterMinutes : 0);
      const overtimeRaw = Math.max(0, minutesWorked! - otFloor);
      overtimeMinutes = overtimeRaw;
      if (overtimeRaw > 0) {
        exceptions.push({ type: "overtime", detail: `${overtimeRaw} min beyond shift + grace window` });
      }
    }
  }

  if (!clockOutAt && (input.openAgeHours ?? 0) > STALE_OPEN_HOURS) {
    exceptions.push({ type: "missed_clock_out", detail: `Open punch for ${input.openAgeHours!.toFixed(1)}h with no clock-out` });
  }

  if (input.inGeo === "outside" || input.outGeo === "outside") {
    const which = input.inGeo === "outside" ? "Clock-in" : "Clock-out";
    exceptions.push({ type: "geofence_violation", detail: `${which} outside the property geofence` });
  }

  return { minutesWorked, overtimeMinutes, lateMinutes, earlyMinutes, exceptions };
}

// ── monthly summary (§M23 "monthly summary per staff") ───────────────────────

export interface SummaryRow {
  userId: string;
  userName: string;
  email: string;
  daysWorked: number;
  totalMinutes: number;
  overtimeMinutes: number;
  lateCount: number;
  earlyCount: number;
  openExceptions: number;
}

export function summarize(
  rows: Array<{
    userId: string;
    userName: string;
    email: string;
    clockOutAt: Date | null;
    minutesWorked: number | null;
    overtimeMinutes: number | null;
    lateMinutes: number;
    earlyMinutes: number;
    openExceptions: number;
  }>
): SummaryRow[] {
  const byUser = new Map<string, SummaryRow>();
  for (const r of rows) {
    let row = byUser.get(r.userId);
    if (!row) {
      row = { userId: r.userId, userName: r.userName, email: r.email, daysWorked: 0, totalMinutes: 0, overtimeMinutes: 0, lateCount: 0, earlyCount: 0, openExceptions: 0 };
      byUser.set(r.userId, row);
    }
    if (r.clockOutAt) row.daysWorked += 1; // completed days only
    row.totalMinutes += r.minutesWorked ?? 0;
    row.overtimeMinutes += r.overtimeMinutes ?? 0;
    if (r.lateMinutes > 0) row.lateCount += 1;
    if (r.earlyMinutes > 0) row.earlyCount += 1;
    row.openExceptions += r.openExceptions;
  }
  return [...byUser.values()].sort((a, b) => a.userName.localeCompare(b.userName));
}

// ── CSV export (§M23 "CSV export for payroll") ───────────────────────────────

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const ATTENDANCE_CSV_HEADER = "date,staff_name,staff_email,shift,clock_in,clock_out,minutes,overtime_minutes,source,exceptions,note";

export interface CsvRow {
  workDate: Date;
  userName: string;
  email: string;
  shiftName: string | null;
  clockInAt: Date;
  clockOutAt: Date | null;
  minutesWorked: number | null;
  overtimeMinutes: number | null;
  source: string;
  exceptionCount: number;
  note: string | null;
}

export function attendanceCsv(rows: CsvRow[]): string {
  const lines = [ATTENDANCE_CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [
        isoDay(r.workDate),
        r.userName,
        r.email,
        r.shiftName ?? "",
        r.clockInAt.toISOString(),
        r.clockOutAt ? r.clockOutAt.toISOString() : "",
        r.minutesWorked ?? "",
        r.overtimeMinutes ?? "",
        r.source,
        r.exceptionCount,
        r.note ?? ""
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}
