import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { attendanceScope } from "@/lib/operations/attendance-scope";
import { monthlySummary } from "@/lib/operations/attendance-service";

/// §M23 "monthly summary per staff".
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  if (!propertyId) return fail(422, "PROPERTY_REQUIRED", "propertyId is required");
  const scope = attendanceScope(user, propertyId);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M23:read");
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const result = await monthlySummary(propertyId, month);
  if (!result.ok) return fail(422, result.code!, result.message);
  return ok({ ...result.data, scope: scope.own ? "own" : "all", rows: scope.userId ? result.data.rows.filter((r) => r.userId === scope.userId) : result.data.rows });
}
