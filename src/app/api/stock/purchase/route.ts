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
  note: z.string().max(300).optional()
});

/// M15 purchase (Staff W / PM / Admin in scope).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const item = await prisma.stockItem.findUnique({ where: { id: parsed.data.stockItemId } });
  if (!item) return fail(404, "NOT_FOUND", "Stock item not found");
  if (!can(user, "create", "M15", { propertyId: item.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M15:create for this property");
  const result = await purchaseStock(
    item.id,
    { qtyMilli: Math.round(parsed.data.qty * 1000), unitCostMinor: Math.round(parsed.data.unitCost * 100), note: parsed.data.note },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(422, result.code, result.message);
  return ok(result.data, 201);
}
