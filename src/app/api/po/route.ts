import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess, can } from "@/lib/rbac/can";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/operations/po-service";
import { prisma } from "@/lib/db";

const lineSchema = z.object({
  stockItemId: z.string().min(1),
  qtyMilli: z.coerce.number().int().positive(),
  unitCostMinor: z.coerce.number().int().nonnegative()
});

const createSchema = z.object({
  propertyId: z.string().min(1),
  supplierId: z.string().min(1).optional(),
  supplierName: z.string().max(160).optional(),
  note: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(50)
});

const listSchema = z.object({
  propertyId: z.string().optional(),
  status: z.enum(["draft", "placed", "received", "void", "all"]).optional().default("all")
});

/// M29 Purchase Orders — reads for R+ roles (accountant read-only, staff/PM/ADMIN manage).
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M29")) return fail(403, "FORBIDDEN", "Missing permission M29:read");

  const url = new URL(req.url);
  const parsed = listSchema.safeParse({
    propertyId: url.searchParams.get("propertyId") ?? undefined,
    status: url.searchParams.get("status") ?? "all"
  });
  if (!parsed.success) return fail(400, "INVALID_QUERY", "Invalid query parameters");

  let propertyId: string | null = parsed.data.propertyId ?? null;
  if (!propertyId) {
    // Default to the first property visible to the user.
    const first = await prisma.property.findFirst({ orderBy: { code: "asc" }, select: { id: true } });
    propertyId = first?.id ?? null;
  }
  if (propertyId && !can(user, "read", "M29", { propertyId })) return fail(403, "FORBIDDEN", "No read access to this property");

  const [orders, stockItems, suppliers] = await Promise.all([
    listPurchaseOrders(propertyId, parsed.data.status),
    prisma.stockItem.findMany({ where: { ...(propertyId ? { propertyId } : {}), isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, qtyMilli: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);
  return ok({ orders, stockItems, suppliers });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "create", "M29")) return fail(403, "FORBIDDEN", "Missing permission M29:create");
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const { propertyId } = parsed.data;
  if (!can(user, "create", "M29", { propertyId })) return fail(403, "FORBIDDEN", "No create access on this property");

  const result = await createPurchaseOrder(parsed.data, { id: user.id, name: user.name }, ip);
  if (!result.ok) return fail(400, result.code, result.message);
  return ok(result.data, 201);
}