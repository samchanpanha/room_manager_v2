import { ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { fail } from "@/lib/api";
import { hasModuleAccess } from "@/lib/rbac/can";
import { runRentAlerts } from "@/lib/alerts/service";

/// M33 cron-shaped job: scan open rent invoices and emit due/overdue events
/// (the M21 Telegram dispatch job turns them into member-chat messages).
/// Gate: M33:update (Admin+ / Property Manager+).
export async function POST() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M33")) return fail(403, "FORBIDDEN", "Missing permission M33:update");
  const result = await runRentAlerts();
  return ok(result);
}