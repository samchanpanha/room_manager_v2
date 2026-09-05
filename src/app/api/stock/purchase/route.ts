import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { purchaseStock } from "@/lib/operations/stock-service";

const schema = z.object({
  stockItemId: z.string().min(1),
  qty: z.coerce.number().positive().max(100_000),
  unitCost: z.coerce.number().positive().max(1_000_000),
  unit: z.enum(["base", "pack"]).optional(),
  note: z.string().max(300).optional()
});

/// M15 purchase (Staff W / PM / Admin in scope). `unit="pack"` buys in the
/// item's pack unit — 1 carton of a 12-bottle item adds 12 to on-hand and
/// the per-pack cost is divided by the pack size for the moving average.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const item = await prisma.stockItem.findUnique({ where: { id: parsed.data.stockItemId } });
  if (!item) return fail(404, "NOT_FOUND", "Stock item not found");
  if (!can(user, "create", "M15", { propertyId: item.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M15:create for this property");
  if (parsed.data.unit === "pack" && (!item.packUnit || !item.packSize)) {
    return fail(422, "INVALID_PACK", `"${item.name}" has no pack unit defined`);
  }
  const result = await purchaseStock(
    item.id,
    {
      qtyMilli: Math.round(parsed.data.qty * 1000),
      unitCostMinor: Math.round(parsed.data.unitCost * 100),
      note: parsed.data.note,
      inPacks: parsed.data.unit === "pack"
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(422, result.code, result.message);
  return ok(result.data, 201);
}
