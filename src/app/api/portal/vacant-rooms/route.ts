import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { getMemberForUser, memberVacantRooms } from "@/lib/portal";

/// Vacant rooms in the member's property — the target picker for the §M25
/// room-move request (the request itself goes through POST /api/room-moves,
/// which enforces own-lease + requestedByRole "member").
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M25")) return fail(403, "FORBIDDEN", "Missing permission M25:read");
  const member = await getMemberForUser(user);
  if (!member) return fail(404, "NOT_A_MEMBER", "This account is not linked to a member profile");
  return ok({ rooms: await memberVacantRooms(member.id) });
}
