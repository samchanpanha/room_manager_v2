import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  mustChangePassword: z.boolean().default(true),
  roleIds: z.array(z.string()).min(1, "Assign at least one role"),
  propertyIds: z.array(z.string()).default([])
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const g = await authorize("create", "M01");
  if (g.response) return g.response;

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail(409, "DUPLICATE", "A user with this email already exists");

  const roles = await prisma.role.findMany({ where: { id: { in: parsed.data.roleIds } } });
  if (roles.length !== parsed.data.roleIds.length) return fail(400, "INVALID_ROLE", "Unknown role selected");
  if (roles.some((r) => r.key === "SUPER_ADMIN") && !g.user.isSuperAdmin) {
    return fail(403, "PROTECTED_ROLE", "Only a Super Admin can grant the Super Admin role");
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: hashPassword(parsed.data.password),
      mustChangePassword: parsed.data.mustChangePassword,
      roles: { create: parsed.data.roleIds.map((roleId) => ({ roleId })) },
      assignments: { create: parsed.data.propertyIds.map((propertyId) => ({ propertyId })) }
    }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M01",
    action: "create",
    entityType: "user",
    entityId: user.id,
    summary: `Created user ${user.email} with roles: ${roles.map((r) => r.name).join(", ")}${parsed.data.mustChangePassword ? " — password change required at next sign-in" : ""}`,
    after: { email, roles: roles.map((r) => r.key), propertyIds: parsed.data.propertyIds },
    ip: clientIp(req)
  });
  return ok({ id: user.id }, 201);
}
