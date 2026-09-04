/// M26 scope (§5 row: F · M · M(ops) · M(fin) · R · R(own) · –).
/// The matrix qualifiers gate REPORT CATEGORIES: PM manages ops reports,
/// the Accountant manages finance reports, Staff reads ops, owners read their
/// own statement history. Data is further limited to the caller's property
/// scope (owners → their own buildings' properties).
import type { AuthUser } from "@/lib/auth/session";
import { getOwnerLinkForUser } from "@/lib/owners";
import { prisma } from "@/lib/db";
import { REPORT_BY_KEY, type ReportCategory } from "./registry";

export interface ReportScope {
  allowed: boolean;
  global: boolean;
  propertyIds: string[];
  /// set ⇒ owner (owner-statement-history only, own rows)
  ownerProfileId?: string;
}

export async function reportScope(user: AuthUser): Promise<ReportScope> {
  const globalRead = user.permissions.some((p) => p.module === "M26" && p.action === "read" && p.scope === "GLOBAL");
  if (globalRead) {
    const all = await prisma.property.findMany({ where: { status: "active" }, select: { id: true } });
    return { allowed: true, global: true, propertyIds: all.map((p) => p.id) };
  }
  if (user.roles.includes("OWNER")) {
    const link = await getOwnerLinkForUser(user);
    if (link) {
      const buildings = await prisma.building.findMany({ where: { id: { in: link.ownedBuildingIds } }, select: { propertyId: true } });
      return { allowed: true, global: false, propertyIds: [...new Set(buildings.map((b) => b.propertyId))], ownerProfileId: link.ownerProfileId };
    }
  }
  if (user.propertyIds.length > 0) {
    return { allowed: true, global: false, propertyIds: user.propertyIds };
  }
  return { allowed: false, global: false, propertyIds: [] };
}

function isSuper(user: AuthUser): boolean {
  return user.isSuperAdmin || user.roles.includes("ADMIN");
}

/// §5 qualifier split: which reports may this role see?
export function canSeeReport(user: AuthUser, key: string): boolean {
  const def = REPORT_BY_KEY.get(key);
  if (!def) return false;
  if (isSuper(user)) return true;
  if (user.roles.includes("PROPERTY_MANAGER")) return def.category === "ops";
  if (user.roles.includes("ACCOUNTANT")) return def.category === "finance";
  if (user.roles.includes("STAFF")) return def.category === "ops";
  if (user.roles.includes("OWNER")) return key === "owner-statement-history";
  return false;
}

export function visibleReportKeys(user: AuthUser): string[] {
  return [...REPORT_BY_KEY.keys()].filter((k) => canSeeReport(user, k));
}

export function visibleCategories(user: AuthUser): ReportCategory[] {
  const keys = visibleReportKeys(user);
  const cats = new Set<ReportCategory>();
  for (const k of keys) cats.add(REPORT_BY_KEY.get(k)!.category);
  return [...cats];
}
