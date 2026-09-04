import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { visiblePaymentScope, paymentInScope } from "@/lib/payments/visibility";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M09")) return fail(403, "FORBIDDEN", "Missing permission M09:read");

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      member: { include: { party: true } },
      allocations: { include: { invoice: true } }
    }
  });
  if (!payment) return fail(404, "NOT_FOUND", "Payment not found");
  const scope = await visiblePaymentScope(user, user.permissions);
  if (!paymentInScope(payment, scope)) return fail(403, "FORBIDDEN", "Payment outside your visible scope");
  return ok({ payment });
}
