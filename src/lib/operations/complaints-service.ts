/// M22 Complaints service: new → acknowledged → in_progress → resolved →
/// closed (member confirms + rates 1–5), comment thread, and the one-click
/// conversion to a maintenance ticket (matrix row 13 cross-link).
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { canComplaintTransition, complaintSlaDueAt, isValidRating } from "./maintenance-machine";
import type { ActorCtx } from "@/lib/payments/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/// File a complaint. Member source requires the member's own record;
/// staff source files on behalf of a member.
export async function createComplaint(
  input: { memberProfileId: string; category: string; priority: string; subject: string; description: string; source: "portal" | "telegram" | "staff" },
  actor: ActorCtx,
  ip?: string | null,
  opts: { ownMemberId?: string | null } = {}
): Promise<Result<{ id: string; code: string; slaDueAt: Date }>> {
  const member = await prisma.memberProfile.findUnique({ where: { id: input.memberProfileId } });
  if (!member) return { ok: false, code: "NOT_FOUND", message: "Member not found" };
  if (opts.ownMemberId && opts.ownMemberId !== input.memberProfileId) {
    return { ok: false, code: "FORBIDDEN", message: "Members can only file their own complaints" };
  }
  if (input.subject.trim().length < 3) return { ok: false, code: "SUBJECT_REQUIRED", message: "A subject (3+ chars) is required" };
  if (input.description.trim().length < 3) return { ok: false, code: "DESCRIPTION_REQUIRED", message: "A description (3+ chars) is required" };
  const slaDueAt = complaintSlaDueAt(input.priority, new Date());
  if (!slaDueAt) return { ok: false, code: "INVALID_PRIORITY", message: "priority must be low | medium | high" };
  const activeLease = await prisma.lease.findFirst({ where: { memberProfileId: member.id, status: "active" }, orderBy: { createdAt: "desc" } });

  const code = await nextNumber("CMP", (n) => `CMP-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);
  const complaint = await prisma.complaint.create({
    data: {
      code,
      propertyId: member.homePropertyId ?? activeLease?.propertyId ?? (await prisma.property.findFirstOrThrow({ select: { id: true } })).id,
      memberProfileId: member.id,
      leaseId: activeLease?.id ?? null,
      category: input.category,
      priority: input.priority,
      source: input.source,
      status: "new",
      subject: input.subject.trim(),
      description: input.description.trim(),
      slaDueAt
    }
  });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M22",
    action: "complaint.created",
    entityType: "complaint",
    entityId: complaint.id,
    summary: `Complaint ${code} (${input.category}/${input.priority}, via ${input.source}): ${input.subject.trim()}`,
    propertyId: complaint.propertyId,
    ip
  });
  await emitDomainEvent("complaint.created", { complaintId: complaint.id, code, priority: input.priority, slaDueAt: slaDueAt.toISOString() }, complaint.propertyId);
  return { ok: true, data: { id: complaint.id, code, slaDueAt } };
}

export async function transitionComplaint(
  complaintId: string,
  to: "acknowledged" | "in_progress" | "resolved" | "closed",
  input: { resolutionNote?: string; rating?: number; ratingNote?: string },
  actor: ActorCtx,
  ip?: string | null,
  opts: { ownMemberId?: string | null } = {}
): Promise<Result<{ status: string }>> {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return { ok: false, code: "NOT_FOUND", message: "Complaint not found" };
  if (!canComplaintTransition(complaint.status, to)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot move a ${complaint.status} complaint to ${to}` };
  }
  const now = new Date();
  const data: Record<string, unknown> = { status: to };

  if (to === "acknowledged") data.assignedToId = complaint.assignedToId ?? actor.id;
  if (to === "resolved") {
    if (!input.resolutionNote || input.resolutionNote.trim().length < 3) {
      return { ok: false, code: "RESOLUTION_REQUIRED", message: "A resolution note (3+ chars) is required" };
    }
    data.resolvedAt = now;
    data.resolutionNote = input.resolutionNote.trim();
  }
  if (to === "closed") {
    // §M22: the member confirms resolution and rates — close is member-own.
    if (!opts.ownMemberId || opts.ownMemberId !== complaint.memberProfileId) {
      return { ok: false, code: "FORBIDDEN", message: "Only the reporting member can confirm resolution and close" };
    }
    if (input.rating == null || !isValidRating(input.rating)) {
      return { ok: false, code: "RATING_REQUIRED", message: "A 1–5 rating is required to close" };
    }
    data.rating = input.rating;
    data.ratingNote = input.ratingNote?.slice(0, 300) ?? null;
    data.closedAt = now;
  }
  await prisma.complaint.update({ where: { id: complaintId }, data });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M22",
    action: `complaint.${to}`,
    entityType: "complaint",
    entityId: complaint.id,
    summary: `Complaint ${complaint.code}: ${complaint.status} → ${to}${input.rating ? ` — rated ${input.rating}/5` : ""}`,
    propertyId: complaint.propertyId,
    ip
  });
  await emitDomainEvent("complaint.transitioned", { complaintId: complaint.id, code: complaint.code, from: complaint.status, to }, complaint.propertyId);
  return { ok: true, data: { status: to } };
}

export async function addComplaintComment(
  complaintId: string,
  input: { body: string; photoDocId?: string; byMember?: boolean },
  actor: ActorCtx,
  ip?: string | null,
  opts: { ownMemberId?: string | null } = {}
): Promise<Result<{ id: string }>> {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return { ok: false, code: "NOT_FOUND", message: "Complaint not found" };
  if (opts.ownMemberId && opts.ownMemberId !== complaint.memberProfileId) {
    return { ok: false, code: "FORBIDDEN", message: "Members can only comment on their own complaints" };
  }
  if (input.body.trim().length < 1) return { ok: false, code: "BODY_REQUIRED", message: "Comment body is required" };
  const comment = await prisma.complaintComment.create({
    data: {
      complaintId: complaint.id,
      authorById: input.byMember ? null : actor.id,
      byMember: input.byMember ?? false,
      body: input.body.trim(),
      photoDocId: input.photoDocId ?? null
    }
  });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M22",
    action: "complaint.commented",
    entityType: "complaint",
    entityId: complaint.id,
    summary: `Comment on ${complaint.code}${input.byMember ? " (member)" : ""}: ${input.body.trim().slice(0, 80)}`,
    propertyId: complaint.propertyId,
    ip
  });
  return { ok: true, data: { id: comment.id } };
}

/// One-click conversion to a maintenance ticket (matrix row 13): creates the
/// ticket from the complaint, links it and drops a thread comment.
export async function convertComplaintToTicket(
  complaintId: string,
  input: { category?: string; priority?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ ticketCode: string }>> {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { member: { include: { party: true } } } });
  if (!complaint) return { ok: false, code: "NOT_FOUND", message: "Complaint not found" };
  if (complaint.ticketId) return { ok: false, code: "TICKET_EXISTS", message: "Complaint already converted to a ticket" };
  const { createTicket } = await import("./maintenance-service");
  const ticket = await createTicket(
    {
      propertyId: complaint.propertyId,
      leaseId: complaint.leaseId ?? undefined,
      category: input.category ?? "other",
      priority: input.priority ?? (complaint.priority === "high" ? "high" : "medium"),
      title: `Complaint ${complaint.code}: ${complaint.subject}`,
      description: `${complaint.code} from ${complaint.member.party.name}: ${complaint.description}`,
      source: "staff"
    },
    actor,
    ip
  );
  if (!ticket.ok) return ticket;
  await prisma.complaint.update({ where: { id: complaintId }, data: { ticketId: ticket.data.id } });
  await prisma.complaintComment.create({
    data: {
      complaintId: complaint.id,
      authorById: actor.auditActorId === undefined ? actor.id : null,
      body: `Converted to maintenance ticket ${ticket.data.code}`
    }
  });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M22",
    action: "complaint.converted",
    entityType: "complaint",
    entityId: complaint.id,
    summary: `Complaint ${complaint.code} converted to maintenance ticket ${ticket.data.code}`,
    propertyId: complaint.propertyId,
    ip
  });
  await emitDomainEvent("complaint.converted", { complaintId: complaint.id, code: complaint.code, ticketCode: ticket.data.code }, complaint.propertyId);
  return { ok: true, data: { ticketCode: ticket.data.code } };
}
