import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { formatMinor } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/misc";
import { NAV } from "@/lib/nav";
import { MODULE_BY_KEY } from "@/lib/rbac/catalog";
import { can } from "@/lib/rbac/can";
import { ROOM_STATUSES } from "@/lib/rooms/status";
import { getDashboardKpis } from "@/lib/reports/service";
import { reportScope } from "@/lib/reports/scope";
import { rentDuesForScopes } from "@/lib/alerts/service";
import { getFeatureFlags, getSettings } from "@/lib/settings";
import { moduleAccent } from "@/lib/tabs";
import { navIcon } from "@/lib/icons";
import { Icon } from "@/components/icon";
import { timeAgo, titleCase } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const dashUser = await getAuthUser();
  const dashScope = dashUser ? await reportScope(dashUser) : { allowed: false, global: true, propertyIds: [] };
  const kpis = dashUser && dashScope.allowed ? await getDashboardKpis(dashScope) : null;
  const [propertyCount, buildingCount, roomCount, bedCount, userCount, memberCount, rooms, recentAudit, settings, flags] = await Promise.all([
    prisma.property.count(),
    prisma.building.count(),
    prisma.room.count(),
    prisma.bed.count(),
    prisma.user.count(),
    prisma.memberProfile.count(),
    prisma.room.findMany({ select: { status: true, basePriceMinor: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    getSettings(),
    getFeatureFlags()
  ]);

  const byStatus = Object.fromEntries(ROOM_STATUSES.map((s) => [s, rooms.filter((r) => r.status === s).length])) as Record<string, number>;
  const occupied = byStatus.occupied ?? 0;
  const occupancy = roomCount > 0 ? Math.round((occupied / roomCount) * 100) : 0;
  const portfolioValue = rooms.reduce((sum, r) => sum + r.basePriceMinor, 0);

  const stubCount = NAV.flatMap((g) => g.items).filter((i) => i.phase).length;

  const canReadAlerts = dashUser ? can(dashUser, "read", "M33") : false;
  const rentDues = dashUser && dashScope.allowed && canReadAlerts ? await rentDuesForScopes(dashScope.propertyIds, settings.rentAlerts.aheadDays) : null;

  const quickLaunch = NAV.flatMap((g) => g.items).filter(
    (i) => i.href && (!i.module || (dashUser && can(dashUser, "read", i.module) && flags[i.module] !== false))
  );

  return (
    <div data-tour="dashboard">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {dashUser?.name.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {`${settings.org.name} · ${settings.locale.currency} · ${settings.locale.timezone}`} — open a module below or from the menu; each page opens in its own tab.
          </p>
        </div>
        <Link href="/reports" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          <Tx>Open Reports →</Tx>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Occupancy" value={`${occupancy}%`} sub={`${occupied} of ${roomCount} rooms occupied`} />
        <StatCard label="Properties" value={propertyCount} sub={`${buildingCount} buildings`} />
        <StatCard label="Rooms / Beds" value={`${roomCount} / ${bedCount}`} />
        <StatCard label="Monthly book value" value={formatMinor(portfolioValue, settings.locale.currency)} sub="Σ room base prices" />
        <StatCard label="Users" value={userCount} />
        <StatCard label="Members" value={memberCount} sub="prospects + residents" />
      </div>

      {kpis ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Collected vs billed (month)" value={`${formatMinor(Math.round(kpis.collectedMinor * 100))} / ${formatMinor(Math.round(kpis.billedMinor * 100))}`} sub={`confirmed payments vs invoices issued ${kpis.month}`} />
          <StatCard label="Arrears" value={formatMinor(Math.round(kpis.arrearsMinor * 100))} sub="Σ open invoice dues" />
          <StatCard label="Cash position" value={formatMinor(Math.round(kpis.cashPositionMinor * 100))} sub="ledger 1100 + 1200 balance" />
          <StatCard label="Open tickets" value={kpis.openTickets} sub="maintenance (M19)" />
          <StatCard label="Occupancy (M26)" value={`${kpis.occupancyPct}%`} sub="same room-status source" />
        </div>
      ) : null}

      {rentDues ? (
        <Card className="mt-4" data-tour="rent-dues">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Rent dues (M33)</CardTitle>
            <span className="text-xs text-muted-foreground">
              within next {settings.rentAlerts.aheadDays} days · upcoming {formatMinor(rentDues.upcomingTotalMinor, settings.locale.currency)} · overdue {formatMinor(rentDues.overdueTotalMinor, settings.locale.currency)}
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground"><Tx>Due soon</Tx></p>
                {rentDues.upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing due in the next {settings.rentAlerts.aheadDays} days.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {rentDues.upcoming.slice(0, 5).map((d) => (
                      <li key={d.invoiceId} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {d.memberName} · {d.invoiceCode}
                          {d.leaseCode ? ` · ${d.leaseCode}` : ""}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatMinor(d.amountDueMinor, settings.locale.currency)} <Badge variant={d.daysUntil <= 1 ? "warning" : "outline"}>{d.daysUntil === 0 ? "due today" : `in ${d.daysUntil}d`}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground"><Tx>Overdue</Tx></p>
                {rentDues.overdue.length === 0 ? (
                  <p className="text-sm text-muted-foreground"><Tx>No overdue rent invoices.</Tx></p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {rentDues.overdue.slice(0, 5).map((d) => (
                      <li key={d.invoiceId} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {d.memberName} · {d.invoiceCode} · {d.propertyName}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatMinor(d.amountDueMinor, settings.locale.currency)} <Badge variant="destructive">{Math.abs(d.daysUntil)}d late</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Link href="/reports?key=overdue-not-paid" className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"><Tx>
              Open the overdue-not-paid report →
            </Tx></Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6" data-tour="launch">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Quick launch</CardTitle>
          <span className="text-xs text-muted-foreground"><Tx>one click opens a new tab</Tx></span>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quickLaunch.map((item) => (
              <Link
                key={item.href}
                href={item.href!}
                className="flex items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${moduleAccent(item.module)}/20`}>
                  <Icon name={navIcon(item.label)} className={`h-4 w-4 ${moduleAccent(item.module)}`} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.module ? <span className="font-mono text-[10px] text-muted-foreground">{item.module}</span> : null}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Room status distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROOM_STATUSES.map((s) => {
              const n = byStatus[s] ?? 0;
              const pct = roomCount > 0 ? Math.round((n / roomCount) * 100) : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-24 text-sm capitalize text-muted-foreground">{s}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        s === "occupied" ? "bg-success" : s === "reserved" ? "bg-blue-500" : s === "cleaning" ? "bg-warning" : s === "maintenance" ? "bg-destructive" : "bg-muted-foreground/40"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm tabular-nums">{n}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent activity (audit trail)</CardTitle>
            <Link href="/audit" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              <Tx>View all</Tx>
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{a.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actorName} · {MODULE_BY_KEY.get(a.module)?.name ?? a.module} · {titleCase(a.action)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Phase 0 · Scaffold — done</Badge>
            <Badge variant="success">Phase 1 · Kernel &amp; RBDC — done</Badge>
            <Badge variant="success">Phase 2 · Properties &amp; rooms — done</Badge>
            <Badge variant="success">Phase 3 · Members &amp; documents — done</Badge>
            <Badge variant="outline">{stubCount} modules queued · phases 3–22</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            <Tx>Live modules: billing (M06–M13), operations (M14–M23), finance (M24, M26), comms (M21, M25) and admin (M01, M27–M29).</Tx>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}