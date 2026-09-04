import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(120),
  address: z.string().max(300).optional()
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const g = await authorize("create", "M04", { propertyId: parsed.data.propertyId });
  if (g.response) return g.response;

  const property = await prisma.property.findUnique({ where: { id: parsed.data.propertyId } });
  if (!property) return fail(404, "NOT_FOUND", "Property not found");

  const dupe = await prisma.building.findFirst({ where: { propertyId: property.id, name: parsed.data.name } });
  if (dupe) return fail(409, "DUPLICATE", "A building with this name already exists in the property");

  const building = await prisma.building.create({ data: parsed.data });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M04",
    action: "create",
    entityType: "building",
    entityId: building.id,
    summary: `Created building ${building.name} in ${property.name}`,
    propertyId: property.id,
    after: building,
    ip: clientIp(req)
  });
  return ok(building, 201);
}
