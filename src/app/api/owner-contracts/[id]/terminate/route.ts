import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ reason: z.string().min(3).max(500), clearOwnership: z.boolean().default(true) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const contract = await prisma.ownerContract.findUnique({
    where: { id },
    include: { owner: { include: { party: true } }, building: { include: { property: true } } }
  });
  if (!contract) return fail(404, "NOT_FOUND", "Contract not found");
  const g = await authorize("update", "M05", { propertyId: contract.building.propertyId });
  if (g.response) return g.response;
  if (contract.status !== "active") return fail(422, "INVALID_TRANSITION", `Cannot terminate a ${contract.status} contract`);

  const otherActive = await prisma.ownerContract.findFirst({
    where: { buildingId: contract.buildingId, status: "active", id: { not: id } }
  });
  await prisma.$transaction(async (tx) => {
    await tx.ownerContract.update({
      where: { id },
      data: { status: "terminated", terminatedAt: new Date(), terminationReason: parsed.data.reason }
    });
    if (parsed.data.clearOwnership && !otherActive) {
      await tx.building.update({ where: { id: contract.buildingId }, data: { ownerId: null } });
    }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "owner_contract_status",
    entityId: id,
    summary: `Owner contract ${contract.code} → terminated: ${parsed.data.reason}`,
    propertyId: contract.building.propertyId,
    before: { status: contract.status },
    after: { status: "terminated", reason: parsed.data.reason },
    ip: clientIp(req)
  });
  return ok({ status: "terminated" });
}
