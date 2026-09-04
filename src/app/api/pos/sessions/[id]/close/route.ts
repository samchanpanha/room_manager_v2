import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { closeSession } from "@/lib/operations/pos-service";

const schema = z.object({ counted: z.coerce.number().min(0).max(1_000_000), note: z.string().max(300).optional() });

/// §M14 close: expected vs counted cash, variance report.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const session = await prisma.posSession.findUnique({ where: { id } });
  if (!session) return fail(404, "NOT_FOUND", "Session not found");
  if (!can(user, "update", "M14", { propertyId: session.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M14:update for this property");
  const result = await closeSession(id, { countedCashMinor: Math.round(parsed.data.counted * 100), note: parsed.data.note }, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(422, result.code, result.message);
  return ok(result.data);
}
