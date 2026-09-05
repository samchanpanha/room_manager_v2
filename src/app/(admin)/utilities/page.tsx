import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";
import { formatMinor } from "@/lib/money";
import { formatMilli } from "@/lib/utilities/machines";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { MeterActions } from "./meter-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function UtilitiesPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M11")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Utilities (M11)." />;
  }
  const scope = await visiblePropertyScope(user, user.permissions, "M11");
  const isGlobal = scope === "ALL";
  const canCreate = can(user, "create", "M11");

  const meters = await prisma.meter.findMany({
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      readings: { orderBy: { readAt: "desc" } },
      charges: { where: { status: "pending" } }
    },
    orderBy: { code: "asc" }
  });
  const visible = meters.filter((m) => propertyInScope(m.room.floor.building.propertyId, scope));

  const pendingMinor = visible.reduce((s, m) => s + m.charges.reduce((x, c) => x + c.amountMinor, 0), 0);
  const anomalies = visible.reduce((s, m) => s + m.charges.filter((c) => c.anomaly).length, 0);
  const activeTariffs = await prisma.tariff.count({ where: { isActive: true } });

  return (
    <div>
      <PageHeader
        title="Utilities"
        description="Meter-based charges (§M11) — consumption × tariff, billed automatically with the next invoice cycle"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending charges" value={formatMinor(pendingMinor)} sub={`${visible.reduce((s, m) => s + m.charges.length, 0)} charge(s) awaiting next invoice`} />
        <StatCard label="Anomalies" value={anomalies} sub="consumption > 2× recent average" />
        <StatCard label="Active tariffs" value={activeTariffs} sub={`${visible.length} meter(s)`} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meter</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Latest reading</TableHead>
                <TableHead>Consumption</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((m) => {
                const latest = m.readings[0] ?? null;
                const prev = m.readings[1] ?? null;
                const consumption = latest && prev ? Math.max(0, latest.valueMilli - prev.valueMilli) : 0;
                const pending = m.charges.reduce((s, c) => s + c.amountMinor, 0);
                const anomaly = m.charges.some((c) => c.anomaly);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <a href={`/utilities/${m.id}`} className="font-mono text-xs underline underline-offset-4">
                        {m.code}
                      </a>
                      <span className="block text-xs uppercase text-muted-foreground">{m.type} · {m.unitLabel}</span>
                    </TableCell>
                    <TableCell>
                      {m.room.number}
                      <span className="block text-xs text-muted-foreground">{m.room.floor.building.property.name}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {latest ? (
                        <>
                          {formatMilli(latest.valueMilli)} {m.unitLabel}
                          {latest.estimated ? <Badge variant="warning" className="ml-1">est</Badge> : null}
                          <span className="block text-xs text-muted-foreground">{latest.readAt.toISOString().slice(0, 10)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground"><Tx>no readings</Tx></span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {latest && prev ? `${formatMilli(consumption)} ${m.unitLabel}` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {pending ? (
                        <>
                          {formatMinor(pending)}
                          {anomaly ? <Badge variant="destructive" className="ml-1">⚠</Badge> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <MeterActions
                        meter={{ id: m.id, code: m.code, unitLabel: m.unitLabel, hasReadings: m.readings.length > 0 }}
                        canRecord={canCreate}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No meters yet — register a meter on a room to start recording readings.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TariffSection isGlobal={isGlobal} />
    </div>
  );
}

async function TariffSection({ isGlobal }: { isGlobal: boolean }) {
  const tariffs = await prisma.tariff.findMany({ orderBy: [{ utilityType: "asc" }, { effectiveFrom: "desc" }] });
  return (
    <Card className="mt-6">
      <CardContent className="p-5">
        <h2 className="mb-3 text-sm font-semibold"><Tx>Tariffs</Tx></h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Tiers</TableHead>
              <TableHead>Effective from</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tariffs.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="uppercase">{t.utilityType}</TableCell>
                <TableCell>{t.propertyId ? "property" : "organisation"}</TableCell>
                <TableCell className="tabular-nums">{formatMinor(t.unitRateMinor)}/unit</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.tiers ? `${(t.tiers as unknown[]).length} tier(s)` : "flat"}</TableCell>
                <TableCell>{t.effectiveFrom.toISOString().slice(0, 10)}</TableCell>
              </TableRow>
            ))}
            {tariffs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  <Tx>No tariffs configured — readings are stored but produce no charges until a tariff exists.</Tx>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        {isGlobal ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Create tariffs via <code className="rounded bg-muted px-1">POST /api/tariffs</code> (UI form arrives with the settings phase).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
