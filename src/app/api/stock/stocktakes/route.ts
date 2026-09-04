import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { runStocktake } from "@/lib/operations/stock-service";

const schema = z.object({
  propertyId: z.string().min(1),
  note: z.string().max(300).optional(),
  counted: z.array(z.object({ stockItemId: z.string().min(1), counted: z.coerce.number().min(0).max(1_000_000) })).min(1)
});

/// M15 stocktake history (variance report per take).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");
  const takes = await prisma.stocktake.findMany({
    where: user.propertyIds.length > 0 ? { propertyId: { in: user.propertyIds } } : {},
    include: { lines: { include: { stockItem: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return ok({
    stocktakes: takes.map((t) => ({
      id: t.id,
      code: t.code,
      status: t.status,
      valueDeltaMinor: t.valueDeltaMilli / 1000,
      note: t.note,
      createdAt: t.createdAt,
      lines: t.lines.map((l) => ({ name: l.stockItem.name, expected: l.expectedMilli, counted: l.countedMilli, variance: l.varianceMilli, unit: l.stockItem.unit }))
    }))
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M15", { propertyId: parsed.data.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M15:create for this property");
  const result = await runStocktake(
    {
      propertyId: parsed.data.propertyId,
      note: parsed.data.note,
      counted: parsed.data.counted.map((c) => ({ stockItemId: c.stockItemId, countedMilli: Math.round(c.counted * 1000) }))
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  return ok(result.data, 201);
}
