import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { getSettings } from "@/lib/settings";
import { StockActions } from "./stock-actions";
import { StockManager } from "./stock-manager";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M15")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Stock (M15)." />;
  }
  const scopes = [...new Set(user.propertyIds)];
  const grants = user.permissions.filter((p) => p.module === "M15" && p.action === "read");
  const global = grants.some((g) => g.scope === "GLOBAL");
  const visibleProps = global ? (await prisma.property.findMany({ select: { id: true } })).map((p) => p.id) : scopes;

  const [items, suppliers, properties, movements, stocktakes, categories, settings] = await Promise.all([
    prisma.stockItem.findMany({
      where: visibleProps.length > 0 ? { propertyId: { in: visibleProps } } : {},
      include: { supplier: true, property: true },
      orderBy: { name: "asc" }
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.property.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
    prisma.stockMovement.findMany({
      where: visibleProps.length > 0 ? { stockItem: { propertyId: { in: visibleProps } } } : {},
      include: { stockItem: true, sale: true },
      orderBy: { createdAt: "desc" },
      take: 25
    }),
    prisma.stocktake.findMany({
      where: visibleProps.length > 0 ? { propertyId: { in: visibleProps } } : {},
      include: { lines: { include: { stockItem: true } } },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.stockCategory.findMany({
      where: visibleProps.length > 0 ? { OR: [{ propertyId: null }, { propertyId: { in: visibleProps } }] } : { propertyId: null },
      select: {
        id: true,
        name: true,
        parentId: true,
        propertyId: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { stockItems: true, products: true, children: true } }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    getSettings()
  ]);

  const canWrite = can(user, "create", "M15") || can(user, "update", "M15");
  const tickets = await prisma.maintenanceTicket.findMany({ where: { status: { in: ["open", "assigned", "in_progress"] } }, orderBy: { code: "asc" }, take: 30 });
  const canWriteTickets = can(user, "update", "M19");

  return (
    <div>
      <PageHeader
        title="Stock & Inventory"
        description="M15 — movements only (purchase · sale · consumption · maintenance_use · adjustment · transfer); moving-average cost; low-stock alerts; stocktake variance posts adjustments"
      />

      {canWrite ? (
        <StockActions
          mode="create"
          items={items.map((i) => ({ id: i.id, label: `${i.name} (${i.qtyMilli / 1000} ${i.unit})`, propertyId: i.propertyId, unit: i.unit, packUnit: i.packUnit, packSize: i.packSize }))}
          suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
          properties={[...new Set(items.map((i) => i.propertyId))]}
          tickets={canWriteTickets ? tickets.map((t) => ({ id: t.id, label: `${t.code} · ${t.title}` })) : []}
          canWriteTickets={canWriteTickets}
          categories={categories.map((c) => ({
            value: c.id,
            label: c.parentId ? categories.find((p) => p.id === c.parentId)?.name + "/" + c.name : c.name
          }))}
          units={settings.units.units}
        />
      ) : null}

      <StockManager
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          unit: i.unit,
          packUnit: i.packUnit,
          packSize: i.packSize,
          qtyMilli: i.qtyMilli,
          avgCostMilli: i.avgCostMilli,
          minQtyMilli: i.minQtyMilli,
          supplierId: i.supplierId,
          supplierName: i.supplier?.name ?? null,
          propertyCode: i.property.code,
          isActive: i.isActive,
          imageDocId: i.imageDocId
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parentId,
          propertyId: c.propertyId,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
          itemCount: c._count.stockItems + c._count.products,
          childCount: c._count.children
        }))}
        suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
        properties={properties}
        units={settings.units.units}
        movements={movements.map((m) => ({
          id: m.id,
          createdAt: m.createdAt.toISOString(),
          itemName: m.stockItem.name,
          qtyMilli: m.qtyMilli,
          qtyAfterMilli: m.qtyAfterMilli,
          unit: m.stockItem.unit,
          type: m.type,
          saleCode: m.sale?.code ?? null,
          note: m.note
        }))}
        stocktakes={stocktakes.map((t) => ({
          id: t.id,
          code: t.code,
          createdAt: t.createdAt.toISOString(),
          valueDeltaMilli: t.valueDeltaMilli,
          lines: t.lines.map((l) => ({ itemName: l.stockItem.name, expectedMilli: l.expectedMilli, countedMilli: l.countedMilli }))
        }))}
        canWrite={canWrite}
      />

      <p className="mt-3 text-xs text-muted-foreground">
        On-hand changes only through movements — never direct edits. Maintenance can consume parts straight onto a ticket
        (material cost at moving average). Stocktake variance posts `adjustment` movements and reports the valuation delta.
      </p>
    </div>
  );
}