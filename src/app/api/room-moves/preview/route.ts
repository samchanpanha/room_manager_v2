import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { previewRoomMove } from "@/lib/rooms/moves-service";

const schema = z.object({
  fromLeaseId: z.string().min(1),
  toRoomId: z.string().min(1),
  effectiveAt: z.string().datetime(),
  newRent: z.coerce.number().min(0).max(100_000).optional()
});

/// Compute-only preview (§M16 "system computes rent proration delta,
/// deposit delta, move fee") — shown in the request/approval dialogs.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const lease = await prisma.lease.findUnique({ where: { id: parsed.data.fromLeaseId }, select: { memberProfileId: true, propertyId: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  if (ownMemberId !== lease.memberProfileId && !can(user, "create", "M16", { propertyId: lease.propertyId })) {
    return fail(403, "FORBIDDEN", "Missing permission M16:create for this lease");
  }
  const result = await previewRoomMove({
    fromLeaseId: parsed.data.fromLeaseId,
    toRoomId: parsed.data.toRoomId,
    effectiveAt: new Date(parsed.data.effectiveAt),
    newRentMinor: parsed.data.newRent != null ? Math.round(parsed.data.newRent * 100) : undefined
  });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 422;
    return fail(status, result.code, result.message);
  }
  return ok(result.data);
}
