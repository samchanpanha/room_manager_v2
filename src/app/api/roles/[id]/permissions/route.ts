import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ACTIONS, MODULE_BY_KEY } from "@/lib/rbac/catalog";

const rowSchema = z.object({
  module: z.string().refine((m) => MODULE_BY_KEY.has(m), "Unknown module"),
  actions: z.array(z.enum(ACTIONS)),
  scope: z.enum(["GLOBAL", "PROPERTY", "OWN"])
});

const putSchema = z.object({ perms: z.array(rowSchema) });

/// Save the permission grid for a role (module × action × scope rows).
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, putSchema);
  if (parsed.response) return parsed.response;

  const role = await prisma.role.findUnique({ where: { id }, include: { permissions: true } });
  if (!role) return fail(404, "NOT_FOUND", "Role not found");
  if (role.isProtected) return fail(409, "PROTECTED", "The Super Admin role always has full access and cannot be edited");

  const g = await authorize("update", "M01");
  if (g.response) return g.response;

  const before = role.permissions.map((p) => ({ p: p.permissionId, s: p.scope }));
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({
      data: parsed.data.perms.flatMap((row) =>
        row.actions.map((action) => ({ roleId: id, permissionId: `${row.module}:${action}`, scope: row.scope }))
      )
    })
  ]);

  const after = parsed.data.perms.flatMap((row) => row.actions.map((a) => ({ p: `${row.module}:${a}`, s: row.scope })));
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M01",
    action: "update",
    entityType: "role_permissions",
    entityId: id,
    summary: `Updated permission grid for role ${role.name} (${before.length} → ${after.length} grants)`,
    before: { rows: before },
    after: { rows: after },
    ip: clientIp(req)
  });
  return ok({ saved: after.length });
}
