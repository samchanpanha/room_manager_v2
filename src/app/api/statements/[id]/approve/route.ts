import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canManageStatements } from "@/lib/operations/statements-scope";
import { approveStatement } from "@/lib/operations/statements-service";

/// Approve → accrual DR 3900 / CR 2200 + PDF filed (§15 v1.2).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canManageStatements(user)) return fail(403, "FORBIDDEN", "Statement approval requires Accountant+");
  const result = await approveStatement(id, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data);
}
