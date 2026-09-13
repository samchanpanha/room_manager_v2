import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(300).optional(),
  active: z.boolean().optional()
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return fail(404, "NOT_FOUND", "Role not found");

  const g = await authorize("update", "M01");
  if (g.response) return g.response;

  // Protected roles (Super Admin) can be renamed but never disabled — a hard
  // lock against locking the last admin out of the system (§M01).
  if (parsed.data.active === false && role.isProtected) {
    return fail(409, "PROTECTED", "Protected roles cannot be disabled");
  }

  const updated = await prisma.role.update({ where: { id }, data: parsed.data });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M01",
    action: "update",
    entityType: "role",
    entityId: id,
    summary:
      parsed.data.active === false
        ? `Disabled role ${updated.name} — its memberships no longer grant permissions`
        : parsed.data.active === true
          ? `Re-enabled role ${updated.name}`
          : `Updated role ${updated.name}`,
    before: role,
    after: updated,
    ip: clientIp(req)
  });
  return ok(updated);
}

/// Rule: a role in use cannot be deleted; protected roles never.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } }
  });
  if (!role) return fail(404, "NOT_FOUND", "Role not found");

  const g = await authorize("delete", "M01");
  if (g.response) return g.response;
  if (role.isProtected) return fail(409, "PROTECTED", "This role is protected and cannot be deleted");
  if (role._count.users > 0) return fail(409, "IN_USE", "Role is assigned to users and cannot be deleted");

  await prisma.role.delete({ where: { id } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M01",
    action: "delete",
    entityType: "role",
    entityId: id,
    summary: `Deleted role ${role.name} (${role.key})`,
    before: role,
    ip: clientIp(req)
  });
  return ok({ deleted: true });
}
