import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { approveRoomMove } from "@/lib/rooms/moves-service";

/// Approve (§M16: approval before execution) — M16:update in the lease's scope.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const move = await prisma.roomMove.findUnique({ where: { id }, include: { fromLease: { select: { propertyId: true } } } });
  if (!move) return fail(404, "NOT_FOUND", "Move not found");
  if (!can(user, "update", "M16", { propertyId: move.fromLease.propertyId })) {
    return fail(403, "FORBIDDEN", "Missing permission M16:update for this lease");
  }
  const result = await approveRoomMove(id, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data);
}
