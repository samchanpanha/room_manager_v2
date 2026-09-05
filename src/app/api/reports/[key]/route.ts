import { z } from "zod";
import { fail, ok, parseQuery } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { runReport } from "@/lib/reports/service";
import { canSeeReport, reportScope } from "@/lib/reports/scope";
import { applyReportDesign, resolveReportKeys } from "@/lib/reports/config";
import { getSettings } from "@/lib/settings";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  propertyId: z.string().min(1).optional()
});

/// Run one report (§M26). Scope: properties limited to the caller's scope,
/// owners locked to own-statement-history.
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const parsed = parseQuery(req, querySchema);
  if (parsed.response || !parsed.data) return parsed.response ?? fail(400, "VALIDATION_ERROR", "Invalid query");

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M26")) return fail(403, "FORBIDDEN", "Missing permission M26:read");
  if (!canSeeReport(user, key)) return fail(403, "FORBIDDEN", "This report is outside your M26 grant");

  const scope = await reportScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "No reporting scope");

  // Optional org configuration: a report that is switched off (develop) or not
  // assigned to this caller (assign) is not reachable through the API either.
  const { reports: reportSettings } = await getSettings();
  if (!resolveReportKeys([key], reportSettings, user.id).includes(key)) {
    return fail(403, "FORBIDDEN", "This report is not enabled or assigned for your account");
  }

  const result = await runReport(key, parsed.data, scope);
  if (!result) return fail(404, "NOT_FOUND", "Unknown report");
  return ok({ report: applyReportDesign(result, reportSettings.designs[key]) });
}
