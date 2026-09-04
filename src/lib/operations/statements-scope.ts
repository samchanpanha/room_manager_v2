/// M24 read scope (§5: Admin F-ish M, Manager R, Accountant M, Owner O(own)).
/// GLOBAL/PROPERTY readers resolve to property lists; owners resolve to their
/// own ownerProfileId.
import { can } from "@/lib/rbac/can";
import type { AuthUser } from "@/lib/auth/session";
import { getOwnerLinkForUser } from "@/lib/owners";
import { prisma } from "@/lib/db";

export interface StatementsScope {
  allowed: boolean;
  ownerProfileId?: string; // set ⇒ owner (own statements only)
  propertyIds?: string[]; // set ⇒ property-scoped read
  global: boolean;
}

export async function statementsScope(user: AuthUser): Promise<StatementsScope> {
  if (user.permissions.some((p) => p.module === "M24" && p.action === "read" && p.scope === "GLOBAL")) {
    const all = await prisma.property.findMany({ where: { status: "active" }, select: { id: true } });
    return { allowed: true, propertyIds: all.map((p) => p.id), global: true };
  }
  if (can(user, "read", "M24", { ownerUserId: user.id })) {
    const link = await getOwnerLinkForUser(user);
    if (link) return { allowed: true, ownerProfileId: link.ownerProfileId, global: false };
  }
  if (can(user, "read", "M24") && user.propertyIds.length > 0) {
    return { allowed: true, propertyIds: user.propertyIds, global: false };
  }
  return { allowed: false, global: false };
}

/// Accountant+/Admin mutation gate — GLOBAL M24:update (mirrors M20 approval).
export function canManageStatements(user: { permissions: Array<{ module: string; action: string; scope: string }> }): boolean {
  return user.permissions.some((p) => p.module === "M24" && p.action === "update" && p.scope === "GLOBAL");
}
