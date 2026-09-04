import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().min(1).max(60),
  level: z.coerce.number().int().min(-5).max(200)
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const building = await prisma.building.findUnique({ where: { id: parsed.data.buildingId } });
  if (!building) return fail(404, "NOT_FOUND", "Building not found");

  const g = await authorize("create", "M04", { propertyId: building.propertyId });
  if (g.response) return g.response;

  const dupe = await prisma.floor.findFirst({ where: { buildingId: building.id, name: parsed.data.name } });
  if (dupe) return fail(409, "DUPLICATE", "A floor with this name already exists in the building");

  const floor = await prisma.floor.create({ data: parsed.data });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M04",
    action: "create",
    entityType: "floor",
    entityId: floor.id,
    summary: `Created floor ${floor.name} (level ${floor.level}) in ${building.name}`,
    propertyId: building.propertyId,
    after: floor,
    ip: clientIp(req)
  });
  return ok(floor, 201);
}
