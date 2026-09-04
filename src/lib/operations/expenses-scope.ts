/// M20 read-scope resolution (§5: Super/Admin F, Manager R, Accountant M,
/// Staff W, Owner R(own), Member –). Owners see expenses/P&L of the buildings
/// they own (same visibility rule as invoices); members have no access.
import { can } from "@/lib/rbac/can";
import type { AuthUser } from "@/lib/auth/session";
import { getOwnerLinkForUser } from "@/lib/owners";
import { prisma } from "@/lib/db";

export interface ExpensesScope {
  allowed: boolean;
  propertyIds: string[]; // effective read scope ("ALL" flattened at call time)
  global: boolean;
}

export async function expensesScope(user: AuthUser): Promise<ExpensesScope> {
  if (can(user, "read", "M20")) {
    if (user.permissions.some((p) => p.module === "M20" && p.action === "read" && p.scope === "GLOBAL")) {
      const all = await prisma.property.findMany({ where: { status: "active" }, select: { id: true } });
      return { allowed: true, propertyIds: all.map((p) => p.id), global: true };
    }
    if (user.propertyIds.length > 0) return { allowed: true, propertyIds: user.propertyIds, global: false };
  }
  if (can(user, "read", "M20", { ownerUserId: user.id })) {
    const link = await getOwnerLinkForUser(user);
    if (link && link.ownedBuildingIds.length > 0) {
      const buildings = await prisma.building.findMany({
        where: { id: { in: link.ownedBuildingIds } },
        select: { propertyId: true }
      });
      const ids = [...new Set(buildings.map((b) => b.propertyId).filter((x): x is string => Boolean(x)))];
      return { allowed: true, propertyIds: ids, global: false };
    }
  }
  return { allowed: false, propertyIds: [], global: false };
}

/// Accountant+ approval gate (§M20 via §M10 precedent: GLOBAL-scope update).
export function canApproveExpenses(user: AuthUser): boolean {
  return user.permissions.some((p) => p.module === "M20" && p.action === "update" && p.scope === "GLOBAL");
}
