import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toMinor } from "@/lib/money";

const patchSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  rentAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  billingCycleDay: z.coerce.number().int().min(1).max(28).optional(),
  prorationBasis: z.enum(["calendar", "thirty_day"]).optional(),
  depositTotal: z.coerce.number().min(0).max(1_000_000).optional(),
  depositInstallments: z.coerce.number().int().min(1).max(12).optional(),
  noticeDays: z.coerce.number().int().min(0).max(180).optional(),
  autoRenew: z.boolean().optional(),
  escalationPercent: z.coerce.number().int().min(0).max(50).nullable().optional()
});

/// Draft-only edits — activated leases are immutable (corrections via the
/// lifecycle, billing corrections via credit notes from Phase 6).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const lease = await prisma.lease.findUnique({ where: { id }, include: { member: { include: { party: true } }, room: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const g = await authorize("update", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;
  if (lease.status !== "draft") {
    return fail(409, "IMMUTABLE", "Only draft leases can be edited — active leases change via the lifecycle");
  }

  const d = parsed.data;
  const before = {
    startDate: lease.startDate, endDate: lease.endDate, rentAmountMinor: lease.rentAmountMinor,
    depositTotalMinor: lease.depositTotalMinor, noticeDays: lease.noticeDays, autoRenew: lease.autoRenew
  };
  const updated = await prisma.lease.update({
    where: { id },
    data: {
      startDate: d.startDate ? new Date(d.startDate) : undefined,
      endDate: d.endDate === undefined ? undefined : d.endDate ? new Date(d.endDate) : null,
      rentAmountMinor: d.rentAmount === undefined ? undefined : toMinor(d.rentAmount),
      billingCycleDay: d.billingCycleDay,
      prorationBasis: d.prorationBasis,
      depositTotalMinor: d.depositTotal === undefined ? undefined : toMinor(d.depositTotal),
      depositInstallments: d.depositInstallments,
      noticeDays: d.noticeDays,
      autoRenew: d.autoRenew,
      escalationPercent: d.escalationPercent === undefined ? undefined : d.escalationPercent
    }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "lease",
    entityId: id,
    summary: `Updated draft lease ${lease.code} (${lease.member.party.name}, room ${lease.room.number})`,
    propertyId: lease.propertyId,
    before,
    after: d,
    ip: clientIp(req)
  });
  return ok({ id: updated.id });
}

/// Draft-only deletion (not a posted record — financial records are never deleted).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lease = await prisma.lease.findUnique({ where: { id }, include: { member: { include: { party: true } }, room: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const g = await authorize("delete", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;
  if (lease.status !== "draft") {
    return fail(409, "NOT_DRAFT", "Only draft leases can be deleted — use the lifecycle to end real leases");
  }

  await prisma.$transaction(async (tx) => {
    await tx.leaseService.deleteMany({ where: { leaseId: id } });
    await tx.lease.delete({ where: { id } });
    const remaining = await tx.lease.count({ where: { roomId: lease.roomId, status: { in: ["draft", "active", "notice"] } } });
    if (remaining === 0 && lease.room.status === "reserved") {
      await tx.room.update({ where: { id: lease.roomId }, data: { status: "vacant" } });
    }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "delete",
    entityType: "lease",
    entityId: id,
    summary: `Deleted draft lease ${lease.code} (${lease.member.party.name}, room ${lease.room.number})`,
    propertyId: lease.propertyId,
    before: { code: lease.code, status: lease.status },
    ip: clientIp(req)
  });
  return ok({ deleted: true });
}
