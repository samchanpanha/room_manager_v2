import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { resolveException } from "@/lib/operations/attendance-service";

const schema = z.object({ resolution: z.string().min(3).max(500) });

/// Resolve an exception (M23:update; audited).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const exc = await prisma.attendanceException.findUnique({ where: { id }, select: { propertyId: true } });
  if (!exc) return fail(404, "NOT_FOUND", "Exception not found");
  if (!can(user, "update", "M23", { propertyId: exc.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M23:update for this property");
  const result = await resolveException(id, { resolution: parsed.data.resolution }, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data);
}
