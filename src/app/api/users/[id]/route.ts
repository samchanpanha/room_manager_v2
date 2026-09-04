import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["active", "disabled"]).optional(),
  roleIds: z.array(z.string()).optional(),
  propertyIds: z.array(z.string()).optional(),
  name: z.string().min(2).max(120).optional()
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const target = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } }
  });
  if (!target) return fail(404, "NOT_FOUND", "User not found");

  const g = await authorize("update", "M01");
  if (g.response) return g.response;

  if (parsed.data.status === "disabled" && target.id === g.user.id) {
    return fail(422, "SELF_DISABLE", "You cannot disable your own account");
  }

  const d = parsed.data;
  const before = { status: target.status, roles: target.roles.map((r) => r.role.key), name: target.name };

  const user = await prisma.$transaction(async (tx) => {
    if (d.roleIds) {
      const roles = await tx.role.findMany({ where: { id: { in: d.roleIds } } });
      if (roles.length !== d.roleIds.length) throw new Error("Unknown role selected");
      if (roles.some((r) => r.key === "SUPER_ADMIN") && !g.user.isSuperAdmin) {
        throw new Error("Only a Super Admin can grant the Super Admin role");
      }
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: d.roleIds.map((roleId) => ({ userId: id, roleId })) });
    }
    if (d.propertyIds) {
      await tx.userPropertyAssignment.deleteMany({ where: { userId: id } });
      if (d.propertyIds.length > 0) {
        await tx.userPropertyAssignment.createMany({
          data: d.propertyIds.map((propertyId) => ({ userId: id, propertyId }))
        });
      }
    }
    return tx.user.update({ where: { id }, data: { status: d.status, name: d.name } });
  });

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M01",
    action: "update",
    entityType: "user",
    entityId: id,
    summary: `Updated user ${user.email}`,
    before,
    after: { status: user.status, roles: d.roleIds, name: user.name, propertyIds: d.propertyIds },
    ip: clientIp(req)
  });
  return ok({ id: user.id, status: user.status, name: user.name });
}
