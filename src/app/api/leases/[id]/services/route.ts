import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toMinor } from "@/lib/money";

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  amount: z.coerce.number().min(0).max(100_000),
  pricingModel: z.enum(["fixed_monthly", "per_use", "metered"]).default("fixed_monthly")
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const lease = await prisma.lease.findUnique({ where: { id }, include: { member: { include: { party: true } } } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  const g = await authorize("update", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;
  if (lease.status === "terminated" || lease.status === "completed") {
    return fail(409, "LEASE_ENDED", "Cannot add services to an ended lease");
  }

  const service = await prisma.leaseService.create({
    data: { leaseId: id, name: parsed.data.name, amountMinor: toMinor(parsed.data.amount), pricingModel: parsed.data.pricingModel }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "lease_service",
    entityId: service.id,
    summary: `Added service "${service.name}" (${(service.amountMinor / 100).toFixed(2)}/mo) to lease ${lease.code}`,
    propertyId: lease.propertyId,
    after: { name: service.name, amountMinor: service.amountMinor },
    ip: clientIp(req)
  });
  return ok({ id: service.id }, 201);
}
