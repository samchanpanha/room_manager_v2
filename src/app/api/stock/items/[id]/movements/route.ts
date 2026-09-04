import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

/// M15 movement history for one item (the ONLY way qty ever changed).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");
  const item = await prisma.stockItem.findUnique({ where: { id }, include: { property: true } });
  if (!item) return fail(404, "NOT_FOUND", "Stock item not found");
  if (!canRead(user, item.propertyId)) return fail(403, "FORBIDDEN", "No access to this property's stock");
  const movements = await prisma.stockMovement.findMany({
    where: { OR: [{ stockItemId: id }, { targetItemId: id }] },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return ok({
    item: { id: item.id, name: item.name, unit: item.unit, qtyMilli: item.qtyMilli, avgCostMilli: item.avgCostMilli },
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      qtyMilli: m.qtyMilli,
      qtyAfterMilli: m.qtyAfterMilli,
      avgCostAfterMilli: m.avgCostAfterMilli,
      valueMilli: m.valueMilli,
      saleId: m.saleId,
      ticketId: m.ticketId,
      stocktakeId: m.stocktakeId,
      targetItemId: m.targetItemId,
      note: m.note,
      createdAt: m.createdAt
    }))
  });
}

function canRead(user: { propertyIds: string[]; permissions: Array<{ module: string; action: string; scope: string }> }, propertyId: string): boolean {
  return user.permissions.some((p) => p.module === "M15" && p.action === "read" && (p.scope === "GLOBAL" || p.scope === "OWN")) || user.propertyIds.includes(propertyId);
}
