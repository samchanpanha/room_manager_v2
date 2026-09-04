import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loadOwnerGuardTarget } from "@/lib/owners";

const bodySchema = z.object({ buildingIds: z.array(z.string()).min(1) });

/// Assign buildings to an owner (M03:update). Refuses buildings already owned by someone else.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const target = await loadOwnerGuardTarget(id);
  if (!target) return fail(404, "NOT_FOUND", "Owner not found");
  const g = await authorize("update", "M03", { ownerUserId: target.ownerUserId });
  if (g.response) return g.response;

  const owner = await prisma.ownerProfile.findUnique({ where: { id }, include: { party: true } });
  if (!owner) return fail(404, "NOT_FOUND", "Owner not found");

  const assigned: string[] = [];
  for (const buildingId of parsed.data.buildingIds) {
    const b = await prisma.building.findUnique({ where: { id: buildingId }, include: { owner: { include: { party: true } }, property: true } });
    if (!b) return fail(404, "NOT_FOUND", `Building ${buildingId} not found`);
    if (b.ownerId === id) continue;
    if (b.ownerId) return fail(409, "BUILDING_OWNED", `${b.name} is already owned by ${b.owner?.party.name}`);
    await prisma.building.update({ where: { id: buildingId }, data: { ownerId: id } });
    assigned.push(`${b.property.code}/${b.name}`);
  }
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M03",
    action: "update",
    entityType: "owner_buildings",
    entityId: id,
    summary: `Assigned buildings [${assigned.join(", ")}] to owner ${owner.party.name}`,
    after: { assigned },
    ip: clientIp(req)
  });
  return ok({ assigned });
}

/// Unassign buildings from this owner.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const target = await loadOwnerGuardTarget(id);
  if (!target) return fail(404, "NOT_FOUND", "Owner not found");
  const g = await authorize("update", "M03", { ownerUserId: target.ownerUserId });
  if (g.response) return g.response;

  const owner = await prisma.ownerProfile.findUnique({ where: { id }, include: { party: true } });
  if (!owner) return fail(404, "NOT_FOUND", "Owner not found");

  const removed = await prisma.building.updateMany({
    where: { id: { in: parsed.data.buildingIds }, ownerId: id },
    data: { ownerId: null }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M03",
    action: "update",
    entityType: "owner_buildings",
    entityId: id,
    summary: `Unassigned ${removed.count} building(s) from owner ${owner.party.name}`,
    before: { buildingIds: parsed.data.buildingIds },
    ip: clientIp(req)
  });
  return ok({ removed: removed.count });
}
