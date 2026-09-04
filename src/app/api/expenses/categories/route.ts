import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canApproveExpenses, expensesScope } from "@/lib/operations/expenses-scope";
import { createCategory, listCategories } from "@/lib/operations/expenses-service";

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const scope = await expensesScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M20:read");
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") ?? scope.propertyIds[0];
  if (!propertyId) return ok({ categories: [] });
  const categories = await listCategories(propertyId);
  return ok({ categories: categories.map((c) => ({ id: c.id, name: c.name, accountCode: c.accountCode, budgetMinor: c.budgets[0]?.amountMinor ?? null })) });
}

const createSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(2).max(80),
  accountCode: z.enum(["5000", "5100"])
});

/// Category management is Accountant+ (GLOBAL M20:update; PM holds only R).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canApproveExpenses(user)) return fail(403, "FORBIDDEN", "Category management requires Accountant+");
  const result = await createCategory(parsed.data, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data, 201);
}
