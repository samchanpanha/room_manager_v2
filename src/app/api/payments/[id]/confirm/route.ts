import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { confirmPayment } from "@/lib/payments/service";

/// Manual confirmation (cash collected at the desk, cheque cleared, …).
/// PROPERTY-scoped staff may confirm only payments on their properties;
/// refunds remain Accountant+ only. Idempotent — double confirms are no-ops.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M09")) return fail(403, "FORBIDDEN", "Missing permission M09:update");

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return fail(404, "NOT_FOUND", "Payment not found");
  if (!can(user, "update", "M09", { propertyId: payment.propertyId ?? undefined })) {
    return fail(403, "FORBIDDEN", "Payment outside your assigned properties");
  }

  const result = await confirmPayment(id, { id: user.id, name: user.name }, { ip: clientIp(req) });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}
