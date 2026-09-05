import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { formatMinor, } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/misc";
import { NAV } from "@/lib/nav";
import { MODULE_BY_KEY } from "@/lib/rbac/catalog";
import { ROOM_STATUSES } from "@/lib/rooms/status";
import { getDashboardKpis } from "@/lib/reports/service";
import { reportScope } from "@/lib/reports/scope";
import { getSettings } from "@/lib/settings";
import { timeAgo, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashUser = await getAuthUser();
  const dashScope = dashUser ? await reportScope(dashUser) : { allowed: false, global: true, propertyIds: [] };
  const kpis = dashUser && dashScope.allowed ? await getDashboardKpis(dashScope) : null;
  const [propertyCount, buildingCount, roomCount, bedCount, userCount, memberCount, rooms, recentAudit, settings] = await Promise.all([
    prisma.property.count(),
    prisma.building.count(),
    prisma.room.count(),
    prisma.bed.count(),
    prisma.user.count(),
    prisma.memberProfile.count(),
    prisma.room.findMany({ select: { status: true, basePriceMinor: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    getSettings()
  ]);

  const byStatus = Object.fromEntries(ROOM_STATUSES.map((s) => [s, rooms.filter((r) => r.status === s).length])) as Record<string, number>;
  const occupied = byStatus.occupied ?? 0;
  const occupancy = roomCount > 0 ? Math.round((occupied / roomCount) * 100) : 0;
  const portfolioValue = rooms.reduce((sum, r) => sum + r.basePriceMinor, 0);

  const stubCount = NAV.flatMap((g) => g.items).filter((i) => i.phase).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${settings.org.name} · ${settings.locale.currency} · ${settings.locale.timezone}`} — phases 0–3 live          (kernel, RBDC, properties, members & documents)
        </p>
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
              View all
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
          <CardTitle className="text-base">Build plan</CardTitle>
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
            Next up: Phase 4 — Owners (owner records + portal login scoping), then leases and the billing engine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
