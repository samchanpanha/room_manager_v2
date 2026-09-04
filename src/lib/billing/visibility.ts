/// Invoice visibility resolution shared by the M07 API routes and pages.
import type { AuthUser } from "@/lib/auth/session";
import type { EffectivePermission } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getOwnerLinkForUser } from "@/lib/owners";

/// Resolve which property ids the caller may see invoices for.
/// GLOBAL → all · PROPERTY → assigned · owner-link → owned buildings' properties
/// plus the caller's own member profile (owners/members can see their own records).
export async function visibleInvoicePropertyIds(
  user: AuthUser,
  permissions: EffectivePermission[]
): Promise<"ALL" | string[]> {
  const grants = permissions.filter((p) => p.module === "M07" && p.action === "read");
  if (grants.some((g) => g.scope === "GLOBAL")) return "ALL";
  const ids = new Set<string>();
  if (grants.some((g) => g.scope === "PROPERTY")) {
    for (const p of user.propertyIds) ids.add(p);
  }
  if (grants.some((g) => g.scope === "OWN")) {
    const ownerLink = await getOwnerLinkForUser(user);
    if (ownerLink && ownerLink.ownedBuildingIds.length > 0) {
      const buildings = await prisma.building.findMany({
        where: { id: { in: ownerLink.ownedBuildingIds } },
        select: { propertyId: true }
      });
      for (const b of buildings) if (b.propertyId) ids.add(b.propertyId);
    }
    if (user.partyId) {
      const member = await prisma.memberProfile.findUnique({ where: { partyId: user.partyId } });
      if (member) ids.add(`member:${member.id}`);
    }
  }
  return [...ids];
}

/// Scope-aware visibility for a single invoice (detail/pdf routes share it):
/// GLOBAL holders see everything; PROPERTY/OWN holders see their properties'
/// invoices plus (for owner/member users) their own member-profile records.
export async function canSeeInvoice(
  user: AuthUser,
  invoice: { propertyId: string; memberProfileId: string }
): Promise<boolean> {
  const scope = await visibleInvoicePropertyIds(user, user.permissions);
  if (scope === "ALL") return true;
  return scope.includes(invoice.propertyId) || scope.includes(`member:${invoice.memberProfileId}`);
}
