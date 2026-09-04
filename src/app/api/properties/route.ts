import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { clientIp } from "@/lib/api";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(16).regex(/^[A-Z0-9]+$/, "Uppercase letters and digits only"),
  address: z.string().max(300).optional()
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const g = await authorize("create", "M04");
  if (g.response) return g.response;

  const exists = await prisma.property.findUnique({ where: { code: parsed.data.code } });
  if (exists) return fail(409, "DUPLICATE", `Property code ${parsed.data.code} already exists`);

  const property = await prisma.property.create({ data: parsed.data });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M04",
    action: "create",
    entityType: "property",
    entityId: property.id,
    summary: `Created property ${property.name} (${property.code})`,
    propertyId: property.id,
    after: property,
    ip: clientIp(req)
  });
  await emitDomainEvent("property.created", { propertyId: property.id, code: property.code }, property.id);
  return ok(property, 201);
}
