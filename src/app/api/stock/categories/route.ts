import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can, hasModuleAccess } from "@/lib/rbac/can";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  parentId: z.string().min(1).nullable().optional(),
  propertyId: z.string().min(1).nullable().optional()
});

/// M15 category hierarchy — list categories the user can see: shared
/// (propertyId null) plus any in-scope property's own categories.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");
  const grants = user.permissions.filter((p) => p.module === "M15" && p.action === "read");
  const scoped = [...new Set(grants.some((g) => g.scope === "GLOBAL") ? (await prisma.property.findMany({ select: { id: true } })).map((p) => p.id) : user.propertyIds)];
  const categories = await prisma.stockCategory.findMany({
    where: { OR: [{ propertyId: null }, { propertyId: { in: scoped } }] },
    select: { id: true, name: true, parentId: true, propertyId: true, sortOrder: true, isActive: true, _count: { select: { stockItems: true, products: true, children: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  return ok({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      propertyId: c.propertyId,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      itemCount: c._count.stockItems + c._count.products,
      childCount: c._count.children
    }))
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const pid = parsed.data.propertyId ?? null;

  // Creating a property-owned category needs M15:create on that property;
  // a shared (global) one is admin-level (GLOBAL scope).
  if (pid === null) {
    if (!can(user, "create", "M15")) return fail(403, "FORBIDDEN", "Shared categories require M15:create");
  } else if (!can(user, "create", "M15", { propertyId: pid })) {
    return fail(403, "FORBIDDEN", "Missing permission M15:create for this property");
  }

  if (parsed.data.parentId) {
    const parent = await prisma.stockCategory.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent) return fail(404, "NOT_FOUND", "Parent category not found");
    if (parent.propertyId !== pid) return fail(422, "SCOPE_MISMATCH", "Parent category belongs to a different scope");
    if (parent.parentId) return fail(422, "MAX_DEPTH", "Only two category levels are supported (parent/child)");
  }

  const dup = await prisma.stockCategory.findFirst({ where: { name: parsed.data.name, parentId: parsed.data.parentId ?? null, propertyId: pid } });
  if (dup) return fail(409, "DUPLICATE", `A category "${parsed.data.name}" already exists here`);

  const cat = await prisma.stockCategory.create({
    data: { name: parsed.data.name, parentId: parsed.data.parentId ?? null, propertyId: pid }
  });
  return ok({ id: cat.id }, 201);
}