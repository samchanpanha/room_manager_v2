import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { executeRoomMove } from "@/lib/rooms/moves-service";

const schema = z.object({ newRent: z.coerce.number().min(0).max(100_000).optional() });

/// Execute (§M16): ends the old lease, starts the new one, issues the single
/// adjustment invoice, flips both rooms. M16:update in the lease's scope.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const move = await prisma.roomMove.findUnique({ where: { id }, include: { fromLease: { select: { propertyId: true } } } });
  if (!move) return fail(404, "NOT_FOUND", "Move not found");
  if (!can(user, "update", "M16", { propertyId: move.fromLease.propertyId })) {
    return fail(403, "FORBIDDEN", "Missing permission M16:update for this lease");
  }
  const result = await executeRoomMove(
    id,
    { id: user.id, name: user.name },
    { newRentMinor: parsed.data.newRent != null ? Math.round(parsed.data.newRent * 100) : undefined },
    clientIp(req)
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" || result.code.startsWith("ROOM_") || result.code.startsWith("EFFECT_") ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result.data);
}
