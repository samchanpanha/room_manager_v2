/// Generic property visibility for property-scoped collections (M11 meters,
/// M12 services, future POS/stock modules):
///  - GLOBAL grant  → "ALL"
///  - PROPERTY grant → the user's assigned properties
///  - OWN grant     → properties of buildings the user owns (owner link:
///    user.partyId → OwnerProfile → Building.ownerId) ∪ assigned properties
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/session";
import type { EffectivePermission } from "@/lib/rbac/can";

export type PropertyScope = "ALL" | { propertyIds: string[] };

/// Resolve the visible property set for read scoping. "ALL" short-circuits;
/// otherwise returns a (possibly empty) property id list.
export async function visiblePropertyScope(user: AuthUser, permissions: EffectivePermission[], module: string): Promise<PropertyScope> {
  const grants = permissions.filter((p) => p.module === module && p.action === "read");
  if (grants.some((g) => g.scope === "GLOBAL")) return "ALL";
  const ids = new Set(user.propertyIds);
  if (grants.some((g) => g.scope === "OWN")) {
    const profile = user.partyId
      ? await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } })
      : null;
    if (profile) {
      const buildings = await prisma.building.findMany({ where: { ownerId: profile.id }, select: { propertyId: true } });
      buildings.forEach((b) => ids.add(b.propertyId));
    }
  }
  return { propertyIds: [...ids] };
}

export function propertyInScope(propertyId: string | null | undefined, scope: PropertyScope): boolean {
  if (scope === "ALL") return true;
  if (!propertyId) return false;
  return scope.propertyIds.includes(propertyId);
}
