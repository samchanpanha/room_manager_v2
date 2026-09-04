import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { valuationReport } from "@/lib/operations/stock-service";

/// M15 acceptance: "valuation report correct" — per-property on-hand ×
/// moving average + low-stock summary.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");
  const url = new URL(req.url);
  const requested = url.searchParams.get("propertyId") ?? user.propertyIds[0];
  if (!requested) return ok({ items: [], totalValueMinor: 0, lowStockCount: 0 });
  if (!can(user, "read", "M15", { propertyId: requested })) return fail(403, "FORBIDDEN", "No access to this property");
  return ok(await valuationReport(requested));
}
