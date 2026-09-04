import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { consumeForTicket } from "@/lib/operations/stock-service";

const schema = z.object({ stockItemId: z.string().min(1), qty: z.coerce.number().positive().max(10_000), label: z.string().max(120).optional() });

/// M15 × M19: consume a stock part into a maintenance ticket — movement
/// `maintenance_use` + material cost line on the ticket (matrix row 14).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id } });
  if (!ticket) return fail(404, "NOT_FOUND", "Ticket not found");
  if (!can(user, "update", "M19", { propertyId: ticket.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M19:update for this property");
  const result = await consumeForTicket(id, { stockItemId: parsed.data.stockItemId, qtyMilli: Math.round(parsed.data.qty * 1000), label: parsed.data.label }, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
