import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/rbac/can";

/// §M27 sessions & devices list. Own sessions for anyone; Admin+ may list
/// another user's via ?userId= (§15 v1.4c audit scope).
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const url = new URL(req.url);
  const requested = url.searchParams.get("userId");
  let userId = user.id;
  if (requested && requested !== user.id) {
    if (!(user.isSuperAdmin || hasModuleAccess(user, "update", "M27"))) {
      return fail(403, "FORBIDDEN", "Missing permission M27:update");
    }
    userId = requested;
  }

  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true, revokedAt: true }
  });
  return ok({
    sessions: sessions.map((s) => ({ ...s, current: s.id === user.sessionId }))
  });
}
