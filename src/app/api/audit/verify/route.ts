import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { verifyAuditChain } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";

/// §M27 tamper-evidence check: recompute the whole hash chain.
/// ADMIN = M(audit) scope (§5, §15 v1.4c) — M27:read suffices.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M27")) return fail(403, "FORBIDDEN", "Missing permission M27:read");
  return ok(await verifyAuditChain());
}
