import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { REPORTS } from "@/lib/reports/registry";
import { reportScope, visibleReportKeys } from "@/lib/reports/scope";

/// M26 registry + what the caller may see (§5 qualifiers: PM ops, Accountant
/// finance, Staff ops-read, Owner own-statement-history).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M26")) return fail(403, "FORBIDDEN", "Missing permission M26:read");
  const scope = await reportScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "No reporting scope");
  const keys = new Set(visibleReportKeys(user));
  return ok({
    scope: { global: scope.global, propertyIds: scope.propertyIds, ownerOnly: Boolean(scope.ownerProfileId) },
    reports: REPORTS.filter((r) => keys.has(r.key)).map((r) => ({
      key: r.key,
      title: r.title,
      category: r.category,
      source: r.source,
      dateFiltered: r.dateFiltered
    }))
  });
}
