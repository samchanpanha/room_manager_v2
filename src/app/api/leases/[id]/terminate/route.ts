import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { endLease } from "@/lib/leases/service";

const bodySchema = z.object({ reason: z.string().min(3).max(500) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);

  const lease = await prisma.lease.findUnique({ where: { id }, include: { member: { include: { party: true } }, room: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  const g = await authorize("update", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;
  if (parsed.response) return parsed.response;

  const result = await endLease(id, "terminated", parsed.data.reason);
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "lease_status",
    entityId: id,
    summary: `Lease ${lease.code} → terminated (${lease.member.party.name}, room ${lease.room.number}): ${parsed.data.reason} · ${result.notes.join("; ")}`,
    propertyId: lease.propertyId,
    before: { status: lease.status },
    after: { status: "terminated", reason: parsed.data.reason },
    ip: clientIp(req)
  });
  return ok({ status: "terminated", notes: result.notes });
}
