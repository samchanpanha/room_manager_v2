import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { upsertTariff } from "@/lib/utilities/service";
import { isMeterType, isTierList } from "@/lib/utilities/machines";
import { visiblePropertyIds, propertyAccessible } from "@/lib/tenant-scope";

/// M11 tariffs — read for anyone with M11 read, scoped to the workspace
/// (org-wide tariffs + tariffs for the user's visible properties).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M11")) return fail(403, "FORBIDDEN", "Missing permission M11:read");
  const scoped = await visiblePropertyIds(user, "M11");
  const tariffs = await prisma.tariff.findMany({
    where:
      scoped === "ALL"
        ? undefined // platform root sees every workspace's tariffs
        : {
            OR: [
              { tenantId: user.tenantId, propertyId: null },
              { tenantId: user.tenantId, propertyId: { in: scoped } }
            ]
          },
    orderBy: [{ utilityType: "asc" }, { effectiveFrom: "desc" }]
  });
  return ok({
    tariffs: tariffs.map((t) => ({
      id: t.id,
      utilityType: t.utilityType,
      name: t.name,
      propertyId: t.propertyId,
      unitRateMinor: t.unitRateMinor,
      tiers: t.tiers,
      effectiveFrom: t.effectiveFrom,
      isActive: t.isActive
    }))
  });
}

const schema = z.object({
  utilityType: z.string().refine(isMeterType, "type must be elec, water or gas"),
  name: z.string().min(2).max(60),
  propertyId: z.string().min(1).nullish(),
  unitRateMinor: z.coerce.number().int().min(0), // minor per unit, e.g. 35 = $0.35/kWh
  tiers: z
    .array(z.object({ upToMilli: z.number().int().positive().nullish(), ratePerUnitMinor: z.number().int().min(0) }))
    .optional(),
  effectiveFrom: z.string().datetime()
});

/// Create a tariff (org-wide when propertyId is null — GLOBAL grant required).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const tiers = parsed.data.tiers ?? undefined;
  if (tiers && !isTierList(tiers)) return fail(400, "INVALID_TIERS", "tiers must be a non-empty list ending with an open bracket (upToMilli: null)");
  const g = await authorize("create", "M11", parsed.data.propertyId ? { propertyId: parsed.data.propertyId } : undefined);
  if (g.response) return g.response;
  if (parsed.data.propertyId && !(await propertyAccessible(g.user, parsed.data.propertyId))) return fail(403, "FORBIDDEN", "Property does not belong to your organization");
  const result = await upsertTariff(
    {
      tenantId: g.user.tenantId,
      utilityType: parsed.data.utilityType,
      name: parsed.data.name,
      propertyId: parsed.data.propertyId ?? null,
      unitRateMinor: parsed.data.unitRateMinor,
      tiers,
      effectiveFrom: new Date(parsed.data.effectiveFrom)
    },
    { id: g.user.id, name: g.user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "INVALID_TYPE" || result.code === "INVALID_RATE" ? 400 : 422, result.code, result.message);
  return ok(result.data, 201);
}
