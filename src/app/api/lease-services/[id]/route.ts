import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const service = await prisma.leaseService.findUnique({ where: { id }, include: { lease: true } });
  if (!service) return fail(404, "NOT_FOUND", "Service not found");

  const g = await authorize("update", "M05", { propertyId: service.lease.propertyId });
  if (g.response) return g.response;
  if (service.lease.status !== "draft") {
    return fail(409, "IMMUTABLE", "Services can only be removed while the lease is a draft — mid-term stops prorate from Phase 10");
  }

  await prisma.leaseService.delete({ where: { id } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "lease_service",
    entityId: id,
    summary: `Removed service "${service.name}" from lease ${service.lease.code}`,
    propertyId: service.lease.propertyId,
    before: { name: service.name, amountMinor: service.amountMinor },
    ip: clientIp(req)
  });
  return ok({ deleted: true });
}
