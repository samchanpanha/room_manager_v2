import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { transferStock } from "@/lib/operations/stock-service";

const schema = z.object({
  fromItemId: z.string().min(1),
  toItemId: z.string().min(1),
  qty: z.coerce.number().positive().max(100_000),
  note: z.string().max(300).optional()
});

/// M15 transfer between two items of the same property.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const from = await prisma.stockItem.findUnique({ where: { id: parsed.data.fromItemId } });
  if (!from) return fail(404, "NOT_FOUND", "Source item not found");
  if (!can(user, "create", "M15", { propertyId: from.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M15:create for this property");
  const result = await transferStock(
    { fromItemId: parsed.data.fromItemId, toItemId: parsed.data.toItemId, qtyMilli: Math.round(parsed.data.qty * 1000), note: parsed.data.note },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
