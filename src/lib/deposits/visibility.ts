/// Deposit visibility (M10): GLOBAL reads everything; PROPERTY sees deposits
/// on assigned properties; OWN (owners see their buildings', members their own).
import type { AuthUser } from "@/lib/auth/session";
import type { EffectivePermission } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getOwnerLinkForUser } from "@/lib/owners";

export interface DepositScope {
  propertyIds: string[];
  memberIds: string[];
}

export async function visibleDepositScope(user: AuthUser, permissions: EffectivePermission[]): Promise<"ALL" | DepositScope> {
  const grants = permissions.filter((p) => p.module === "M10" && p.action === "read");
  if (grants.some((g) => g.scope === "GLOBAL")) return "ALL";
  const scope: DepositScope = { propertyIds: [], memberIds: [] };
  if (grants.some((g) => g.scope === "PROPERTY")) {
    scope.propertyIds = [...user.propertyIds];
  }
  if (grants.some((g) => g.scope === "OWN")) {
    const ownerLink = await getOwnerLinkForUser(user);
    if (ownerLink && ownerLink.ownedBuildingIds.length > 0) {
      const buildings = await prisma.building.findMany({
        where: { id: { in: ownerLink.ownedBuildingIds } },
        select: { propertyId: true }
      });
      for (const b of buildings) if (b.propertyId) scope.propertyIds.push(b.propertyId);
    }
    if (user.partyId) {
      const member = await prisma.memberProfile.findUnique({ where: { partyId: user.partyId } });
      if (member) scope.memberIds.push(member.id);
    }
  }
  return scope;
}

export function depositInScope(
  deposit: { propertyId: string | null; memberProfileId: string },
  scope: "ALL" | DepositScope
): boolean {
  if (scope === "ALL") return true;
  return (deposit.propertyId ? scope.propertyIds.includes(deposit.propertyId) : false) || scope.memberIds.includes(deposit.memberProfileId);
}
