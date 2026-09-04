import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createService } from "@/lib/services/service";
import { PRICING_MODELS } from "@/lib/services/service";

/// M12 catalog — visible to anyone with M12 read; catalog creation is
/// GLOBAL M12:update (admin/root only).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M12")) return fail(403, "FORBIDDEN", "Missing permission M12:read");
  const services = await prisma.serviceCatalog.findMany({
    include: { _count: { select: { assignments: { where: { status: "active" } }, usages: { where: { status: "pending" } } } } },
    orderBy: { code: "asc" }
  });
  return ok({
    services: services.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      pricingModel: s.pricingModel,
      unitPriceMinor: s.unitPriceMinor,
      unitLabel: s.unitLabel,
      isActive: s.isActive,
      activeAssignments: s._count.assignments,
      pendingUsages: s._count.usages
    })),
    pricingModels: PRICING_MODELS
  });
}

const schema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(80),
  pricingModel: z.string().min(3),
  price: z.coerce.number().min(0).max(100_000),
  unitLabel: z.string().max(20).optional()
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const g = await authorize("update", "M12"); // no resource → GLOBAL grants only
  if (g.response) return g.response;
  const result = await createService(parsed.data, { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) {
    return fail(result.code === "DUPLICATE_CODE" || result.code === "INVALID_CODE" || result.code === "INVALID_PRICING" ? 400 : 422, result.code, result.message);
  }
  return ok(result.data, 201);
}
