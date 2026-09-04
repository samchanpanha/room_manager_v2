import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { transitionComplaint, addComplaintComment, convertComplaintToTicket } from "@/lib/operations/complaints-service";

const schema = z.object({
  op: z.enum(["acknowledge", "start", "resolve", "close", "comment", "convert"]),
  resolutionNote: z.string().max(1000).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  ratingNote: z.string().max(300).optional(),
  body: z.string().max(1000).optional(),
  photoDocId: z.string().min(1).optional(),
  category: z.enum(["plumbing", "electrical", "appliance", "furniture", "internet", "other"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional()
});

/// M22 operations. acknowledge/start/resolve/convert = M22:update in scope;
/// close (rate) and comment are member-own or M22:update holders.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const complaint = await prisma.complaint.findUnique({ where: { id }, select: { propertyId: true, memberProfileId: true } });
  if (!complaint) return fail(404, "NOT_FOUND", "Complaint not found");
  const scope = { propertyId: complaint.propertyId };
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const staffAllowed = can(user, "update", "M22", scope);
  const isOwn = ownMemberId != null && ownMemberId === complaint.memberProfileId;
  if (!staffAllowed && !isOwn) return fail(403, "FORBIDDEN", "Missing permission M22:update for this property");
  const actor = { id: user.id, name: user.name };
  const ip = clientIp(req);
  const d = parsed.data;

  if (d.op === "comment") {
    if (!d.body) return fail(422, "BODY_REQUIRED", "comment requires body");
    const result = await addComplaintComment(id, { body: d.body, photoDocId: d.photoDocId, byMember: isOwn && !staffAllowed }, actor, ip, { ownMemberId: staffAllowed ? null : ownMemberId });
    if (!result.ok) return fail(422, result.code, result.message);
    return ok(result.data, 201);
  }
  if (d.op === "convert") {
    if (!staffAllowed) return fail(403, "FORBIDDEN", "Conversion to a ticket needs M22:update");
    const result = await convertComplaintToTicket(id, { category: d.category, priority: d.priority }, actor, ip);
    if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
    return ok(result.data, 201);
  }
  const to = ({ acknowledge: "acknowledged", start: "in_progress", resolve: "resolved", close: "closed" } as const)[d.op];
  const result = await transitionComplaint(id, to, { resolutionNote: d.resolutionNote, rating: d.rating, ratingNote: d.ratingNote }, actor, ip, { ownMemberId: staffAllowed ? null : ownMemberId });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 422;
    return fail(status, result.code, result.message);
  }
  return ok(result.data);
}
