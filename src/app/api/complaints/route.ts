import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createComplaint } from "@/lib/operations/complaints-service";

const createSchema = z.object({
  memberProfileId: z.string().min(1),
  category: z.enum(["noise", "cleanliness", "neighbor", "staff", "facility", "billing", "other"]),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  subject: z.string().min(3).max(120),
  description: z.string().min(3).max(2000)
});

/// M22 list — staff by property scope, members see their own.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M22")) return fail(403, "FORBIDDEN", "Missing permission M22:read");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const grants = user.permissions.filter((p) => p.module === "M22" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const complaints = await prisma.complaint.findMany({
    include: { member: { include: { party: true } }, comments: { orderBy: { createdAt: "asc" } }, ticket: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = complaints.filter((c) => {
    if (isGlobal || user.propertyIds.includes(c.propertyId)) return true;
    return ownMemberId != null && c.memberProfileId === ownMemberId;
  });
  return ok({
    complaints: visible.map((c) => ({
      id: c.id,
      code: c.code,
      status: c.status,
      priority: c.priority,
      category: c.category,
      subject: c.subject,
      member: c.member.party.name,
      slaDueAt: c.slaDueAt,
      slaBreachedAt: c.slaBreachedAt,
      rating: c.rating,
      ticketCode: c.ticket?.code ?? null,
      comments: c.comments.length
    }))
  });
}

/// M22 create — staff on behalf (source staff), members own (source portal).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const target = await prisma.memberProfile.findUnique({ where: { id: parsed.data.memberProfileId }, select: { homePropertyId: true } });
  const scope = { propertyId: target?.homePropertyId ?? undefined };
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const staffAllowed = can(user, "create", "M22", scope);
  const isOwn = ownMemberId != null && ownMemberId === parsed.data.memberProfileId;
  if (!staffAllowed && !isOwn) return fail(403, "FORBIDDEN", "Members can only file their own complaints");
  const result = await createComplaint(
    { ...parsed.data, source: staffAllowed && !isOwn ? "staff" : "portal" },
    { id: user.id, name: user.name },
    clientIp(req),
    { ownMemberId: staffAllowed && !isOwn ? null : ownMemberId }
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
