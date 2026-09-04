import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createTicket } from "@/lib/operations/maintenance-service";

const createSchema = z.object({
  roomId: z.string().min(1).optional(),
  leaseId: z.string().min(1).optional(),
  propertyId: z.string().min(1).optional(),
  category: z.enum(["plumbing", "electrical", "appliance", "furniture", "internet", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  title: z.string().min(3).max(120),
  description: z.string().min(3).max(2000)
});

/// M19 list — RBDC-scoped: GLOBAL/PROPERTY staff see property tickets,
/// OWN roles (owner = own buildings, member = own tickets).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M19")) return fail(403, "FORBIDDEN", "Missing permission M19:read");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const grants = user.permissions.filter((p) => p.module === "M19" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const ownerPropertyIds = grants.some((g) => g.scope === "OWN") && user.partyId
    ? (await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { buildings: { select: { propertyId: true } } } }))?.buildings.map((b) => b.propertyId) ?? []
    : [];
  const tickets = await prisma.maintenanceTicket.findMany({
    include: { room: true, costs: true, member: { include: { party: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = tickets.filter((t) => {
    if (isGlobal || user.propertyIds.includes(t.propertyId) || ownerPropertyIds.includes(t.propertyId)) return true;
    return ownMemberId != null && t.memberProfileId === ownMemberId;
  });
  return ok({
    tickets: visible.map((t) => ({
      id: t.id,
      code: t.code,
      status: t.status,
      priority: t.priority,
      category: t.category,
      title: t.title,
      room: t.room?.number ?? "—",
      reporter: t.member ? t.member.party.name : "staff",
      slaDueAt: t.slaDueAt,
      slaBreachedAt: t.slaBreachedAt,
      costMinor: t.costs.reduce((s, c) => s + c.amountMinor, 0),
      createdAt: t.createdAt
    }))
  });
}

/// M19 create — staff/PM in scope, owners in OWN scope (matrix: Owner W),
/// members for their own lease (service-level own check).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  let scopePropertyId: string | null = parsed.data.propertyId ?? null;
  if (!scopePropertyId && parsed.data.roomId) {
    const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId }, include: { floor: { include: { building: true } } } });
    scopePropertyId = room?.floor.building.propertyId ?? null;
  }
  if (!scopePropertyId && parsed.data.leaseId) {
    const lease = await prisma.lease.findUnique({ where: { id: parsed.data.leaseId }, select: { propertyId: true } });
    scopePropertyId = lease?.propertyId ?? null;
  }
  if (!scopePropertyId) return fail(422, "PROPERTY_REQUIRED", "Ticket needs a room, lease or property");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const staffAllowed = can(user, "create", "M19", { propertyId: scopePropertyId });
  if (!staffAllowed && !ownMemberId) return fail(403, "FORBIDDEN", "Missing permission M19:create for this property");

  const result = await createTicket(
    { ...parsed.data, propertyId: scopePropertyId, source: staffAllowed ? "staff" : "portal" },
    { id: user.id, name: user.name },
    clientIp(req),
    { ownMemberId: staffAllowed ? null : ownMemberId, memberId: ownMemberId }
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 422;
    return fail(status, result.code, result.message);
  }
  return ok(result.data, 201);
}
