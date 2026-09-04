import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createInspection } from "@/lib/operations/inspections-service";

const createSchema = z.object({
  type: z.enum(["move_in", "move_out", "periodic"]),
  leaseId: z.string().min(1),
  roomId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  note: z.string().max(300).optional()
});

/// M18 list — scoped by RBDC (property for staff/PM, own lease for members).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M18")) return fail(403, "FORBIDDEN", "Missing permission M18:read");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const grants = user.permissions.filter((p) => p.module === "M18" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const inspections = await prisma.inspection.findMany({
    include: { lease: { include: { member: { include: { party: true } } } }, room: true, findings: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = inspections.filter((i) => {
    if (isGlobal || user.propertyIds.includes(i.propertyId)) return true;
    return ownMemberId != null && i.lease.memberProfileId === ownMemberId;
  });
  return ok({
    inspections: visible.map((i) => ({
      id: i.id,
      code: i.code,
      type: i.type,
      status: i.status,
      member: i.lease.member.party.name,
      lease: i.lease.code,
      room: i.room.number,
      scheduledAt: i.scheduledAt,
      completedAt: i.completedAt,
      overallScore: i.overallScore,
      findings: i.findings.length,
      reportDocId: i.reportDocId
    }))
  });
}

/// M18 create (draft) — staff/PM in scope (W/M cells).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const lease = await prisma.lease.findUnique({ where: { id: parsed.data.leaseId }, select: { propertyId: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");
  if (!can(user, "create", "M18", { propertyId: lease.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M18:create for this property");
  const result = await createInspection(
    {
      type: parsed.data.type,
      leaseId: parsed.data.leaseId,
      roomId: parsed.data.roomId,
      templateId: parsed.data.templateId,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      note: parsed.data.note
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
