import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { visibleInvoicePropertyIds } from "@/lib/billing/visibility";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M07")) return fail(403, "FORBIDDEN", "Missing permission M07:read");

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const propertyId = url.searchParams.get("propertyId") ?? undefined;

  const scope = await visibleInvoicePropertyIds(user, user.permissions);
  if (scope !== "ALL" && scope.length === 0) return ok({ invoices: [] });

  const memberScoped = scope !== "ALL" ? scope.filter((s) => s.startsWith("member:")).map((s) => s.slice(7)) : [];
  const propertyScoped = scope !== "ALL" ? scope.filter((s) => !s.startsWith("member:")) : undefined;

  // OWN-only callers (e.g. a member) have NO property ids — the scoped where
  // must be a plain OR of the non-empty arms, never `propertyId: { in: [] }`.
  const scopeArms = [
    ...(propertyScoped && propertyScoped.length > 0 ? [{ propertyId: { in: propertyScoped } }] : []),
    ...(memberScoped.length > 0 ? [{ memberProfileId: { in: memberScoped } }] : [])
  ];

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(scope === "ALL" ? {} : scopeArms.length > 0 ? { OR: scopeArms } : { id: { in: [] } })
    },
    include: { member: { include: { party: true } }, property: true, lease: true },
    orderBy: [{ periodStart: "desc" }, { code: "desc" }]
  });

  return ok({
    invoices: invoices.map((i) => ({
      id: i.id,
      code: i.code,
      status: i.status,
      member: i.member.party.name,
      propertyCode: i.property.code,
      leaseCode: i.lease?.code ?? null,
      periodStart: i.periodStart.toISOString(),
      periodEnd: i.periodEnd.toISOString(),
      dueDate: i.dueDate?.toISOString() ?? null,
      totalMinor: i.totalMinor,
      amountDueMinor: i.amountDueMinor,
      dunningStage: i.dunningStage
    }))
  });
}
