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
import { InspectionTemplatesCard } from "./inspection-templates-card";
import { REPORTS } from "@/lib/reports/registry";
import { Tx } from "@/components/i18n-text";

import Link from "next/link";
import { Button } from "@/components/ui/button";

import { WorkspaceSelector } from "./workspace-selector";

export const dynamic = "force-dynamic";

/// §M28 Settings console. ADMIN M (write) · PM/ACC R (read-only view, §5).
/// Every change is audited; secret fields only ever show masked state.
export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ tenantId?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "read", "M28")) redirect("/dashboard");
  const canWrite = hasModuleAccess(user, "update", "M28");

  const sp = searchParams ? await searchParams : undefined;
  const isPlatformRoot = user.tenantId === "DEFAULT" && user.roles.includes("SUPER_ADMIN");
  const targetTenantId = isPlatformRoot && sp?.tenantId ? sp.tenantId : user.tenantId;

  const [settings, accounts, recentAudit, users, tenant, allTenants] = await Promise.all([
    getSettings(targetTenantId),
    prisma.ledgerAccount.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.auditLog.findMany({
      where: { module: "M28", tenantId: targetTenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { createdAt: true, actorName: true, summary: true }
    }),
    // Report assignment picker (M26 → assign): active accounts only.
    prisma.user.findMany({ where: { status: "active", tenantId: targetTenantId }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.tenant.findUnique({ where: { id: targetTenantId }, include: { _count: { select: { properties: true, users: true } } } }),
    isPlatformRoot ? prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }) : Promise.resolve([])
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Settings"
          description="Org profile, billing defaults, providers, feature flags, retention (§M28). All changes audited, forward-only."
        />
        {isPlatformRoot && allTenants.length > 1 && (
          <WorkspaceSelector tenants={allTenants} activeTenantId={targetTenantId} />
        )}
      </div>

      {/* Multi-Tenant Organization Workspace Info Card */}
      <Card className="border-primary/20 bg-muted/20">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                <Tx>Organization Workspace</Tx>
              </span>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {tenant?.slug ?? (targetTenantId === user.tenantId ? user.tenantSlug : targetTenantId) ?? "default"}
              </span>
            </div>
            <h3 className="text-lg font-bold">{tenant?.name ?? (targetTenantId === user.tenantId ? user.tenantName : null) ?? settings.org.name}</h3>
            <p className="text-xs text-muted-foreground">
              <Tx>Properties:</Tx> {tenant?._count.properties ?? 0} &bull; <Tx>Users:</Tx> {tenant?._count.users ?? 1} &bull; <Tx>Contact:</Tx> {tenant?.contactEmail || settings.org.email || "—"}
            </p>
          </div>
          <Link href="/organizations">
            <Button variant="outline" size="sm">
              <Tx>Manage Organizations &rarr;</Tx>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {!canWrite && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground"><Tx>
            Read-only view — your role holds M28:read. Financial and org changes require Admin.
          </Tx></CardContent>
        </Card>
      )}

      <SettingsForms settings={settings} canWrite={canWrite} tenantId={targetTenantId} />

      {/* §M28 Language — org default + per-browser override (en / km / zh). */}
      <LanguageCard orgDefault={settings.locale.locale} canWrite={canWrite} tenantId={targetTenantId} />

      {/* §M28 → M26 optional report configuration: develop · assign · design. */}
      <ReportsConfig
        reports={REPORTS.map((r) => ({ key: r.key, title: r.title, category: r.category, columns: r.columns.map((c) => ({ key: c.key, label: c.label })) }))}
        users={users}
        value={settings.reports}
        canWrite={canWrite}
        tenantId={targetTenantId}
      />

      {/* §M18 Inspection checklist templates configuration */}
      <InspectionTemplatesCard canWrite={canWrite} />

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
            {canWrite && <SecretForms tenantId={targetTenantId} />}
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
            {recentAudit.length === 0 && <li><Tx>No M28 changes yet for this workspace.</Tx></li>}
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
