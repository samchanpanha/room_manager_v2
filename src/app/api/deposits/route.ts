import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { visibleDepositScope, depositInScope } from "@/lib/deposits/visibility";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M10")) return fail(403, "FORBIDDEN", "Missing permission M10:read");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;

  const scope = await visibleDepositScope(user, user.permissions);
  if (scope !== "ALL" && scope.propertyIds.length === 0 && scope.memberIds.length === 0) {
    return ok({ deposits: [] });
  }
  const deposits = await prisma.deposit.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(scope === "ALL" ? {} : { OR: [{ propertyId: { in: scope.propertyIds } }, { memberProfileId: { in: scope.memberIds } }] })
    },
    include: {
      lease: true,
      member: { include: { party: true } },
      invoice: true,
      transactions: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const rows = deposits
    .filter((d) => depositInScope(d, scope))
    .map((d) => {
      const collected = d.invoice?.amountPaidMinor ?? 0;
      const deducted = d.transactions.filter((t) => t.type === "deduction").reduce((s, t) => s + t.amountMinor, 0);
      const refunded = d.transactions.filter((t) => t.type === "refund").reduce((s, t) => s + t.amountMinor, 0);
      return {
        id: d.id,
        leaseCode: d.lease.code,
        leaseStatus: d.lease.status,
        member: { id: d.memberProfileId, name: d.member.party.name },
        status: d.status,
        requiredMinor: d.requiredMinor,
        collectedMinor: collected,
        deductedMinor: deducted,
        refundedMinor: refunded,
        remainingMinor: Math.max(0, collected - deducted - refunded),
        invoiceId: d.invoiceId,
        invoiceCode: d.invoice?.code ?? null
      };
    });
  return ok({ deposits: rows });
}
