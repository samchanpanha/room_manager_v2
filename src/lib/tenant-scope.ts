/// Multi-tenant data isolation (§M01 workspace scoping).
///
/// The workspace boundary rules are:
///   1. A user may only see/manipulate rows that belong to their own tenant
///      (user.tenantId).
///   2. The ONLY actor allowed cross-tenant visibility is the Platform Root:
///      the SUPER_ADMIN user living in the DEFAULT workspace. After the
///      platform root switches workspace context (organizations/switch) their
///      tenantId becomes the target tenant, so they are scoped like any other
///      user until they switch back.
///
/// Every collection endpoint should funnel its query through these helpers so
/// future tenants cannot read each other's data by accident.
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/session";
import { visiblePropertyScope } from "@/lib/rbac/propscope";

export const PLATFORM_TENANT_ID = "DEFAULT";

/// Platform Root super-admin: DEFAULT workspace + SUPER_ADMIN role. The only
/// actor permitted to see data across all organizations.
export function isPlatformRoot(user: { tenantId: string; roles: string[] }): boolean {
  return user.tenantId === PLATFORM_TENANT_ID && user.roles.includes("SUPER_ADMIN");
}

/// Prisma `where` fragment for a model that carries its own `tenantId` column
/// (Party, Property, AuditLog, Setting, ServiceCatalog, PosProduct, Supplier,
/// StockCategory, Tariff…). `undefined` = no boundary (platform root).
export function tenantWhere(user: { tenantId: string; roles: string[] }): { tenantId: string } | undefined {
  return isPlatformRoot(user) ? undefined : { tenantId: user.tenantId };
}

async function tenantPropertyIds(tenantId: string): Promise<string[]> {
  const props = await prisma.property.findMany({ where: { tenantId }, select: { id: true } });
  return props.map((p) => p.id);
}

/// Property ids this user may read for `module`, intersected with the tenant
/// boundary. "ALL" means every property is visible (platform root only).
export async function visiblePropertyIds(user: AuthUser, module: string): Promise<string[] | "ALL"> {
  const scope = await visiblePropertyScope(user, user.permissions, module);
  if (scope === "ALL") {
    return user.tenantId === PLATFORM_TENANT_ID ? "ALL" : tenantPropertyIds(user.tenantId);
  }
  if (user.tenantId === PLATFORM_TENANT_ID) return scope.propertyIds;
  const own = new Set(await tenantPropertyIds(user.tenantId));
  const ids = scope.propertyIds.filter((id) => own.has(id));
  return ids;
}

/// DB-level `propertyId` filter for property-scoped collections. `undefined`
/// means the user may see every property (platform root with GLOBAL grant);
/// otherwise a concrete (possibly empty) `{ propertyId: { in } }` clause.
export async function propertyIdFilter(user: AuthUser, module: string): Promise<{ propertyId: { in: string[] } } | undefined> {
  const ids = await visiblePropertyIds(user, module);
  if (ids === "ALL") return undefined;
  return { propertyId: { in: ids } };
}

/// True when `propertyId` exists and the user may operate on it: platform root
/// may target any property; everyone else only properties in their own tenant.
export async function propertyAccessible(
  user: { tenantId: string; roles: string[] },
  propertyId: string
): Promise<boolean> {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { tenantId: true } });
  if (!property) return false;
  return isPlatformRoot(user) || property.tenantId === user.tenantId;
}