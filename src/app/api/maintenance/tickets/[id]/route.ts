import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { transitionTicket, addTicketCost } from "@/lib/operations/maintenance-service";

const schema = z.object({
  op: z.enum(["assign", "start", "resolve", "verify", "close", "cancel", "add_cost"]),
  assignedToId: z.string().min(1).optional(),
  vendorName: z.string().min(1).max(120).optional(),
  resolutionNote: z.string().max(1000).optional(),
  reason: z.string().max(300).optional(),
  cost: z.object({
    kind: z.enum(["labor", "material"]),
    label: z.string().min(1).max(120),
    amount: z.coerce.number().min(0.01).max(100_000),
    stockItemId: z.string().min(1).optional(),
    chargeTo: z.enum(["expense", "owner"]).optional()
  }).optional()
});

/// M19 ticket operations (M19:update in scope; Owner W = own buildings).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id }, select: { propertyId: true } });
  if (!ticket) return fail(404, "NOT_FOUND", "Ticket not found");
  if (!can(user, "update", "M19", { propertyId: ticket.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M19:update for this property");
  const actor = { id: user.id, name: user.name };
  const ip = clientIp(req);
  const d = parsed.data;

  if (d.op === "add_cost") {
    if (!d.cost) return fail(422, "COST_REQUIRED", "add_cost requires cost{kind,label,amount}");
    const result = await addTicketCost(id, { ...d.cost, amountMinor: Math.round(d.cost.amount * 100) }, actor, ip);
    if (!result.ok) return fail(422, result.code, result.message);
    return ok(result.data, 201);
  }
  const to = ({ assign: "assigned", start: "in_progress", resolve: "resolved", verify: "verified", close: "closed", cancel: "cancelled" } as const)[d.op];
  const result = await transitionTicket(id, to, { assignedToId: d.assignedToId, vendorName: d.vendorName, resolutionNote: d.resolutionNote, reason: d.reason }, actor, ip);
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data);
}
