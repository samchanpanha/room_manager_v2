import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contract = await prisma.ownerContract.findUnique({
    where: { id },
    include: { owner: { include: { party: true } }, building: { include: { property: true } } }
  });
  if (!contract) return fail(404, "NOT_FOUND", "Contract not found");
  const g = await authorize("update", "M05", { propertyId: contract.building.propertyId });
  if (g.response) return g.response;
  if (contract.status !== "draft") return fail(422, "INVALID_TRANSITION", `Cannot activate a ${contract.status} contract`);

  await prisma.$transaction(async (tx) => {
    await tx.ownerContract.update({ where: { id }, data: { status: "active" } });
    // Contract becomes the authoritative ownership source (§15 v1.1):
    await tx.building.update({ where: { id: contract.buildingId }, data: { ownerId: contract.ownerProfileId } });
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "update",
    entityType: "owner_contract_status",
    entityId: id,
    summary: `Owner contract ${contract.code} → active (${contract.owner.party.name} ↔ ${contract.building.property.code}/${contract.building.name}); building ownership synced`,
    propertyId: contract.building.propertyId,
    before: { status: contract.status },
    after: { status: "active" },
    ip: clientIp(req)
  });
  await emitDomainEvent(
    "owner_contract.activated",
    { contractId: id, code: contract.code, ownerId: contract.ownerProfileId, buildingId: contract.buildingId },
    contract.building.propertyId
  );
  return ok({ status: "active" });
}
