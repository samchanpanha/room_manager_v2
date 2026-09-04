import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { memberStatement } from "@/lib/ledger/service";

/// Member account statement (M08 screen). GLOBAL M08:read roles see anyone;
/// members see their OWN statement only (matrix cell O(stmt)).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const globalRead = user.permissions.some((p) => p.module === "M08" && p.action === "read" && p.scope === "GLOBAL");
  if (!globalRead) {
    const own = user.partyId
      ? await prisma.memberProfile.findFirst({ where: { id, partyId: user.partyId } })
      : null;
    if (!own) return fail(403, "FORBIDDEN", "Statement outside your visible scope");
  }

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");
  const statement = await memberStatement(id);
  return ok({
    member: { id: member.id, name: member.party.name },
    ...statement
  });
}
