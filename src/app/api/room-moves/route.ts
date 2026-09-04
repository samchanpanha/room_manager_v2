import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { requestRoomMove } from "@/lib/rooms/moves-service";
import { toMinor } from "@/lib/money";

const createSchema = z.object({
  fromLeaseId: z.string().min(1),
  toRoomId: z.string().min(1),
  effectiveAt: z.string().datetime(),
  newRent: z.coerce.number().min(0).max(100_000).optional(),
  note: z.string().max(300).optional()
});

/// M16 requests — member portal (own lease) or staff (M16:create in scope).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const lease = await prisma.lease.findUnique({ where: { id: parsed.data.fromLeaseId }, select: { memberProfileId: true, propertyId: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const isOwnLease = ownMemberId === lease.memberProfileId;
  const staffAllowed = can(user, "create", "M16", { propertyId: lease.propertyId });
  if (!isOwnLease && !staffAllowed) return fail(403, "FORBIDDEN", "Missing permission M16:create for this lease");

  const result = await requestRoomMove(
    {
      fromLeaseId: parsed.data.fromLeaseId,
      toRoomId: parsed.data.toRoomId,
      effectiveAt: new Date(parsed.data.effectiveAt),
      newRentMinor: parsed.data.newRent != null ? toMinor(parsed.data.newRent) : undefined,
      note: parsed.data.note
    },
    { id: user.id, name: user.name },
    { role: isOwnLease && !staffAllowed ? "member" : "staff", ownMemberId },
    clientIp(req)
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 422;
    return fail(status, result.code, result.message);
  }
  return ok(result.data, 201);
}

/// M16 list — staff/owners by property scope, members see their own moves.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M16")) return fail(403, "FORBIDDEN", "Missing permission M16:read");

  const grants = user.permissions.filter((p) => p.module === "M16" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const ownerPropertyIds = grants.some((g) => g.scope === "OWN") && user.partyId
    ? (
        await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { buildings: { select: { propertyId: true } } } })
      )?.buildings.map((b) => b.propertyId) ?? []
    : [];

  const moves = await prisma.roomMove.findMany({
    include: {
      member: { include: { party: true } },
      fromLease: true,
      toRoom: true,
      newLease: true,
      adjustmentInvoice: { select: { id: true, code: true, totalMinor: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = moves.filter((m) => {
    if (isGlobal) return true;
    if (ownMemberId && m.memberProfileId === ownMemberId) return true;
    return user.propertyIds.includes(m.fromLease.propertyId) || ownerPropertyIds.includes(m.fromLease.propertyId);
  });
  return ok({
    moves: visible.map((m) => ({
      id: m.id,
      code: m.code,
      member: { id: m.memberProfileId, name: m.member.party.name },
      fromLease: { id: m.fromLeaseId, code: m.fromLease.code },
      toRoom: { id: m.toRoomId, number: m.toRoom.number },
      newLease: m.newLease ? { id: m.newLease.id, code: m.newLease.code } : null,
      effectiveAt: m.effectiveAt,
      status: m.status,
      requestedByRole: m.requestedByRole,
      netMinor: m.netMinor,
      invoice: m.adjustmentInvoice ? { id: m.adjustmentInvoice.id, code: m.adjustmentInvoice.code, totalMinor: m.adjustmentInvoice.totalMinor } : null
    }))
  });
}
