import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";
import { formatMinor } from "@/lib/money";
import { formatMilli } from "@/lib/utilities/machines";
import { meterDisplayName } from "@/lib/utilities/machines";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

/// Consumption history bar chart (pure SVG, no external chart lib).
function ConsumptionChart({ points, unitLabel }: { points: { label: string; milli: number; estimated: boolean; anomaly: boolean }[]; unitLabel: string }) {
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Need at least 2 readings for a consumption chart.</p>;
  }
  const W = 720;
  const H = 200;
  const PAD = 30;
  const max = Math.max(...points.map((p) => p.milli), 1);
  const slot = (W - 2 * PAD) / (points.length - 1);
  const bars = points.map((p, i) => {
    const h = Math.max(2, ((H - 2 * PAD) * p.milli) / max);
    return { x: PAD + i * slot, h, p };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Consumption history">
      {bars.map(({ x, h, p }, i) => (
        <g key={i}>
          <rect x={x - 14} y={H - PAD - h} width={28} height={h} rx={3} className={p.anomaly ? "fill-destructive/70" : p.estimated ? "fill-warning/70" : "fill-primary/70"} />
          <text x={x} y={H - PAD - h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
            {formatMilli(p.milli)}
          </text>
          <text x={x} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
            {p.label}
          </text>
        </g>
      ))}
      <line x1={PAD - 10} y1={H - PAD} x2={W - PAD + 10} y2={H - PAD} className="stroke-border" />
      <text x={PAD - 20} y={PAD + 4} className="fill-muted-foreground" fontSize={10}>
        {unitLabel}
      </text>
    </svg>
  );
}

export default async function MeterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M11")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Utilities (M11)." />;
  }
  const meter = await prisma.meter.findUnique({
    where: { id },
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      readings: { orderBy: { readAt: "asc" } },
      charges: { orderBy: { createdAt: "desc" }, include: { lease: true, reading: true } }
    }
  });
  if (!meter) return <EmptyState title="Meter not found" />;
  const scope = await visiblePropertyScope(user, user.permissions, "M11");
  if (!propertyInScope(meter.room.floor.building.propertyId, scope)) {
    return <EmptyState title="No access" hint="This meter is outside your visible properties." />;
  }

  const readings = meter.readings.map((r, i) => ({
    readAt: r.readAt,
    valueMilli: r.valueMilli,
    consumptionMilli: i > 0 ? Math.max(0, r.valueMilli - meter.readings[i - 1].valueMilli) : 0,
    estimated: r.estimated,
    source: r.source
  }));
  const totalBilled = meter.charges.filter((c) => c.status === "billed").reduce((s, c) => s + c.amountMinor, 0);
  const pendingMinor = meter.charges.filter((c) => c.status === "pending").reduce((s, c) => s + c.amountMinor, 0);

  return (
    <div>
      <PageHeader
        title={`${meter.code}`}
        description={`${meterDisplayName(meter.type)} · room ${meter.room.number} · ${meter.room.floor.building.property.name} · ${meter.unitLabel}`}
        actions={<Badge variant={meter.isActive ? "success" : "secondary"}>{meter.isActive ? "active" : "inactive"}</Badge>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Readings" value={readings.length} sub={`latest ${readings.length ? readings[readings.length - 1].readAt.toISOString().slice(0, 10) : "—"}`} />
        <StatCard label="Billed" value={formatMinor(totalBilled)} sub="lifetime charges" />
        <StatCard label="Pending" value={formatMinor(pendingMinor)} sub="rides the next invoice" />
      </div>

      <Card className="mb-6">
        <CardContent className="pt-5">
          <h2 className="mb-2 text-sm font-semibold">Consumption history</h2>
          <ConsumptionChart
            unitLabel={meter.unitLabel}
            points={readings.slice(1).map((r) => ({
              label: r.readAt.toISOString().slice(5, 10),
              milli: r.consumptionMilli,
              estimated: r.estimated,
              anomaly: meter.charges.some((c) => c.reading.readAt.getTime() === r.readAt.getTime() && c.anomaly)
            }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Red = spike anomaly (&gt; 2× recent average) · amber = estimated reading (avg of last 3, §M11).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Consumption</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...readings].reverse().map((r) => (
                <TableRow key={r.readAt.toISOString()}>
                  <TableCell>{r.readAt.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMilli(r.valueMilli)} {meter.unitLabel}
                    {r.estimated ? <Badge variant="warning" className="ml-1">est</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.readAt === meter.readings[0]?.readAt ? "—" : formatMilli(r.consumptionMilli)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="border-b p-4 text-sm font-semibold">Charges from this meter</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Consumption</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Tariff</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meter.charges.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.lease.code}</TableCell>
                  <TableCell className="text-xs">
                    {c.periodStart.toISOString().slice(0, 10)} → {c.periodEnd.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMilli(c.consumptionMilli)} {meter.unitLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(c.amountMinor)}
                    {c.anomaly ? <Badge variant="destructive" className="ml-1">⚠</Badge> : null}
                  </TableCell>
                  <TableCell className="text-xs">{c.tariffName}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "billed" ? "success" : "secondary"}>{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {meter.charges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No charges yet — charges appear from the second reading on (baseline first).
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
