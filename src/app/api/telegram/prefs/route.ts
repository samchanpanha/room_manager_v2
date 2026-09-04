import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { getLinkForPrincipal, setPrefs, parsePrefs, DEFAULT_PREFS, type Prefs } from "@/lib/telegram/service";

const schema = z.object({
  prefs: z.object({
    invoiceIssued: z.boolean().optional(),
    paymentReceived: z.boolean().optional(),
    overdueReminder: z.boolean().optional(),
    ticketUpdates: z.boolean().optional(),
    complaintUpdates: z.boolean().optional(),
    lowStock: z.boolean().optional(),
    statementReady: z.boolean().optional(),
    occupancyDigest: z.boolean().optional()
  })
});

/// §M21 "per-user preference toggles" — merges the caller's own toggles.
export async function PATCH(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
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
  if (!link) return fail(404, "NOT_FOUND", "No linked chat — link one first");
  const merged = await setPrefs(link.id, parsed.data.prefs as Prefs);
  return ok({ prefs: { ...DEFAULT_PREFS, ...parsePrefs(JSON.stringify(merged)) } });
}
