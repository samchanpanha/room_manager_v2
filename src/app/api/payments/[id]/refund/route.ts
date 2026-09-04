import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { refundPayment } from "@/lib/payments/service";

const schema = z.object({ reason: z.string().min(3).max(500) });

/// Refund the unallocated member credit — Accountant+ approval required
/// (matrix: only Accountant holds GLOBAL M09:update; Super Admin is F).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const globalUpdate = user.permissions.some((p) => p.module === "M09" && p.action === "update" && p.scope === "GLOBAL");
  if (!globalUpdate) return fail(403, "FORBIDDEN", "Refunds require Accountant approval");

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return fail(404, "NOT_FOUND", "Payment not found");

  const result = await refundPayment(id, parsed.data.reason, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" || result.code === "NOTHING_TO_REFUND" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}
