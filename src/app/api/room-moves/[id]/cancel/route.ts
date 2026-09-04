import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { cancelRoomMove } from "@/lib/rooms/moves-service";

const schema = z.object({ reason: z.string().min(3).max(300) });

/// Cancel — the requester while pending, or M16:update in scope.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const move = await prisma.roomMove.findUnique({ where: { id }, include: { fromLease: { select: { propertyId: true, memberProfileId: true } } } });
  if (!move) return fail(404, "NOT_FOUND", "Move not found");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const isRequester = ownMemberId === move.fromLease.memberProfileId || move.requestedById === user.id;
  const staffAllowed = can(user, "update", "M16", { propertyId: move.fromLease.propertyId });
  if (!isRequester && !staffAllowed) return fail(403, "FORBIDDEN", "Only the requester or M16:update holders can cancel");

  const result = await cancelRoomMove(id, parsed.data.reason, { id: user.id, name: user.name }, { isRequester }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data);
}
