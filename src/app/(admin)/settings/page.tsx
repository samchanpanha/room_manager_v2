import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { activeStorageDriver } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForms, SecretForms, OpeningBalanceForm } from "./settings-forms";
import { LanguageCard } from "./language-card";
import { ReportsConfig } from "./reports-config";
import { REPORTS } from "@/lib/reports/registry";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

/// §M28 Settings console. ADMIN M (write) · PM/ACC R (read-only view, §5).
/// Every change is audited; secret fields only ever show masked state.
export default async function SettingsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M28")) redirect("/dashboard");
  const canWrite = hasModuleAccess(user, "update", "M28");

  const [settings, accounts, recentAudit, users] = await Promise.all([
    getSettings(),
    prisma.ledgerAccount.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.auditLog.findMany({ where: { module: "M28" }, orderBy: { createdAt: "desc" }, take: 8, select: { createdAt: true, actorName: true, summary: true } }),
    // Report assignment picker (M26 → assign): active accounts only.
    prisma.user.findMany({ where: { status: "active" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Org profile, billing defaults, providers, feature flags, retention (§M28). All changes audited, forward-only."
      />

      {!canWrite && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground"><Tx>
            Read-only view — your role holds M28:read. Financial and org changes require Admin.
          </Tx></CardContent>
        </Card>
      )}

      <SettingsForms settings={settings} canWrite={canWrite} />

      {/* §M28 Language — org default + per-browser override (en / km / zh). */}
      <LanguageCard orgDefault={settings.locale.locale} canWrite={canWrite} />

      {/* §M28 → M26 optional report configuration: develop · assign · design. */}
      <ReportsConfig
        reports={REPORTS.map((r) => ({ key: r.key, title: r.title, category: r.category, columns: r.columns.map((c) => ({ key: c.key, label: c.label })) }))}
        users={users}
        value={settings.reports}
        canWrite={canWrite}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider secrets (sealed)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              <Tx>Stored AES-256-GCM encrypted; only &quot;configured + last 4&quot; is ever displayed. Env fallback applies until set.</Tx>
            </p>
            <ul className="mb-3 space-y-1 text-sm">
              <li><Tx>Payment webhook secret: </Tx>{settings.providers.paymentCredentials.configured ? `configured (••${settings.providers.paymentCredentials.last4})` : "env default"}</li>
              <li><Tx>Telegram bot token: </Tx>{settings.providers.telegramBotToken.configured ? `configured (••${settings.providers.telegramBotToken.last4})` : "env default"}</li>
              <li><Tx>Object storage driver: </Tx>{activeStorageDriver() === "s3" ? "S3-compatible" : "dev disk"}</li>
            </ul>
            {canWrite && <SecretForms />}
          </CardContent>
        </Card>

        <OpeningBalanceForm accounts={accounts} canWrite={canWrite} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent settings audit</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {recentAudit.length === 0 && <li><Tx>No M28 changes yet.</Tx></li>}
            {recentAudit.map((a) => (
              <li key={a.createdAt.toISOString() + a.summary}>
                {a.createdAt.toISOString().slice(0, 16).replace("T", " ")} — {a.actorName}: {a.summary}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
