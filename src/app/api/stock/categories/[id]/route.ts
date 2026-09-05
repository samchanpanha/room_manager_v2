import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can, hasModuleAccess } from "@/lib/rbac/can";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional()
});

type Scope = { propertyId: string | null };

/// A category may be updated by M15:update holders when it is shared
/// (GLOBAL scope) or belongs to one of their properties.
function canTouch(user: Awaited<ReturnType<typeof getAuthUser>>, scope: Scope): boolean {
  if (!user) return false;
  if (scope.propertyId === null) return can(user, "update", "M15");
  return can(user, "update", "M15", { propertyId: scope.propertyId });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, updateSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:update");

  const cat = await prisma.stockCategory.findUnique({ where: { id } });
  if (!cat) return fail(404, "NOT_FOUND", "Category not found");
  if (!canTouch(user, { propertyId: cat.propertyId })) return fail(403, "FORBIDDEN", "No M15:update permission for this category");

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

  if (parsed.data.parentId !== undefined) {
    const next = parsed.data.parentId;
    if (next === cat.id) return fail(422, "INVALID_PARENT", "A category cannot be its own parent");
    if (next !== null) {
      const parent = await prisma.stockCategory.findUnique({ where: { id: next } });
      if (!parent) return fail(404, "NOT_FOUND", "Parent category not found");
      if (parent.propertyId !== cat.propertyId) return fail(422, "SCOPE_MISMATCH", "Parent category belongs to a different scope");
      if (parent.parentId) return fail(422, "MAX_DEPTH", "Only two category levels are supported (parent/child)");
      if (cat.parentId === null && parent.id !== null) {
        // promoting a parent into a child: children must move first
        const children = await prisma.stockCategory.count({ where: { parentId: cat.id } });
        if (children > 0) return fail(422, "HAS_CHILDREN", "Move this category's children into a parent first");
      }
    }
    data.parentId = next;
  }

  if (parsed.data.isActive !== undefined) {
    data.isActive = parsed.data.isActive;
    if (parsed.data.isActive === false && cat.parentId === null) data.parentId = null; // keep as root grouping
  }

  const updated = await prisma.stockCategory.update({ where: { id }, data });
  return ok({ id: updated.id });
}

/// Deleting a category that is still in use (children, stock items or POS
/// products) is refused — archive it (PATCH isActive=false) instead.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:update");

  const cat = await prisma.stockCategory.findUnique({ where: { id } });
  if (!cat) return fail(404, "NOT_FOUND", "Category not found");
  if (!canTouch(user, { propertyId: cat.propertyId })) return fail(403, "FORBIDDEN", "No M15:update permission for this category");

  const [childCount, itemCount, productCount] = await Promise.all([
    prisma.stockCategory.count({ where: { parentId: id } }),
    prisma.stockItem.count({ where: { categoryId: id } }),
    prisma.posProduct.count({ where: { categoryId: id } })
  ]);
  if (childCount > 0) return fail(409, "HAS_CHILDREN", "Delete or move its child categories first");
  if (itemCount + productCount > 0) return fail(409, "IN_USE", "Category is in use — archive it instead (archive keeps history intact)");

  const ip = clientIp(req);
  await prisma.stockCategory.delete({ where: { id } });
  const { logAudit } = await import("@/lib/audit");
  await logAudit({
    actorId: user.id ?? null,
    actorName: user.name,
    module: "M15",
    action: "category.deleted",
    entityType: "stock_category",
    entityId: id,
    summary: `Stock category "${cat.name}" deleted`,
    propertyId: cat.propertyId ?? undefined,
    ip
  });
  return ok({ id });
}