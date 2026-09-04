import type { Action, Scope } from "./catalog";

/// Effective permissions = union of all role permissions held by the user.
export interface EffectivePermission {
  module: string;
  action: Action;
  scope: Scope;
}

export interface Subject {
  id: string;
  propertyIds: string[];
  permissions: EffectivePermission[];
  /// M27: set on Admin+ users who have not completed mandatory TOTP
  /// enrollment — every module capability except M27 is refused until the
  /// second factor is enrolled (§15 v1.4a).
  totpEnrollmentRequired?: boolean;
}

/// Resource reference used for scope resolution.
///  - propertyId: needed for PROPERTY-scoped checks
///  - ownerUserId: the user who owns the record, for OWN-scoped checks
export interface ResourceRef {
  propertyId?: string | null;
  ownerUserId?: string | null;
}

/// The single enforcement primitive (INTENT.md §5): `can(user, action, module, resource?)`.
/// Pure function — the UI and every server endpoint use the same resolver.
export function can(subject: Subject, action: Action, module: string, resource?: ResourceRef): boolean {
  if (subject.totpEnrollmentRequired && module !== "M27") return false;
  for (const p of subject.permissions) {
    if (p.module !== module || p.action !== action) continue;
    if (p.scope === "GLOBAL") return true;
    if (p.scope === "PROPERTY" && resource?.propertyId && subject.propertyIds.includes(resource.propertyId)) {
      return true;
    }
    if (p.scope === "OWN" && resource?.ownerUserId && resource.ownerUserId === subject.id) {
      return true;
    }
  }
  return false;
}

/// Page-gate helper: does the user hold ANY grant of (module, action) at any
/// scope? Pages use this for access, then scope the data themselves via can().
export function hasModuleAccess(subject: Subject, action: Action, module: string): boolean {
  if (subject.totpEnrollmentRequired && module !== "M27") return false;
  return subject.permissions.some((p) => p.module === module && p.action === action);
}

export function unionPermissions(...lists: EffectivePermission[][]): EffectivePermission[] {
  const seen = new Set<string>();
  const out: EffectivePermission[] = [];
  for (const list of lists) {
    for (const p of list) {
      const k = `${p.module}:${p.action}:${p.scope}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(p);
      }
    }
  }
  return out;
}
