import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canApproveExpenses } from "@/lib/operations/expenses-scope";
import { runRecurring } from "@/lib/operations/expenses-service";

/// Materialize this month's expense from a template (idempotent per month).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canApproveExpenses(user)) return fail(403, "FORBIDDEN", "Running recurring templates requires Accountant+");
  const result = await runRecurring(id, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data, 201);
}
