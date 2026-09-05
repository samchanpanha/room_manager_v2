import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PosTerminal } from "./pos-terminal";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M14")) {
    return <EmptyState title="No access" hint="Your roles do not include read on POS (M14)." />;
  }
  const scopes = [...new Set(user.propertyIds)];
  const property = scopes.length > 0 ? await prisma.property.findUnique({ where: { id: scopes[0] } }) : null;

  const posGrants = user.permissions.filter((p) => p.module === "M14" && p.action === "read");
  const global = posGrants.some((g) => g.scope === "GLOBAL");
  const visibleProps = global ? (await prisma.property.findMany({ select: { id: true } })).map((p) => p.id) : scopes;

  const sessions = await prisma.posSession.findMany({
    where: visibleProps.length > 0 ? { propertyId: { in: visibleProps } } : {},
    include: { sales: true },
    orderBy: { openedAt: "desc" },
    take: 10
  });
  const openSession = sessions.find((s) => s.status === "open") ?? null;

  const sales = await prisma.posSale.findMany({
    where: visibleProps.length > 0 ? { propertyId: { in: visibleProps } } : {},
    include: { items: true, member: { include: { party: true } } },
    orderBy: { createdAt: "desc" },
    take: 25
  });
  const products = await prisma.posProduct.findMany({ where: { isActive: true }, include: { stockItem: true, categoryRef: true }, orderBy: { name: "asc" } });

  // Till category chips: root segments (grouping) plus full paths.
  const categoryLabels = [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const categories = [
    ...new Set(categoryLabels.flatMap((c) => c.split("/").map((s) => s.trim()).filter(Boolean).reverse().slice(1)))
  ]
    .map((root) => categoryLabels.filter((c) => c === root || c.startsWith(`${root}/`)).sort((a, b) => a.length - b.length)[0])
    .concat(categoryLabels)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a.localeCompare(b));
  const members = await prisma.memberProfile.findMany({ where: { status: { in: ["active", "verified", "notice"] } }, include: { party: true }, orderBy: { id: "asc" }, take: 100 });
  const visibleMembers = members.filter((m) => !m.homePropertyId || scopes.length === 0 || scopes.includes(m.homePropertyId));

  const canWrite = can(user, "create", "M14");

  return (
    <div>
      <PageHeader
        title="POS — Canteen & Store"
        description="M14 — ring up cash / QR / card sales at the till; room charges post a one-time invoice line on the member's account; every sale decrements stock, files a receipt PDF, and honours the M28 printer settings"
      />

      <PosTerminal
        property={property ? { id: property.id } : null}
        openSession={
          openSession
            ? {
                id: openSession.id,
                openingFloatMinor: openSession.openingFloatMinor,
                sales: openSession.sales.length,
                cashSalesMinor: openSession.sales.filter((s) => s.method === "cash").reduce((sum, s) => sum + s.totalMinor - s.discountMinor, 0)
              }
            : null
        }
        sales={sales.map((s) => ({
          id: s.id,
          code: s.code,
          method: s.method,
          totalMinor: s.totalMinor,
          discountMinor: s.discountMinor,
          createdAt: s.createdAt.toISOString(),
          memberName: s.member?.party.name,
          invoiceId: s.invoiceId,
          items: s.items.map((i) => ({ id: i.id, name: i.name, qtyMilli: i.qtyMilli, lineMinor: i.lineMinor }))
        }))}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          priceMinor: p.priceMinor,
          category: p.category,
          categoryId: p.categoryId,
          barcode: p.barcode,
          stock: p.stockItem
            ? { id: p.stockItem.id, name: p.stockItem.name, qtyMilli: p.stockItem.qtyMilli, unit: p.stockItem.unit }
            : null
        }))}
        members={visibleMembers.map((m) => ({ id: m.id, label: m.party.name }))}
        categories={categories}
        canWrite={canWrite}
      />
    </div>
  );
}