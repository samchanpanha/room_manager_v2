import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { REPORTS } from "@/lib/reports/registry";
import { reportScope, visibleReportKeys } from "@/lib/reports/scope";
import { designReport, resolveReportKeys } from "@/lib/reports/config";
import { getSettings } from "@/lib/settings";

/// M26 registry + what the caller may see (§5 qualifiers: PM ops, Accountant
/// finance, Staff ops-read, Owner own-statement-history) narrowed by the
/// optional Settings → Reports configuration (develop/assign) and restyled by
/// the optional design (title/columns).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M26")) return fail(403, "FORBIDDEN", "Missing permission M26:read");
  const scope = await reportScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "No reporting scope");
  const { reports: reportSettings } = await getSettings();
  const allowed = new Set(resolveReportKeys(visibleReportKeys(user), reportSettings, user.id));
  return ok({
    scope: { global: scope.global, propertyIds: scope.propertyIds, ownerOnly: Boolean(scope.ownerProfileId) },
    reports: REPORTS.filter((r) => allowed.has(r.key)).map((r) => {
      const designed = designReport(r, reportSettings.designs[r.key]);
      return {
        key: r.key,
        title: designed.title,
        registryTitle: r.title,
        description: designed.description,
        category: r.category,
        source: r.source,
        dateFiltered: r.dateFiltered,
        designed: designed.designed,
        columns: designed.columns
      };
    })
  });
}
