/// Utilities service (M11): meters, readings (manual / estimate / CSV),
/// tariff resolution, charge computation + attachment to the next invoice
/// cycle. Charges are pending until generateInvoices folds them into an
/// invoice as `utility` lines (§M11); voiding that invoice reverts them.
import { prisma } from "@/lib/db";
import type { ActorCtx } from "@/lib/billing/service";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import {
  detectSpike,
  estimateFromHistory,
  formatMilli,
  isMeterType,
  meterDisplayName,
  pickTariff,
  tieredChargeMinor,
  toMilli
} from "./machines";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/// Create a meter bound to a room.
export async function createMeter(
  input: { code: string; type: string; roomId: string; unitLabel?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  if (!isMeterType(input.type)) return { ok: false, code: "INVALID_TYPE", message: "Meter type must be elec, water or gas" };
  const room = await prisma.room.findUnique({ where: { id: input.roomId }, include: { floor: { include: { building: true } } } });
  if (!room) return { ok: false, code: "NOT_FOUND", message: "Room not found" };
  const dup = await prisma.meter.findUnique({ where: { code: input.code } });
  if (dup) return { ok: false, code: "DUPLICATE_CODE", message: `Meter code ${input.code} already exists` };
  const propertyId = room.floor.building.propertyId;
  const meter = await prisma.meter.create({
    data: { code: input.code, type: input.type, roomId: room.id, unitLabel: input.unitLabel ?? (input.type === "water" ? "m³" : "kWh") }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M11",
    action: "meter.created",
    entityType: "meter",
    entityId: meter.id,
    summary: `Meter ${meter.code} (${input.type}) registered for room ${room.number}`,
    propertyId,
    ip
  });
  await emitDomainEvent("utility.meter_created", { meterId: meter.id, code: meter.code, type: input.type, roomId: room.id }, propertyId);
  return { ok: true, data: { id: meter.id } };
}

/// Latest tariff for a meter type at a moment: property-specific wins, then
/// latest effectiveFrom (pure pickTariff applied to the DB candidates).
export async function resolveTariff(utilityType: string, propertyId: string, at: Date) {
  const candidates = await prisma.tariff.findMany({ where: { utilityType, isActive: true } });
  return pickTariff(candidates, utilityType, propertyId, at);
}

export interface ReadingResult {
  readingId: string;
  valueMilli: number;
  consumptionMilli: number;
  estimated: boolean;
  chargeId: string | null;
  chargeMinor: number | null;
  anomaly: boolean;
  warnings: string[];
}

/// Record a reading (manual, or estimated = average of the last 3, §M11).
/// Computes consumption = reading − previous, prices it with the effective
/// tariff and creates a pending UtilityCharge for the room's active lease.
/// The first reading on a meter is a baseline (no charge).
export async function recordReading(
  meterId: string,
  input: { valueMilli?: number; estimate?: boolean; readAt?: Date; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<ReadingResult>> {
  const meter = await prisma.meter.findUnique({
    where: { id: meterId },
    include: { room: { include: { floor: { include: { building: true } } } } }
  });
  if (!meter || !meter.isActive) return { ok: false, code: "NOT_FOUND", message: "Meter not found" };
  const propertyId = meter.room.floor.building.propertyId;

  const readAt = input.readAt ?? new Date();
  const previous = await prisma.meterReading.findFirst({ where: { meterId }, orderBy: { readAt: "desc" } });
  if (previous && readAt.getTime() <= previous.readAt.getTime()) {
    return { ok: false, code: "READING_ORDER", message: "readAt must be after the latest existing reading" };
  }

  let valueMilli: number;
  let estimated = false;
  const warnings: string[] = [];
  if (input.estimate) {
    const history = await prisma.meterReading.findMany({ where: { meterId }, orderBy: { readAt: "desc" }, take: 3 });
    if (history.length < 3) {
      return { ok: false, code: "NOT_ENOUGH_HISTORY", message: "Estimates need at least 3 prior readings (§M11 average of last 3)" };
    }
    valueMilli = estimateFromHistory(history.map((h) => h.valueMilli));
    estimated = true;
    warnings.push("Estimated reading — average of last 3");
  } else {
    if (input.valueMilli == null || !Number.isInteger(input.valueMilli) || input.valueMilli < 0) {
      return { ok: false, code: "INVALID_READING", message: "Reading must be a non-negative integer (milli-units)" };
    }
    valueMilli = input.valueMilli;
    if (previous && valueMilli < previous.valueMilli) {
      return { ok: false, code: "INVALID_READING", message: `Reading is below the latest (${formatMilli(previous.valueMilli)} ${meter.unitLabel}) — meters only move forward` };
    }
  }

  const consumptionMilli = previous ? valueMilli - previous.valueMilli : 0;
  const priorConsumptions = await priorConsumptionsMilli(meterId);
  const spike = detectSpike(consumptionMilli, priorConsumptions);
  if (spike.anomaly) warnings.push(`Spike: consumption is more than 2× the recent average (${formatMilli(spike.averageMilli ?? 0)} ${meter.unitLabel})`);

  // Price with the effective tariff — only an active lease gets charged (§M11
  // charges attach to the lease's next invoice cycle).
  const activeLease = await prisma.lease.findFirst({ where: { roomId: meter.roomId, status: "active" } });
  let chargeId: string | null = null;
  let chargeMinor: number | null = null;

  const created = await prisma.$transaction(async (tx) => {
    const reading = await tx.meterReading.create({
      data: {
        meterId,
        valueMilli,
        readAt,
        estimated,
        source: estimated ? "estimate" : input.note?.startsWith("csv:") ? "csv" : "manual",
        note: input.note ?? null,
        createdById: actor.id
      }
    });
    if (activeLease && previous && consumptionMilli > 0) {
      const tariff = await resolveTariff(meter.type, propertyId, readAt);
      if (tariff) {
        const amountMinor = tieredChargeMinor(consumptionMilli, { unitRateMinor: tariff.unitRateMinor, tiers: tariff.tiers });
        const charge = await tx.utilityCharge.create({
          data: {
            leaseId: activeLease.id,
            roomId: meter.roomId,
            meterId,
            readingId: reading.id,
            periodStart: previous.readAt,
            periodEnd: readAt,
            consumptionMilli,
            amountMinor,
            tariffName: tariff.name,
            anomaly: spike.anomaly,
            note: spike.anomaly ? `Spike: > 2× recent average (${formatMilli(spike.averageMilli ?? 0)})` : null
          }
        });
        chargeId = charge.id;
        chargeMinor = amountMinor;
      }
    }
    return reading;
  });

  if (activeLease && previous && consumptionMilli > 0 && !chargeId) {
    warnings.push("No tariff configured for this meter type — reading stored without a charge");
  }
  if (!activeLease && consumptionMilli > 0) {
    warnings.push("Room has no active lease — reading stored without a charge");
  }

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M11",
    action: "reading.recorded",
    entityType: "meter_reading",
    entityId: created.id,
    summary: `Reading ${formatMilli(valueMilli)} ${meter.unitLabel} on ${meter.code} (${meter.room.number})${estimated ? " [estimated]" : ""} — consumption ${formatMilli(consumptionMilli)}${chargeMinor != null ? `, charge ${(chargeMinor / 100).toFixed(2)}` : ""}${spike.anomaly ? " ⚠ SPIKE" : ""}`,
    propertyId,
    ip
  });
  await emitDomainEvent(
    "utility.reading_recorded",
    { meterId, meterCode: meter.code, valueMilli, consumptionMilli, estimated, anomaly: spike.anomaly, chargeId },
    propertyId
  );
  if (spike.anomaly) {
    await emitDomainEvent("utility.anomaly", { meterId, meterCode: meter.code, consumptionMilli, averageMilli: spike.averageMilli }, propertyId);
  }

  return {
    ok: true,
    data: { readingId: created.id, valueMilli, consumptionMilli, estimated, chargeId, chargeMinor, anomaly: spike.anomaly, warnings }
  };
}

/// Consumptions (gaps) of the last readings on a meter, newest first — the
/// spike detector's history. The first-ever reading contributes no gap.
async function priorConsumptionsMilli(meterId: string): Promise<number[]> {
  const readings = await prisma.meterReading.findMany({ where: { meterId }, orderBy: { readAt: "desc" }, take: 7 });
  const gaps: number[] = [];
  for (let i = 0; i < readings.length - 1; i++) {
    const gap = readings[i].valueMilli - readings[i + 1].valueMilli;
    if (gap >= 0) gaps.push(gap);
  }
  return gaps;
}

/// CSV import (§M11): rows `YYYY-MM-DD,value[,note]` in display units.
export async function importReadingsCsv(
  meterId: string,
  csv: string,
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ imported: number; skipped: { line: number; reason: string }[] }>> {
  const meter = await prisma.meter.findUnique({ where: { id: meterId } });
  if (!meter || !meter.isActive) return { ok: false, code: "NOT_FOUND", message: "Meter not found" };
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const skipped: { line: number; reason: string }[] = [];
  let imported = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 2) {
      skipped.push({ line: lineNo, reason: "expected date,value[,note]" });
      continue;
    }
    const date = new Date(parts[0]);
    if (Number.isNaN(date.getTime())) {
      skipped.push({ line: lineNo, reason: "invalid date" });
      continue;
    }
    let milli: number;
    try {
      milli = toMilli(parts[1]);
    } catch {
      skipped.push({ line: lineNo, reason: "invalid value" });
      continue;
    }
    const result = await recordReading(meterId, { valueMilli: milli, readAt: date, note: `csv: ${parts[2] ?? ""}`.trim(), }, actor, ip);
    if (!result.ok) {
      skipped.push({ line: lineNo, reason: result.message });
      continue;
    }
    imported += 1;
  }
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M11",
    action: "readings.imported",
    entityType: "meter",
    entityId: meterId,
    summary: `CSV import on ${meter.code}: ${imported} imported, ${skipped.length} skipped`,
    propertyId: (await prisma.meter.findUnique({ where: { id: meterId }, include: { room: { include: { floor: { include: { building: true } } } } } }))?.room.floor.building.propertyId ?? null,
    ip
  });
  return { ok: true, data: { imported, skipped } };
}

/// Create/update a tariff (admin). Tiers payload validated by machines.
export async function upsertTariff(
  input: { utilityType: string; name: string; propertyId?: string | null; unitRateMinor: number; tiers?: unknown; effectiveFrom: Date },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  if (!isMeterType(input.utilityType)) return { ok: false, code: "INVALID_TYPE", message: "Tariff type must be elec, water or gas" };
  if (!Number.isInteger(input.unitRateMinor) || input.unitRateMinor < 0) {
    return { ok: false, code: "INVALID_RATE", message: "unitRateMinor must be a non-negative integer (minor per unit)" };
  }
  if (input.tiers != null && typeof input.tiers !== "object") {
    return { ok: false, code: "INVALID_TIERS", message: "tiers must be an array of { upToMilli, ratePerUnitMinor }" };
  }
  const tariff = await prisma.tariff.create({
    data: {
      utilityType: input.utilityType,
      name: input.name,
      propertyId: input.propertyId ?? null,
      unitRateMinor: input.unitRateMinor,
      tiers: (input.tiers ?? null) as never,
      effectiveFrom: input.effectiveFrom
    }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M11",
    action: "tariff.created",
    entityType: "tariff",
    entityId: tariff.id,
    summary: `Tariff "${input.name}" (${input.utilityType}) created — ${(input.unitRateMinor / 100).toFixed(2)} per unit, effective ${input.effectiveFrom.toISOString().slice(0, 10)}`,
    propertyId: input.propertyId ?? null,
    ip
  });
  return { ok: true, data: { id: tariff.id } };
}

/// Billing-engine hook: when an invoice is voided, its not-yet-settled utility
/// charges return to pending so the next cycle re-bills them (§M11).
export async function revertChargesForInvoice(invoiceId: string): Promise<number> {
  const result = await prisma.utilityCharge.updateMany({
    where: { invoiceId, status: "billed" },
    data: { status: "pending", invoiceId: null, invoiceItemId: null }
  });
  return result.count;
}

/// Convenience for the UI: charge label used on invoice lines.
export function chargeLabel(meterType: string, meterCode: string, consumptionMilli: number, unitLabel: string, anomaly: boolean): string {
  const base = `${meterDisplayName(meterType)} — ${meterCode} (${formatMilli(consumptionMilli)} ${unitLabel})`;
  return anomaly ? `${base} ⚠` : base;
}
