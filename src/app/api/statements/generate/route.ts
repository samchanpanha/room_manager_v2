import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canManageStatements } from "@/lib/operations/statements-scope";
import { generateStatements } from "@/lib/operations/statements-service";

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM").optional(),
  force: z.boolean().optional()
});

/// §M24 "generation job (configurable day)" — Accountant+/Admin trigger
/// (GLOBAL M24:update). Idempotent per contract+month.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canManageStatements(user)) return fail(403, "FORBIDDEN", "Statement generation requires Accountant+");
  const result = await generateStatements(parsed.data, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(422, result.code!, result.message);
  return ok(result.data, 201);
}
