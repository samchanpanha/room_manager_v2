import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canManageStatements } from "@/lib/operations/statements-scope";
import { adjustStatement } from "@/lib/operations/statements-service";

const schema = z.object({
  adjustments: z.coerce.number().min(-1_000_000).max(1_000_000), // dollars, may be negative
  reason: z.string().min(3).max(500)
});

/// §M24 "± adjustments" — draft only, reason mandatory, audited.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canManageStatements(user)) return fail(403, "FORBIDDEN", "Statement adjustments require Accountant+");
  const result = await adjustStatement(
    id,
    { adjustmentsMinor: Math.round(parsed.data.adjustments * 100), reason: parsed.data.reason },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code!, result.message);
  return ok(result.data);
}
