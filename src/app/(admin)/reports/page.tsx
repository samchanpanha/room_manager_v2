import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REPORT_BY_KEY } from "@/lib/reports/registry";
import { canSeeReport, reportScope, visibleReportKeys } from "@/lib/reports/scope";
import { runReport } from "@/lib/reports/service";
import { applyReportDesign, designReport, resolveReportKeys, summaryLabel } from "@/lib/reports/config";
import { formatMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/locale-server";
import { ReportPicker } from "./report-picker";

export const dynamic = "force-dynamic";

/// Summary values arrive as `unknown` (the builder types them loosely), so the
/// formatter narrows: numbers on *Minor keys are minor units → currency text.
const money = (v: unknown): string =>
  typeof v === "number" ? formatMinor(Math.round(v * 100)) : v == null ? "—" : String(v);

/// M26 Reports console (§M26): registry-gated by the §5 qualifiers, narrowed by
/// the OPTIONAL org configuration (Settings → Reports: develop/assign), styled
/// by the optional design (title/description/columns), filterable by date +
/// property, CSV/XLSX/PDF export via the API routes. Every label follows the
/// active locale (en / km / zh) through the phrase table.
export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ key?: string; from?: string; to?: string; month?: string; propertyId?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M26")) redirect("/dashboard");
  const sp = await searchParams;
  const { t, tUi } = await getT();

  const scope = await reportScope(user);
  if (!scope.allowed) redirect("/dashboard");
  const settings = await getSettings();

  // §5 role scope first, then the optional develop/assign configuration.
  const allowedKeys = resolveReportKeys(visibleReportKeys(user), settings.reports, user.id);
  const reports = allowedKeys.map((key) => REPORT_BY_KEY.get(key)!).filter(Boolean);
  if (reports.length === 0) {
    return (
      <div>
        <PageHeader title={t("reports.page.title")} description={t("reports.page.description")} />
        <EmptyState title={tUi("No reports available")} hint={t("reports.page.noAccess")} />
      </div>
    );
  }
  const allowed = new Set(reports.map((r) => r.key));
  const currentKey = sp.key && allowed.has(sp.key) ? sp.key : reports[0]!.key;

  const [properties, result] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: scope.propertyIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canSeeReport(user, currentKey) ? runReport(currentKey, sp, scope) : Promise.resolve(null)
  ]);

  const def = REPORT_BY_KEY.get(currentKey)!;
  const design = settings.reports.designs[currentKey];
  const designed = designReport(def, design);
  // Exports must match the screen: project rows/columns through the design.
  const designedResult = result ? applyReportDesign(result, design) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.page.title")} description={t("reports.page.description")} />

      <ReportPicker
        reports={reports.map((r) => {
          const d = designReport(r, settings.reports.designs[r.key]);
          return { key: r.key, title: d.title, category: r.category, source: r.source, dateFiltered: r.dateFiltered, designed: d.designed };
        })}
        properties={properties}
        current={{ key: currentKey, from: sp.from, to: sp.to, month: sp.month, propertyId: sp.propertyId }}
      />

      {designedResult ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(designedResult.summary).map(([k, v]) => (
              <StatCard
                key={k}
                label={tUi(summaryLabel(k))}
                value={k.endsWith("Minor") ? money(v) : typeof v === "string" ? tUi(v) : String(v ?? "—")}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tUi(designed.title)}</CardTitle>
              {designed.description ? <p className="text-sm text-muted-foreground">{tUi(designed.description)}</p> : null}
              <p className="text-[11px] text-muted-foreground">{tUi("Source")}: {tUi(designed.source)}</p>
            </CardHeader>
            <CardContent>
              {designedResult.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("reports.noRows")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {designedResult.columns.map((c) => (
                        <TableHead key={c.key} className={c.numeric ? "text-right" : undefined}>
                          {tUi(c.label)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {designedResult.rows.map((r, i) => (
                      <TableRow key={i}>
                        {designedResult.columns.map((c) => (
                          <TableCell key={c.key} className={c.numeric ? "text-right tabular-nums" : undefined}>
                            {c.key.endsWith("Minor") ? money(r[c.key] as number) : ((r[c.key] as string | number | null) ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{tUi("Pick a report and run it.")}</p>
      )}
    </div>
  );
}
