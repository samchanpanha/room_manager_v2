/// Owner (M03) helpers: portal-link resolution, guard resources, scoping.
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/session";
import type { EffectivePermission } from "@/lib/rbac/can";

export interface OwnerLink {
  ownerProfileId: string;
  partyId: string;
  ownedBuildingIds: string[];
}

/// Resolve the OwnerProfile bound to the current user via the party model.
export async function getOwnerLinkForUser(user: AuthUser): Promise<OwnerLink | null> {
  if (!user.partyId) return null;
  const owner = await prisma.ownerProfile.findUnique({
    where: { partyId: user.partyId },
    include: { buildings: { select: { id: true } } }
  });
  if (!owner) return null;
  return {
    ownerProfileId: owner.id,
    partyId: owner.partyId,
    ownedBuildingIds: owner.buildings.map((b) => b.id)
  };
}

export interface OwnerGuardTarget {
  owner: { id: string; partyId: string };
  ownerUserId: string | null; // the portal user bound to this owner (OWN-scope resource)
  propertyIds: string[]; // properties of owned buildings (PROPERTY-scope resource)
}

/// Load an owner with the ids needed for RBDC resource resolution.
export async function loadOwnerGuardTarget(ownerId: string): Promise<OwnerGuardTarget | null> {
  const owner = await prisma.ownerProfile.findUnique({
    where: { id: ownerId },
    include: {
      buildings: { select: { propertyId: true } },
      party: { include: { users: { select: { id: true }, take: 1 } } }
    }
  });
  if (!owner) return null;
  return {
    owner: { id: owner.id, partyId: owner.partyId },
    ownerUserId: owner.party.users[0]?.id ?? null,
    propertyIds: [...new Set(owner.buildings.map((b) => b.propertyId))]
  };
}

/// OWNER role can act only on its own owner record (OWN scope):
/// pass the linked portal user id as the resource owner.
export function ownResource(target: OwnerGuardTarget): { ownerUserId: string | null } {
  return { ownerUserId: target.ownerUserId };
}

/// Which owner ids may this user see in lists? (union across grant scopes)
export async function visibleOwnerIdsFilter(
  user: AuthUser,
  permissions: EffectivePermission[]
): Promise<"ALL" | { ownerProfileIds: string[] }> {
  const grants = permissions.filter((p) => p.module === "M03" && p.action === "read");
  if (grants.some((g) => g.scope === "GLOBAL")) return "ALL";
  const ids = new Set<string>();
  if (grants.some((g) => g.scope === "PROPERTY") && user.propertyIds.length > 0) {
    const owners = await prisma.ownerProfile.findMany({
      where: { buildings: { some: { propertyId: { in: user.propertyIds } } } },
      select: { id: true }
    });
    for (const o of owners) ids.add(o.id);
  }
  if (grants.some((g) => g.scope === "OWN") && user.partyId) {
    const own = await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
    if (own) ids.add(own.id);
  }
  return { ownerProfileIds: [...ids] };
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return `••${accountNumber}`;
  return `••••${accountNumber.slice(-4)}`;
}
