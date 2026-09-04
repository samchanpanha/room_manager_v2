import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { canManageStatements } from "@/lib/operations/statements-scope";
import { generateStatements } from "@/lib/operations/statements-service";

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional(), force: z.boolean().optional() });

/// Scheduled job shape of /api/statements/generate (cron wiring lands with the
/// Phase 21 ops hardening). Gate: GLOBAL M24:update.
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!canManageStatements(user)) return fail(403, "FORBIDDEN", "Statement generation requires Accountant+");
  const result = await generateStatements(parsed.data, { id: user.id, name: user.name }, clientIp(req));
  if (!result.ok) return fail(422, result.code!, result.message);
  return ok(result.data);
}
