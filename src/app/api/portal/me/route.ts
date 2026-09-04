import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { getMemberForUser, memberDashboard } from "@/lib/portal";

/// §M25 dashboard aggregation (room, lease, balance, deposit, open requests,
/// announcements) — strictly OWN, read-only, mapped onto existing data.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M25")) return fail(403, "FORBIDDEN", "Missing permission M25:read");
  const member = await getMemberForUser(user);
  if (!member) return fail(404, "NOT_A_MEMBER", "This account is not linked to a member profile");

  const dashboard = await memberDashboard(member.id);
  return ok({ member, ...dashboard });
}
