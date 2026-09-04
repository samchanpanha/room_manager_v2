import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { StockActions } from "./stock-actions";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M15")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Stock (M15)." />;
  }
  const scopes = [...new Set(user.propertyIds)];
  const items = await prisma.stockItem.findMany({
    where: scopes.length > 0 ? { propertyId: { in: scopes } } : {},
    include: { supplier: true, property: true },
    orderBy: { name: "asc" }
  });
  const totalValueMinor = items.reduce((s, i) => s + Math.round((i.qtyMilli * i.avgCostMilli) / 1000), 0);
  const lowCount = items.filter((i) => i.qtyMilli <= i.minQtyMilli).length;

  const movements = await prisma.stockMovement.findMany({
    where: scopes.length > 0 ? { stockItem: { propertyId: { in: scopes } } } : {},
    include: { stockItem: true, sale: true },
    orderBy: { createdAt: "desc" },
    take: 25
  });
  const stocktakes = await prisma.stocktake.findMany({
    where: scopes.length > 0 ? { propertyId: { in: scopes } } : {},
    include: { lines: { include: { stockItem: true } } },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  const canWrite = can(user, "create", "M15");
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  const tickets = await prisma.maintenanceTicket.findMany({ where: { status: { in: ["open", "assigned", "in_progress"] } }, orderBy: { code: "asc" }, take: 30 });
  const canWriteTickets = can(user, "update", "M19");

  const props = [...new Set(items.map((i) => i.propertyId))];

  return (
    <div>
      <PageHeader
        title="Stock & Inventory"
        description="M15 — movements only (purchase · sale · consumption · maintenance_use · adjustment · transfer); moving-average cost; low-stock alerts; stocktake variance posts adjustments"
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge variant="outline">items: {items.length}</Badge>
        <Badge variant={lowCount > 0 ? "warning" : "success"}>low stock: {lowCount}</Badge>
        <Badge variant="info">valuation: {formatMinor(totalValueMinor)}</Badge>
      </div>

      {canWrite ? (
        <StockActions
          mode="create"
          items={items.map((i) => ({ id: i.id, label: `${i.name} (${i.qtyMilli / 1000} ${i.unit})`, propertyId: i.propertyId, unit: i.unit }))}
          suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
          properties={props}
          tickets={canWriteTickets ? tickets.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}` })) : []}
          canWriteTickets={canWriteTickets}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const low = i.qtyMilli <= i.minQtyMilli;
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      {i.name}
                      <span className="block text-xs text-muted-foreground">
                        {i.category} · per {i.unit} · {i.property.code}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.supplier?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {i.qtyMilli / 1000}
                      {low ? (
                        <Badge variant="warning" className="ml-2">
                          low
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{i.avgCostMilli > 0 ? formatMinor(Math.round(i.avgCostMilli / 1000)) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(Math.round((i.qtyMilli * i.avgCostMilli) / 1000))}</TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No stock items yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {movements.length > 0 ? (
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="border-b p-3 text-sm font-semibold">Recent movements</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Δ qty</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">{m.createdAt.toISOString().slice(5, 16).replace("T", " ")}</TableCell>
                    <TableCell className="text-xs">{m.stockItem.name}</TableCell>
                    <TableCell>
                      <Badge variant={m.qtyMilli >= 0 ? "success" : "secondary"}>{m.type}</Badge>
                      {m.sale ? <span className="block text-xs text-muted-foreground">{m.sale.code}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {m.qtyMilli > 0 ? "+" : ""}
                      {m.qtyMilli / 1000} {m.stockItem.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{m.qtyAfterMilli / 1000}</TableCell>
                    <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{m.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {stocktakes.length > 0 ? (
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="border-b p-3 text-sm font-semibold">Recent stocktakes</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Take</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Variances</TableHead>
                  <TableHead className="text-right">Valuation Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocktakes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{t.code}</span>
                      <span className="block text-xs text-muted-foreground">{t.createdAt.toISOString().slice(0, 10)}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.lines.map((l) => (
                        <span key={l.id} className="block">
                          {l.stockItem.name}: expected {l.expectedMilli / 1000} → counted {l.countedMilli / 1000}
                          {l.varianceMilli !== 0 ? <Badge variant={l.varianceMilli > 0 ? "success" : "warning"} className="ml-1">{l.varianceMilli > 0 ? "+" : ""}{l.varianceMilli / 1000}</Badge> : null}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs">{t.lines.filter((l) => l.varianceMilli !== 0).length}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(Math.round(t.valueDeltaMilli / 1000))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        On-hand changes only through movements — never direct edits. Maintenance can consume parts straight onto a ticket
        (material cost at moving average). Stocktake variance posts `adjustment` movements and reports the valuation delta.
      </p>
    </div>
  );
}
