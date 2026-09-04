import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Uppercase snake case, e.g. CASHIER"),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional()
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const g = await authorize("create", "M01");
  if (g.response) return g.response;

  const exists = await prisma.role.findUnique({ where: { key: parsed.data.key } });
  if (exists) return fail(409, "DUPLICATE", `Role key ${parsed.data.key} already exists`);

  const role = await prisma.role.create({ data: { ...parsed.data, isSystem: false, isProtected: false } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M01",
    action: "create",
    entityType: "role",
    entityId: role.id,
    summary: `Created role ${role.name} (${role.key})`,
    after: role,
    ip: clientIp(req)
  });
  return ok({ id: role.id }, 201);
}
