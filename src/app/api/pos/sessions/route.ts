import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { openSession } from "@/lib/operations/pos-service";

const openSchema = z.object({ propertyId: z.string().min(1), float: z.coerce.number().min(0).max(100_000).default(0) });

export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:read");
  const sessions = await prisma.posSession.findMany({
    include: { sales: true },
    orderBy: { openedAt: "desc" },
    take: 20
  });
  return ok({
    sessions: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingFloatMinor: s.openingFloatMinor,
      expectedCashMinor: s.expectedCashMinor,
      countedCashMinor: s.countedCashMinor,
      varianceMinor: s.varianceMinor,
      closeNote: s.closeNote,
      sales: s.sales.length,
      cashTotalMinor: s.sales.filter((x) => x.method === "cash").reduce((sum, x) => sum + x.totalMinor, 0)
    }))
  });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, openSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "create", "M14", { propertyId: parsed.data.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M14:create for this property");
  const result = await openSession({ propertyId: parsed.data.propertyId, openingFloatMinor: Math.round(parsed.data.float * 100) }, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(422, result.code, result.message);
  return ok(result.data, 201);
}
