import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { expensesScope } from "@/lib/operations/expenses-scope";
import { profitAndLoss } from "@/lib/operations/expenses-service";

/// §M20: P&L per property (&propertyId=) or consolidated; reconciles with the
/// ledger exactly (reconciliation[].deltaMinor all 0).
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const scope = await expensesScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M20:read");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  if (propertyId && !scope.propertyIds.includes(propertyId)) {
    return fail(403, "FORBIDDEN", "Property outside your M20 scope");
  }
  const result = await profitAndLoss({ month: url.searchParams.get("month") ?? undefined, propertyId, scopePropertyIds: scope.propertyIds });
  if (!result.ok) return fail(422, result.code!, result.message);
  return ok(result.data);
}
