/// Services (M12): billable add-on catalog + lease assignments (WiFi /
/// parking / laundry / general), per-use entries, prorated suspension.
///
/// Billing integration:
///  - fixed_monthly assignments mirror into the lease's LeaseService snapshot
///    with an optional [activeFrom, activeThrough) window — the rent engine
///    prorates the overlap (mid-month suspend → prorated stop, §M12).
///  - per_use entries (ServiceUsage) ride to the next invoice as one-time lines.
///  - metered services are billed via M11 meters (utility charges).
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { toMilli, formatMilli } from "@/lib/utilities/machines";
import type { ActorCtx } from "@/lib/billing/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export const PRICING_MODELS = ["fixed_monthly", "per_use", "metered"] as const;
export function isPricingModel(v: string): v is (typeof PRICING_MODELS)[number] {
  return (PRICING_MODELS as readonly string[]).includes(v);
}

/// Create a catalog service.
export async function createService(
  input: { code: string; name: string; pricingModel: string; price: number; unitLabel?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string }>> {
  if (!isPricingModel(input.pricingModel)) {
    return { ok: false, code: "INVALID_PRICING", message: `pricingModel must be one of ${PRICING_MODELS.join(", ")}` };
  }
  if (!/^[A-Z0-9-]{2,20}$/.test(input.code)) return { ok: false, code: "INVALID_CODE", message: "code must be 2–20 chars A-Z 0-9 dash" };
  const dup = await prisma.serviceCatalog.findUnique({ where: { code: input.code } });
  if (dup) return { ok: false, code: "DUPLICATE_CODE", message: `Service code ${input.code} already exists` };
  const service = await prisma.serviceCatalog.create({
    data: {
      code: input.code,
      name: input.name,
      pricingModel: input.pricingModel,
      unitPriceMinor: Math.round(input.price * 100),
      unitLabel: input.unitLabel ?? null
    }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M12",
    action: "service.created",
    entityType: "service_catalog",
    entityId: service.id,
    summary: `Service "${service.name}" (${input.pricingModel}) added to catalog at ${(service.unitPriceMinor / 100).toFixed(2)}`,
    ip
  });
  return { ok: true, data: { id: service.id } };
}

/// Assign a catalog service to a lease (§M12). Parking assigns a slot
/// uniquely; WiFi activates the account; fixed_monthly creates the billing
/// snapshot (window starts at startDate).
export async function assignService(
  leaseId: string,
  input: { serviceId: string; startDate?: Date; parkingSlotCode?: string; wifiSsid?: string; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ assignmentId: string }>> {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId }, include: { member: { include: { party: true } } } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  if (lease.status !== "active") return { ok: false, code: "LEASE_NOT_ACTIVE", message: "Services can only be assigned to an active lease" };
  const service = await prisma.serviceCatalog.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.isActive) return { ok: false, code: "NOT_FOUND", message: "Catalog service not found or inactive" };

  let parkingSlotId: string | null = null;
  let wifiAccountId: string | null = null;
  let priceMinor = service.unitPriceMinor;
  let nameSuffix = "";

  if (input.parkingSlotCode) {
    if (service.pricingModel !== "fixed_monthly") {
      return { ok: false, code: "INVALID_PRICING", message: "Parking binds to fixed_monthly services" };
    }
    const slot = await prisma.parkingSlot.findUnique({ where: { code: input.parkingSlotCode } });
    if (!slot) return { ok: false, code: "NOT_FOUND", message: `Parking slot ${input.parkingSlotCode} not found` };
    if (slot.status !== "free") return { ok: false, code: "SLOT_TAKEN", message: `Parking slot ${slot.code} is already assigned` };
    if (slot.propertyId !== lease.propertyId) return { ok: false, code: "SLOT_OTHER_PROPERTY", message: "Parking slot belongs to another property" };
    parkingSlotId = slot.id;
    priceMinor = slot.monthlyFeeMinor || service.unitPriceMinor;
    nameSuffix = ` (${slot.code})`;
  }
  if (input.wifiSsid) {
    if (service.pricingModel !== "fixed_monthly") {
      return { ok: false, code: "INVALID_PRICING", message: "WiFi binds to fixed_monthly services" };
    }
    const wifi = await prisma.wifiAccount.findUnique({ where: { ssid: input.wifiSsid } });
    if (!wifi) return { ok: false, code: "NOT_FOUND", message: `WiFi account ${input.wifiSsid} not found` };
    if (wifi.status !== "free") return { ok: false, code: "WIFI_TAKEN", message: `WiFi account ${wifi.ssid} is already assigned` };
    if (wifi.propertyId !== lease.propertyId) return { ok: false, code: "WIFI_OTHER_PROPERTY", message: "WiFi account belongs to another property" };
    wifiAccountId = wifi.id;
  }

  const startDate = input.startDate ?? new Date();
  const assignment = await prisma.$transaction(async (tx) => {
    let snapshotId: string | null = null;
    if (service.pricingModel === "fixed_monthly") {
      const snapshot = await tx.leaseService.create({
        data: {
          leaseId,
          name: `${service.name}${nameSuffix}`,
          amountMinor: priceMinor,
          pricingModel: "fixed_monthly",
          activeFrom: startDate
        }
      });
      snapshotId = snapshot.id;
    }
    return tx.serviceAssignment.create({
      data: {
        serviceId: service.id,
        leaseId,
        startDate,
        parkingSlotId,
        wifiAccountId,
        snapshotId,
        note: input.note ?? null
      }
    });
  });

  if (parkingSlotId) await prisma.parkingSlot.update({ where: { id: parkingSlotId }, data: { status: "assigned" } });
  if (wifiAccountId) await prisma.wifiAccount.update({ where: { id: wifiAccountId }, data: { status: "assigned" } });

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M12",
    action: "service.assigned",
    entityType: "service_assignment",
    entityId: assignment.id,
    summary: `${service.name} assigned to ${lease.code} (${lease.member.party.name})${input.parkingSlotCode ? ` — slot ${input.parkingSlotCode}` : ""}${input.wifiSsid ? ` — WiFi ${input.wifiSsid} activated` : ""}`,
    propertyId: lease.propertyId,
    ip
  });
  await emitDomainEvent(
    "service.assigned",
    { assignmentId: assignment.id, service: service.code, leaseCode: lease.code, parkingSlotId, wifiAccountId },
    lease.propertyId
  );
  return { ok: true, data: { assignmentId: assignment.id } };
}

/// Suspend an assignment mid-cycle (§M12 acceptance: prorated stop). The
/// billing snapshot's window closes at `at`, so the current period bills only
/// the active days; the WiFi account is suspended.
export async function suspendAssignment(
  assignmentId: string,
  at: Date,
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ suspendedAt: Date }>> {
  const assignment = await prisma.serviceAssignment.findUnique({
    where: { id: assignmentId },
    include: { service: true, lease: { include: { member: { include: { party: true } } } } }
  });
  if (!assignment) return { ok: false, code: "NOT_FOUND", message: "Assignment not found" };
  if (assignment.status !== "active") return { ok: false, code: "INVALID_TRANSITION", message: `Cannot suspend a ${assignment.status} assignment` };
  if (at.getTime() < assignment.startDate.getTime()) {
    return { ok: false, code: "INVALID_DATE", message: "Suspension date is before the assignment start" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceAssignment.update({ where: { id: assignmentId }, data: { status: "suspended", suspendedAt: at } });
    if (assignment.snapshotId) {
      await tx.leaseService.update({ where: { id: assignment.snapshotId }, data: { activeThrough: at } });
    }
    if (assignment.wifiAccountId) {
      await tx.wifiAccount.update({ where: { id: assignment.wifiAccountId }, data: { status: "suspended" } });
    }
  });

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M12",
    action: "service.suspended",
    entityType: "service_assignment",
    entityId: assignmentId,
    summary: `${assignment.service.name} suspended for ${assignment.lease.code} (${assignment.lease.member.party.name}) at ${at.toISOString().slice(0, 10)} — current cycle bills the active days only`,
    propertyId: assignment.lease.propertyId,
    ip
  });
  await emitDomainEvent("service.suspended", { assignmentId, service: assignment.service.code, leaseCode: assignment.lease.code, at: at.toISOString() }, assignment.lease.propertyId);
  return { ok: true, data: { suspendedAt: at } };
}

/// End an assignment (lease end / move-out): window closes, parking slot and
/// WiFi account are released.
export async function endAssignment(
  assignmentId: string,
  at: Date,
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ endedAt: Date }>> {
  const assignment = await prisma.serviceAssignment.findUnique({
    where: { id: assignmentId },
    include: { service: true, lease: true }
  });
  if (!assignment) return { ok: false, code: "NOT_FOUND", message: "Assignment not found" };
  if (assignment.status === "ended") return { ok: false, code: "INVALID_TRANSITION", message: "Assignment already ended" };

  await prisma.$transaction(async (tx) => {
    await tx.serviceAssignment.update({ where: { id: assignmentId }, data: { status: "ended", endedAt: at } });
    if (assignment.snapshotId) {
      await tx.leaseService.update({ where: { id: assignment.snapshotId }, data: { activeThrough: at } });
    }
    if (assignment.parkingSlotId) {
      await tx.parkingSlot.update({ where: { id: assignment.parkingSlotId }, data: { status: "free" } });
    }
    if (assignment.wifiAccountId) {
      await tx.wifiAccount.update({ where: { id: assignment.wifiAccountId }, data: { status: "free" } });
    }
  });

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M12",
    action: "service.ended",
    entityType: "service_assignment",
    entityId: assignmentId,
    summary: `${assignment.service.name} ended for ${assignment.lease.code}${assignment.parkingSlotId ? " — parking slot released" : ""}${assignment.wifiAccountId ? " — WiFi account released" : ""}`,
    propertyId: assignment.lease.propertyId,
    ip
  });
  return { ok: true, data: { endedAt: at } };
}

/// Record a per-use entry (laundry kg, visitor parking…) — rides to the next
/// invoice as a one-time line (§M12).
export async function recordUsage(
  leaseId: string,
  input: { serviceId: string; qty: number; usedAt?: Date; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ usageId: string; amountMinor: number }>> {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  if (lease.status !== "active") return { ok: false, code: "LEASE_NOT_ACTIVE", message: "Usages can only be recorded on an active lease" };
  const service = await prisma.serviceCatalog.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.isActive) return { ok: false, code: "NOT_FOUND", message: "Catalog service not found or inactive" };
  if (service.pricingModel !== "per_use") {
    return { ok: false, code: "INVALID_PRICING", message: `${service.name} is ${service.pricingModel} — per-use entries apply to per_use services` };
  }
  let qtyMilli: number;
  try {
    qtyMilli = toMilli(input.qty);
  } catch {
    return { ok: false, code: "INVALID_QTY", message: "qty must be a positive number (up to 3 decimals)" };
  }
  if (qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "qty must be positive" };

  const usedAt = input.usedAt ?? new Date();
  const usage = await prisma.serviceUsage.create({
    data: {
      serviceId: service.id,
      leaseId,
      qtyMilli,
      unitLabel: service.unitLabel,
      unitPriceMinor: service.unitPriceMinor,
      usedAt,
      note: input.note ?? null,
      createdById: actor.id
    }
  });
  const amountMinor = Math.round((service.unitPriceMinor * qtyMilli) / 1000);
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M12",
    action: "service.usage_recorded",
    entityType: "service_usage",
    entityId: usage.id,
    summary: `${service.name} usage ${formatMilli(qtyMilli)} ${service.unitLabel ?? "unit"} for ${lease.code} — ${(amountMinor / 100).toFixed(2)} on next invoice`,
    propertyId: lease.propertyId,
    ip
  });
  await emitDomainEvent("service.usage_recorded", { usageId: usage.id, service: service.code, leaseCode: lease.code, qtyMilli, amountMinor }, lease.propertyId);
  return { ok: true, data: { usageId: usage.id, amountMinor } };
}

/// Lease-end hook: end every active/suspended assignment, closing billing
/// windows and releasing parking/WiFi resources.
export async function endAssignmentsForLease(leaseId: string, at: Date, actor: ActorCtx): Promise<number> {
  const assignments = await prisma.serviceAssignment.findMany({ where: { leaseId, status: { in: ["active", "suspended"] } } });
  for (const a of assignments) {
    await endAssignment(a.id, at, actor);
  }
  return assignments.length;
}

/// Billing-engine hook: voided invoices release their per-use lines back to
/// pending (they will ride the next cycle again).
export async function revertUsagesForInvoice(invoiceId: string): Promise<number> {
  const result = await prisma.serviceUsage.updateMany({
    where: { invoiceId, status: "billed" },
    data: { status: "pending", invoiceId: null, invoiceItemId: null }
  });
  return result.count;
}
