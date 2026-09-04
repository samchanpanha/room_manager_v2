import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.coerce.number().positive().max(100_000),
  category: z.string().max(40).optional(),
  stockItemId: z.string().min(1).optional()
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:read");
  const products = await prisma.posProduct.findMany({ include: { stockItem: true }, orderBy: { name: "asc" } });
  return ok({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceMinor: p.priceMinor,
      category: p.category,
      isActive: p.isActive,
      stock: p.stockItem ? { id: p.stockItem.id, name: p.stockItem.name, qtyMilli: p.stockItem.qtyMilli, unit: p.stockItem.unit } : null
    }))
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:create");
  const product = await prisma.posProduct.create({
    data: {
      name: parsed.data.name.trim(),
      priceMinor: Math.round(parsed.data.price * 100),
      category: parsed.data.category,
      stockItemId: parsed.data.stockItemId ?? null
    }
  });
  return ok({ id: product.id }, 201);
}
