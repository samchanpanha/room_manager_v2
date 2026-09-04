import { fail, ok, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";

/// §M27 revoke a session: your own any time; Admin+ may revoke anyone's
/// (§15 v1.4c audit scope). Revoked sessions die on their next getAuthUser().
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const session = await prisma.session.findUnique({ where: { id }, select: { id: true, userId: true, revokedAt: true } });
  if (!session) return fail(404, "NOT_FOUND", "No such session");

  const own = session.userId === user.id;
  if (!own && !(user.isSuperAdmin || hasModuleAccess(user, "update", "M27"))) {
    return fail(403, "FORBIDDEN", "Missing permission M27:update");
  }
  if (session.revokedAt) return ok({ revoked: false, already: true });

  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "update",
    entityType: "session",
    entityId: session.id,
    summary: own ? "Signed out a device (session revoked)" : "Admin revoked a user session",
    ip: clientIp(req)
  });
  return ok({ revoked: true });
}
