import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canApproveExpenses } from "@/lib/operations/expenses-scope";
import { voidExpense } from "@/lib/operations/expenses-service";

const schema = z.object({ reason: z.string().min(3).max(500) });

/// Void an approved expense — ledger reversal (Accountant+).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canApproveExpenses(user)) return fail(403, "FORBIDDEN", "Voiding expenses requires Accountant+");
  const result = await voidExpense(id, parsed.data.reason, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data);
}
