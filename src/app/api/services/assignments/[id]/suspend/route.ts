import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { suspendAssignment } from "@/lib/services/service";

const schema = z.object({
  at: z.string().datetime().optional() // defaults to now — mid-month suspend prorates (§M12)
});

/// Suspend a service assignment (closes the billing window at `at`).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const assignment = await prisma.serviceAssignment.findUnique({ where: { id }, include: { lease: true } });
  if (!assignment) return fail(404, "NOT_FOUND", "Assignment not found");
  const g = await authorize("update", "M12", { propertyId: assignment.lease.propertyId });
  if (g.response) return g.response;
  const result = await suspendAssignment(id, parsed.data.at ? new Date(parsed.data.at) : new Date(), { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" || result.code === "INVALID_DATE" ? 422 : 400, result.code, result.message);
  return ok(result.data);
}
