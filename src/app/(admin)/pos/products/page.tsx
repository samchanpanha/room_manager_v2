import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { flattenCategoryTree } from "@/lib/stock/categories";
import { ProductsClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function PosProductsPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M14")) {
    return <EmptyState title="No access" hint="Your roles do not include read on POS (M14)." />;
  }
  const scopes = [...new Set(user.propertyIds)];
  const posGrants = user.permissions.filter((p) => p.module === "M14" && p.action === "read");
  const global = posGrants.some((g) => g.scope === "GLOBAL");
  const visibleProps = global ? (await prisma.property.findMany({ select: { id: true } })).map((p) => p.id) : scopes;

  const [products, stockItems, categories, legacyCats] = await Promise.all([
    prisma.posProduct.findMany({ include: { stockItem: true }, orderBy: { name: "asc" } }),
    prisma.stockItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.stockCategory.findMany({
      where: visibleProps.length > 0 ? { OR: [{ propertyId: null }, { propertyId: { in: visibleProps } }] } : { propertyId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.posProduct.findMany({ select: { category: true }, where: { category: { not: null } }, distinct: ["category"] })
  ]);

  const canWrite = can(user, "create", "M14") || can(user, "update", "M14");
  const catTree = flattenCategoryTree(
    categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, propertyId: c.propertyId, sortOrder: c.sortOrder, isActive: c.isActive }))
  );
  // Legacy free-form categories (pre-hierarchy) remain selectable for old rows.
  const catList = [...new Set([...legacyCats.map((c) => c.category).filter((c): c is string => Boolean(c)), ...catTree.map((c) => c.path)])].sort();

  return (
    <div>
      <PageHeader
        title="POS product catalog"
        description="M14 — products, categories (hierarchical), units via Settings and EAN-13 barcodes. Sales always decrement linked stock; labels print from the browser (58×40 mm sheet)."
      />

      <ProductsClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          priceMinor: p.priceMinor,
          category: p.category,
          categoryId: p.categoryId,
          barcode: p.barcode,
          sku: p.sku,
          description: p.description,
          isActive: p.isActive,
          stock: p.stockItem ? { id: p.stockItem.id, name: p.stockItem.name, qtyMilli: p.stockItem.qtyMilli, unit: p.stockItem.unit } : null
        }))}
        stockItems={stockItems.map((s) => ({ id: s.id, label: `${s.name} (${(s.qtyMilli / 1000).toFixed(s.unit === "pcs" ? 0 : 2)} ${s.unit})` }))}
        categories={catTree.map((c) => ({ value: c.id, label: `${"　".repeat(c.depth)}${c.path}` }))}
        legacyCategories={catList}
        canWrite={canWrite}
      />
    </div>
  );
}