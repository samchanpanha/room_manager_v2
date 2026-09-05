import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { normalizeEan13 } from "@/lib/barcode";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.coerce.number().positive().max(100_000),
  category: z.string().max(40).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  barcode: z.string().max(32).optional(),
  sku: z.string().max(40).optional(),
  description: z.string().max(500).optional(),
  stockItemId: z.string().min(1).optional()
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  price: z.coerce.number().positive().max(100_000).optional(),
  category: z.string().max(40).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  barcode: z.string().max(32).nullable().optional(),
  sku: z.string().max(40).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  stockItemId: z.string().min(1).nullable().optional()
});

/// Resolve a category id to its "Parent/Child" path snapshot (mirrors the
/// legacy string column so reports/tills that read `category` keep working).
async function resolvePosCategory(categoryId: string | undefined | null, fallback: string | null | undefined): Promise<{ categoryId: string | null; category: string | null }> {
  if (categoryId) {
    const cat = await prisma.stockCategory.findUnique({ where: { id: categoryId } });
    if (cat) {
      const parent = cat.parentId ? await prisma.stockCategory.findUnique({ where: { id: cat.parentId } }) : null;
      return { categoryId: cat.id, category: parent ? `${parent.name}/${cat.name}` : cat.name };
    }
  }
  return { categoryId: null, category: fallback?.trim() || null };
}

/// Normalize EAN-13 barcodes (add check digit when 12 digits are typed).
function barcodeOrNull(raw: string | undefined | null): { barcode: string | null; error?: string } {
  if (raw == null || raw.trim() === "") return { barcode: null };
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12 && digits.length !== 13) {
    return { barcode: null, error: "Barcode must be 12 or 13 digits (EAN-13)" };
  }
  const normalized = normalizeEan13(digits);
  return normalized ? { barcode: normalized } : { barcode: null, error: "Invalid EAN-13 barcode (check digit mismatch)" };
}

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
      categoryId: p.categoryId,
      barcode: p.barcode,
      sku: p.sku,
      description: p.description,
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

  const bc = barcodeOrNull(parsed.data.barcode);
  if (bc.error) return fail(400, "INVALID_BARCODE", bc.error);
  if (bc.barcode) {
    const dup = await prisma.posProduct.findUnique({ where: { barcode: bc.barcode } });
    if (dup) return fail(409, "BARCODE_TAKEN", `A product with barcode ${bc.barcode} already exists`);
  }

  const cat = await resolvePosCategory(parsed.data.categoryId, parsed.data.category);
  const product = await prisma.posProduct.create({
    data: {
      name: parsed.data.name.trim(),
      priceMinor: Math.round(parsed.data.price * 100),
      category: cat.category,
      categoryId: cat.categoryId,
      barcode: bc.barcode,
      sku: parsed.data.sku?.trim() ?? null,
      description: parsed.data.description?.trim() ?? null,
      stockItemId: parsed.data.stockItemId ?? null
    }
  });
  return ok({ id: product.id }, 201);
}

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return fail(400, "ID_REQUIRED", "Product id query param is required");
  const parsed = await parseBody(req, updateSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "update", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:update");

  const exists = await prisma.posProduct.findUnique({ where: { id } });
  if (!exists) return fail(404, "NOT_FOUND", "Product not found");

  const bc = barcodeOrNull(parsed.data.barcode);
  if (bc.error) return fail(400, "INVALID_BARCODE", bc.error);
  if (bc.barcode) {
    const dup = await prisma.posProduct.findFirst({ where: { barcode: bc.barcode, id: { not: id } } });
    if (dup) return fail(409, "BARCODE_TAKEN", `A product with barcode ${bc.barcode} already exists`);
  }

  const data: Record<string, unknown> = { barcode: bc.barcode };
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.price !== undefined) data.priceMinor = Math.round(parsed.data.price * 100);
  if (parsed.data.categoryId !== undefined) {
    const cat = await resolvePosCategory(parsed.data.categoryId, parsed.data.category);
    data.categoryId = cat.categoryId;
    data.category = cat.category;
  } else if (parsed.data.category !== undefined) {
    data.category = parsed.data.category;
  }
  if (parsed.data.sku !== undefined) data.sku = parsed.data.sku?.trim() ?? null;
  if (parsed.data.description !== undefined) data.description = parsed.data.description?.trim() ?? null;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.stockItemId !== undefined) data.stockItemId = parsed.data.stockItemId;

  const product = await prisma.posProduct.update({ where: { id }, data });
  return ok({ id: product.id });
}