import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REPORT_BY_KEY } from "@/lib/reports/registry";
import { canSeeReport, reportScope, visibleReportKeys } from "@/lib/reports/scope";
import { runReport } from "@/lib/reports/service";
import { formatMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { ReportPicker } from "./report-picker";
import { getT } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

const money = (v: string | number | null | undefined) => (typeof v === "number" ? formatMinor(Math.round(v * 100)) : (v ?? "—"));

/// M26 Reports console (§M26): registry-gated by the §5 qualifiers, filterable
/// by date + property, CSV/PDF export via the API routes.
export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ key?: string; from?: string; to?: string; month?: string; propertyId?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M26")) redirect("/dashboard");
  const sp = await searchParams;
  const { t } = await getT();

  const scope = await reportScope(user);
  if (!scope.allowed) redirect("/dashboard");
  const settings = await getSettings();
  const assigned = Object.entries(settings.reports.assignments).filter(([, ids]) => ids.includes(user.id)).map(([key]) => key);
  const enabled = settings.reports.enabledKeys.length === 0 ? null : new Set(settings.reports.enabledKeys);
  const allowed = new Set(visibleReportKeys(user).filter((key) => (!enabled || enabled.has(key)) && (assigned.length === 0 || assigned.includes(key))));
  const reports = [...REPORT_BY_KEY.values()].filter((r) => allowed.has(r.key));
  if (reports.length === 0) return <PageHeader title={t("reports.page.title")} description={t("reports.page.noAccess")} />;
  const currentKey = sp.key && allowed.has(sp.key) ? sp.key : reports[0]!.key;

  const [properties, result] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: scope.propertyIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canSeeReport(user, currentKey) ? runReport(currentKey, sp, scope) : Promise.resolve(null)
  ]);

  const def = REPORT_BY_KEY.get(currentKey)!;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.page.title")} description={t("reports.page.description")} />

      <ReportPicker
        reports={reports.map((r) => ({ key: r.key, title: r.title, category: r.category, source: r.source, dateFiltered: r.dateFiltered }))}
        properties={properties}
        current={{ key: currentKey, from: sp.from, to: sp.to, month: sp.month, propertyId: sp.propertyId }}
      />

      {result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(result.summary).map(([k, v]) => (
              <StatCard key={k} label={k} value={k.endsWith("Minor") ? money(v) : String(v ?? "—")} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{def.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {result.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("reports.noRows")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        {result.columns.map((c) => (
                          <th key={c.key} className={`py-2 pr-3 ${c.numeric ? "text-right" : ""}`}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {result.columns.map((c) => (
                            <td key={c.key} className={`py-2 pr-3 ${c.numeric ? "text-right tabular-nums" : ""}`}>
                              {c.key.endsWith("Minor") ? money(r[c.key] as number) : (r[c.key] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pick a report and run it.</p>
      )}
    </div>
  );
}
