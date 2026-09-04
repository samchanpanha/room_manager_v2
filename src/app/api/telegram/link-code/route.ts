import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createLinkCode } from "@/lib/telegram/service";
import { logAudit } from "@/lib/audit";

/// §M21 "user sees one-time link code in app" — members (O(link)) and owners
/// (§15 v1.3 O(link)) self-serve; the code is bound to the caller's profile,
/// so the bot can only ever link the caller's own principal.
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!user.partyId) return fail(404, "NOT_LINKED", "This account has no party profile");

  const resource = { ownerUserId: user.id };
  if (!can(user, "create", "M21", resource)) return fail(403, "FORBIDDEN", "Missing permission M21:create");

  const member = await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
  const owner = member ? null : await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
  const principalType = member ? "member" : owner ? "owner" : null;
  const principalId = member?.id ?? owner?.id ?? null;
  if (!principalType || !principalId) return fail(404, "NOT_LINKED", "No member or owner profile is linked to this account");

  const result = await createLinkCode(principalType, principalId);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M21",
    action: "telegram.link_code_issued",
    entityType: `${principalType}_profile`,
    entityId: principalId,
    summary: `Telegram link code issued (${principalType})`,
    ip: clientIp(req)
  });
  return ok({ code: result.code, expiresAt: result.expiresAt.toISOString(), botUsername: result.botUsername, deepLink: result.deepLink, principalType }, 201);
}
