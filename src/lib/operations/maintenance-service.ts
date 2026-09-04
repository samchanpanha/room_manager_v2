/// M19 Maintenance service: ticket lifecycle (open → assigned → in_progress →
/// resolved → verified/closed), costs (labor/materials), and the SLA breach
/// sweep shared with M22 complaints. Member-own writes arrive with the portal
/// (Phase 18) / Telegram (M21) — the service already enforces own-lease rules.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { canTicketTransition, ticketSlaDueAt, totalCostMinor, type CostKind, type CostTarget } from "./maintenance-machine";
import type { ActorCtx } from "@/lib/payments/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export interface TicketCreateInput {
  propertyId?: string;
  roomId?: string;
  leaseId?: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  source: "portal" | "telegram" | "staff";
}

export type TicketDeps = {
  ownMemberId?: string | null; // member-own path
  memberId?: string | null; // resolved reporting member
};

/// Create a ticket. Property resolved from the room, else the lease, else
/// passed explicitly. Member source requires a member lease match.
export async function createTicket(input: TicketCreateInput, actor: ActorCtx, ip?: string | null, opts: TicketDeps = {}): Promise<Result<{ id: string; code: string; slaDueAt: Date }>> {
  let propertyId = input.propertyId ?? null;
  let roomId = input.roomId ?? null;
  const leaseId = input.leaseId ?? null;
  let memberProfileId = opts.memberId ?? null;

  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { floor: { include: { building: true } } } });
    if (!room) return { ok: false, code: "NOT_FOUND", message: "Room not found" };
    propertyId = room.floor.building.propertyId;
  }
  if (leaseId) {
    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
    propertyId = lease.propertyId;
    if (!roomId) roomId = lease.roomId;
    if (!memberProfileId) memberProfileId = lease.memberProfileId;
  }
  if (opts.ownMemberId) {
    // member-own: must be the lease holder (or lease-less member on own record)
    if (!memberProfileId || memberProfileId !== opts.ownMemberId) {
      return { ok: false, code: "FORBIDDEN", message: "Members can only raise tickets for their own lease" };
    }
  }
  if (!propertyId) return { ok: false, code: "PROPERTY_REQUIRED", message: "Ticket needs a room, lease or property" };
  if (!input.title.trim() || input.title.trim().length < 3) return { ok: false, code: "TITLE_REQUIRED", message: "A title (3+ chars) is required" };
  if (!input.description.trim() || input.description.trim().length < 3) return { ok: false, code: "DESCRIPTION_REQUIRED", message: "A description (3+ chars) is required" };

  const slaDueAt = ticketSlaDueAt(input.priority, new Date());
  if (!slaDueAt) return { ok: false, code: "INVALID_PRIORITY", message: "priority must be low | medium | high | urgent" };

  const code = await nextNumber("TK", (n) => `TK-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);
  const ticket = await prisma.maintenanceTicket.create({
    data: {
      code,
      propertyId,
      roomId,
      leaseId,
      memberProfileId,
      category: input.category,
      priority: input.priority,
      status: "open",
      title: input.title.trim(),
      description: input.description.trim(),
      source: input.source,
      reportedById: actor.auditActorId === undefined ? actor.id : null,
      slaDueAt
    }
  });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M19",
    action: "ticket.created",
    entityType: "maintenance_ticket",
    entityId: ticket.id,
    summary: `Ticket ${code} (${input.category}/${input.priority}) created: ${input.title.trim()}`,
    propertyId,
    ip
  });
  await emitDomainEvent("ticket.created", { ticketId: ticket.id, code, priority: input.priority, slaDueAt: slaDueAt.toISOString() }, propertyId);
  return { ok: true, data: { id: ticket.id, code, slaDueAt } };
}

async function loadTicket(id: string) {
  return prisma.maintenanceTicket.findUnique({ where: { id } });
}

export async function transitionTicket(
  ticketId: string,
  to: "assigned" | "in_progress" | "resolved" | "verified" | "closed" | "cancelled",
  input: { assignedToId?: string; vendorName?: string; resolutionNote?: string; reason?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ status: string }>> {
  const ticket = await loadTicket(ticketId);
  if (!ticket) return { ok: false, code: "NOT_FOUND", message: "Ticket not found" };
  if (!canTicketTransition(ticket.status, to)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot move a ${ticket.status} ticket to ${to}` };
  }
  const now = new Date();
  const data: Record<string, unknown> = { status: to };
  if (to === "assigned") {
    if (!input.assignedToId && !input.vendorName) return { ok: false, code: "ASSIGNEE_REQUIRED", message: "Assign a technician (userId) or a vendor name" };
    data.assignedToId = input.assignedToId ?? null;
    data.vendorName = input.vendorName ?? null;
    data.assignedAt = now;
  }
  if (to === "resolved") {
    if (!input.resolutionNote || input.resolutionNote.trim().length < 3) {
      return { ok: false, code: "RESOLUTION_REQUIRED", message: "A resolution note (3+ chars) is required" };
    }
    data.resolvedAt = now;
    data.resolutionNote = input.resolutionNote.trim();
  }
  if (to === "verified") {
    data.verifiedAt = now;
    data.verifiedById = actor.id;
  }
  if (to === "closed") data.closedAt = now;
  if (to === "cancelled") {
    if (!input.reason || input.reason.trim().length < 3) return { ok: false, code: "REASON_REQUIRED", message: "Cancellation requires a reason" };
    data.closedAt = now;
    data.resolutionNote = `cancelled: ${input.reason.trim()}`;
  }
  await prisma.maintenanceTicket.update({ where: { id: ticket.id }, data });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M19",
    action: `ticket.${to}`,
    entityType: "maintenance_ticket",
    entityId: ticket.id,
    summary: `Ticket ${ticket.code}: ${ticket.status} → ${to}${input.assignedToId ? ` → ${input.assignedToId}` : ""}${input.vendorName ? ` (vendor ${input.vendorName})` : ""}`,
    propertyId: ticket.propertyId,
    ip
  });
  await emitDomainEvent("ticket.transitioned", { ticketId: ticket.id, code: ticket.code, from: ticket.status, to }, ticket.propertyId);
  return { ok: true, data: { status: to } };
}

export async function addTicketCost(
  ticketId: string,
  input: { kind: string; label: string; amountMinor: number; stockItemId?: string; chargeTo?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ totalMinor: number }>> {
  const ticket = await loadTicket(ticketId);
  if (!ticket) return { ok: false, code: "NOT_FOUND", message: "Ticket not found" };
  if (!["labor", "material"].includes(input.kind)) return { ok: false, code: "INVALID_KIND", message: "kind must be labor | material" };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) return { ok: false, code: "INVALID_AMOUNT", message: "amountMinor must be a positive integer" };
  if (!input.label.trim()) return { ok: false, code: "LABEL_REQUIRED", message: "A label is required" };
  if (input.stockItemId) {
    const item = await prisma.stockItem.findUnique({ where: { id: input.stockItemId } });
    if (!item) return { ok: false, code: "STOCK_ITEM_NOT_FOUND", message: "Stock item not found" };
  }
  const chargeTo = input.chargeTo ?? "expense";
  if (!["expense", "owner"].includes(chargeTo)) return { ok: false, code: "INVALID_TARGET", message: "chargeTo must be expense | owner" };
  await prisma.maintenanceCost.create({
    data: {
      ticketId: ticket.id,
      kind: input.kind as CostKind,
      label: input.label.trim(),
      amountMinor: input.amountMinor,
      stockItemId: input.stockItemId ?? null,
      chargeTo: chargeTo as CostTarget,
      createdById: actor.id
    }
  });
  const costs = await prisma.maintenanceCost.findMany({ where: { ticketId: ticket.id } });
  const total = totalCostMinor(costs.map((c) => ({ kind: c.kind as CostKind, label: c.label, amountMinor: c.amountMinor })));
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M19",
    action: "ticket.cost_added",
    entityType: "maintenance_ticket",
    entityId: ticket.id,
    summary: `Cost ${(input.amountMinor / 100).toFixed(2)} (${input.kind}, ${chargeTo}) added to ${ticket.code} — total ${(total / 100).toFixed(2)}`,
    propertyId: ticket.propertyId,
    ip
  });
  return { ok: true, data: { totalMinor: total } };
}

/// SLA sweep (shared by M19 + M22): flags breached, un-escalated open work.
/// Escalation notifications ride M21 (Phase 19); for now breach = audit +
/// domain event + escalatedAt marker. `now` injectable for deterministic tests.
export async function escalateSlaBreaches(actor: ActorCtx, now: Date = new Date()): Promise<{ tickets: number; complaints: number }> {
  const breachedTickets = await prisma.maintenanceTicket.findMany({
    where: { slaDueAt: { lt: now }, slaBreachedAt: null, status: { in: ["open", "assigned", "in_progress"] } },
    take: 200
  });
  for (const t of breachedTickets) {
    await prisma.maintenanceTicket.update({ where: { id: t.id }, data: { slaBreachedAt: now, escalatedAt: now } });
    await logAudit({
      actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
      actorName: actor.name,
      module: "M19",
      action: "ticket.sla_breached",
      entityType: "maintenance_ticket",
      entityId: t.id,
      summary: `SLA breach: ticket ${t.code} (${t.priority}) open past ${t.slaDueAt.toISOString()} — escalated`,
      propertyId: t.propertyId
    });
    await emitDomainEvent("ticket.sla_breached", { ticketId: t.id, code: t.code, dueAt: t.slaDueAt.toISOString() }, t.propertyId);
  }

  const breachedComplaints = await prisma.complaint.findMany({
    where: { slaDueAt: { lt: now }, slaBreachedAt: null, status: { in: ["new", "acknowledged", "in_progress"] } },
    take: 200
  });
  for (const c of breachedComplaints) {
    await prisma.complaint.update({ where: { id: c.id }, data: { slaBreachedAt: now, escalatedAt: now } });
    await logAudit({
      actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
      actorName: actor.name,
      module: "M22",
      action: "complaint.sla_breached",
      entityType: "complaint",
      entityId: c.id,
      summary: `SLA breach: complaint ${c.code} (${c.priority}) unacknowledged past ${c.slaDueAt.toISOString()} — escalated`,
      propertyId: c.propertyId
    });
    await emitDomainEvent("complaint.sla_breached", { complaintId: c.id, code: c.code, dueAt: c.slaDueAt.toISOString() }, c.propertyId);
  }
  return { tickets: breachedTickets.length, complaints: breachedComplaints.length };
}
