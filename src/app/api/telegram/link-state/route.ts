import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getLinkForPrincipal, parsePrefs, DEFAULT_PREFS } from "@/lib/telegram/service";

/// The caller's own link state + effective preference toggles.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M21", { ownerUserId: user.id })) return fail(403, "FORBIDDEN", "Missing permission M21:read");
  if (!user.partyId) return ok({ linked: false });

  const member = await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
  const owner = member ? null : await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } });
  const principalType = member ? "member" : owner ? "owner" : null;
  const principalId = member?.id ?? owner?.id ?? null;
  if (!principalType || !principalId) return ok({ linked: false });

  const link = await getLinkForPrincipal(principalType, principalId);
  if (!link) return ok({ linked: false, principalType });
  return ok({
    linked: true,
    principalType,
    linkedAt: link.linkedAt.toISOString(),
    chatMasked: `${link.chatId.slice(0, 3)}•••${link.chatId.slice(-3)}`,
    displayName: link.displayName,
    prefs: { ...DEFAULT_PREFS, ...parsePrefs(link.prefs) }
  });
}
