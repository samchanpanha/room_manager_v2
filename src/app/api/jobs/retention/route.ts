import { fail, ok, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { runRetentionPurge } from "@/lib/retention";
import { hasModuleAccess } from "@/lib/rbac/can";

/// §M28 data retention job (cron shape). M28:update (Admin+) only.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M28")) return fail(403, "FORBIDDEN", "Missing permission M28:update");
  const result = await runRetentionPurge({ id: user.id, name: user.name }, ip);
  return ok(result);
}
