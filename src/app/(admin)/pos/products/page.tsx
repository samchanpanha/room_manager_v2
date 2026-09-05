import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProductsClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function PosProductsPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M14")) {
    return <EmptyState title="No access" hint="Your roles do not include read on POS (M14)." />;
  }

  const [products, stockItems, categories] = await Promise.all([
    prisma.posProduct.findMany({ include: { stockItem: true }, orderBy: { name: "asc" } }),
    prisma.stockItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.posProduct.findMany({ select: { category: true }, where: { category: { not: null } }, distinct: ["category"] })
  ]);

  const canWrite = can(user, "create", "M14") || can(user, "update", "M14");
  const catList = [...new Set(categories.map((c) => c.category).filter((c): c is string => Boolean(c)))].sort();

  return (
    <div>
      <PageHeader
        title="POS product catalog"
        description="M14 — products, categories and EAN-13 barcodes. Sales always decrement linked stock; labels print from the browser (58×40 mm sheet)."
      />

      <ProductsClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          priceMinor: p.priceMinor,
          category: p.category,
          barcode: p.barcode,
          sku: p.sku,
          description: p.description,
          isActive: p.isActive,
          stock: p.stockItem ? { id: p.stockItem.id, name: p.stockItem.name, qtyMilli: p.stockItem.qtyMilli, unit: p.stockItem.unit } : null
        }))}
        stockItems={stockItems.map((s) => ({ id: s.id, label: `${s.name} (${(s.qtyMilli / 1000).toFixed(s.unit === "pcs" ? 0 : 2)} ${s.unit})` }))}
        categories={catList}
        canWrite={canWrite}
      />
    </div>
  );
}