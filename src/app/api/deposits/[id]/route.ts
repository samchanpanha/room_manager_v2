import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { visibleDepositScope, depositInScope } from "@/lib/deposits/visibility";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M10")) return fail(403, "FORBIDDEN", "Missing permission M10:read");

  const deposit = await prisma.deposit.findUnique({
    where: { id },
    include: {
      lease: true,
      member: { include: { party: true } },
      invoice: { include: { items: true } },
      transactions: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!deposit) return fail(404, "NOT_FOUND", "Deposit not found");
  const scope = await visibleDepositScope(user, user.permissions);
  if (!depositInScope(deposit, scope)) return fail(403, "FORBIDDEN", "Deposit outside your visible scope");
  return ok({ deposit });
}
