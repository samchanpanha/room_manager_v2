import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getLinkForPrincipal } from "@/lib/telegram/service";
import { logAudit } from "@/lib/audit";

/// Unlink the caller's own chat (§M21 O(link) includes the reverse action).
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "update", "M21", { ownerUserId: user.id })) return fail(403, "FORBIDDEN", "Missing permission M21:update");
  if (!user.partyId) return fail(404, "NOT_LINKED", "This account has no party profile");

  const member = await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
  const owner = member ? null : await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
  const principalType = member ? "member" : owner ? "owner" : null;
  const principalId = member?.id ?? owner?.id ?? null;
  if (!principalType || !principalId) return fail(404, "NOT_LINKED", "No member or owner profile is linked to this account");

  const link = await getLinkForPrincipal(principalType, principalId);
  if (!link) return fail(404, "NOT_FOUND", "No linked chat");
  await prisma.telegramLink.update({ where: { id: link.id }, data: { unlinkedAt: new Date() } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M21",
    action: "telegram.unlinked",
    entityType: "telegram_link",
    entityId: link.chatId,
    summary: `Chat ${link.chatId} unlinked by the ${principalType}`,
    ip: clientIp(req)
  });
  return ok({ unlinked: true });
}
