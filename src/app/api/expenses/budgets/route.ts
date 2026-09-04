import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canApproveExpenses } from "@/lib/operations/expenses-scope";
import { setBudget } from "@/lib/operations/expenses-service";

const schema = z.object({
  categoryId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM"),
  amount: z.coerce.number().min(0).max(10_000_000)
});

/// Upsert a monthly budget (Accountant+).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canApproveExpenses(user)) return fail(403, "FORBIDDEN", "Budget management requires Accountant+");
  const result = await setBudget(
    { categoryId: parsed.data.categoryId, month: parsed.data.month, amountMinor: Math.round(parsed.data.amount * 100) },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data, 201);
}
