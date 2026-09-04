import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { completeInspection } from "@/lib/operations/inspections-service";

const schema = z.object({
  items: z.array(
    z.object({
      section: z.string().max(120).default(""),
      item: z.string().min(1).max(200),
      result: z.enum(["pass", "fail", "na"]),
      severity: z.enum(["minor", "major", "critical"]).optional(),
      note: z.string().max(500).optional(),
      photoDocId: z.string().min(1).optional()
    })
  ).min(1),
  summaryNote: z.string().max(500).optional()
});

/// Complete an inspection (M18:update in the property's scope — Staff W+).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const inspection = await prisma.inspection.findUnique({ where: { id }, select: { propertyId: true } });
  if (!inspection) return fail(404, "NOT_FOUND", "Inspection not found");
  if (!can(user, "update", "M18", { propertyId: inspection.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M18:update for this property");
  const result = await completeInspection(id, { items: parsed.data.items, summaryNote: parsed.data.summaryNote }, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data);
}
