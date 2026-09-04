import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { activateLease } from "@/lib/leases/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lease = await prisma.lease.findUnique({ where: { id }, include: { member: { include: { party: true } }, room: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const g = await authorize("update", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;

  const result = await activateLease(id);
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "lease_status",
    entityId: id,
    summary: `Lease ${lease.code} → active (${lease.member.party.name}, room ${lease.room.number}): ${result.notes.join("; ")}`,
    propertyId: lease.propertyId,
    before: { status: lease.status },
    after: { status: "active" },
    ip: clientIp(req)
  });
  return ok({ status: "active", notes: result.notes });
}
