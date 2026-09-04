import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canManageStatements } from "@/lib/operations/statements-scope";
import { payStatement } from "@/lib/operations/statements-service";

const schema = z.object({ method: z.enum(["cash", "bank_transfer"]).default("bank_transfer") });

/// §M24 "paid via M09" mechanics: payout posting DR 2200 / CR cash|bank
/// (refType `payout`) — reduces Owner Payable (§M24 acceptance).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canManageStatements(user)) return fail(403, "FORBIDDEN", "Payouts require Accountant+");
  const result = await payStatement(id, { method: parsed.data.method }, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data);
}
