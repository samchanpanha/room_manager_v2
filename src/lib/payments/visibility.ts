/// Payment visibility (M09): GLOBAL reads everything; PROPERTY scope sees
/// payments on assigned properties; OWN (owners/members) sees payments tied to
/// their buildings' properties or to their own member profile.
import type { AuthUser } from "@/lib/auth/session";
import type { EffectivePermission } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getOwnerLinkForUser } from "@/lib/owners";

export interface PaymentScope {
  propertyIds: string[];
  memberIds: string[]; // MemberProfile ids ("member:{id}" pattern without prefix)
}

export async function visiblePaymentScope(
  user: AuthUser,
  permissions: EffectivePermission[]
): Promise<"ALL" | PaymentScope> {
  const grants = permissions.filter((p) => p.module === "M09" && p.action === "read");
  if (grants.some((g) => g.scope === "GLOBAL")) return "ALL";
  const scope: PaymentScope = { propertyIds: [], memberIds: [] };
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

export function paymentInScope(payment: { propertyId: string | null; memberProfileId: string }, scope: "ALL" | PaymentScope): boolean {
  if (scope === "ALL") return true;
  return (payment.propertyId ? scope.propertyIds.includes(payment.propertyId) : false) || scope.memberIds.includes(payment.memberProfileId);
}

/// Can this user record a payment FOR this member? (create-side scoping)
export async function canCreateForMember(user: AuthUser, memberProfileId: string): Promise<boolean> {
  if (user.permissions.some((p) => p.module === "M09" && p.action === "create" && p.scope === "GLOBAL")) return true;
  const member = await prisma.memberProfile.findUnique({ where: { id: memberProfileId } });
  if (!member) return false;
  if (user.permissions.some((p) => p.module === "M09" && p.action === "create" && p.scope === "OWN")) {
    return Boolean(user.partyId && member.partyId === user.partyId);
  }
  if (user.permissions.some((p) => p.module === "M09" && p.action === "create" && p.scope === "PROPERTY")) {
    if (member.homePropertyId && user.propertyIds.includes(member.homePropertyId)) return true;
    // members of an assigned property via their lease
    const lease = await prisma.lease.findFirst({
      where: { memberProfileId: member.id, status: "active", propertyId: { in: user.propertyIds } },
      select: { id: true }
    });
    return Boolean(lease);
  }
  return false;
}
