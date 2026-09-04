import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { openFindingTicket } from "@/lib/operations/inspections-service";

const schema = z.object({
  category: z.enum(["plumbing", "electrical", "appliance", "furniture", "internet", "other"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional()
});

/// Finding → maintenance ticket (matrix row 13 cross-link). M18:update holders.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const finding = await prisma.inspectionFinding.findUnique({ where: { id }, include: { inspection: { select: { propertyId: true } } } });
  if (!finding) return fail(404, "NOT_FOUND", "Finding not found");
  if (!can(user, "update", "M18", { propertyId: finding.inspection.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M18:update for this property");
  const result = await openFindingTicket(id, parsed.data, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
