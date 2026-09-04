import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { createStockItem, valuationReport } from "@/lib/operations/stock-service";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.enum(["beverage", "snack", "grocery", "supply", "part", "other"]),
  unit: z.string().min(1).max(20),
  minQty: z.coerce.number().min(0).max(1_000_000).optional(),
  supplierId: z.string().min(1).optional(),
  propertyId: z.string().min(1)
});

/// M15 list — the valuation report (on-hand × moving average) + low-stock.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");
  // GLOBAL holders see every property (§5 scope resolution); otherwise assigned only.
  const grants = user.permissions.filter((p) => p.module === "M15" && p.action === "read");
  const scoped = grants.some((g) => g.scope === "GLOBAL")
    ? (await prisma.property.findMany({ select: { id: true } })).map((p) => p.id)
    : user.propertyIds;
  const reports = await Promise.all([...new Set(scoped)].map((pid) => valuationReport(pid)));
  const items = reports.flatMap((r) => r.items);
  return ok({ items, totalValueMinor: items.reduce((s, i) => s + i.valueMinor, 0), lowStockCount: items.filter((i) => i.low).length });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M15", { propertyId: parsed.data.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M15:create for this property");
  const result = await createStockItem(
    {
      name: parsed.data.name,
      category: parsed.data.category,
      unit: parsed.data.unit,
      minQtyMilli: parsed.data.minQty != null ? Math.round(parsed.data.minQty * 1000) : undefined,
      supplierId: parsed.data.supplierId,
      propertyId: parsed.data.propertyId
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
