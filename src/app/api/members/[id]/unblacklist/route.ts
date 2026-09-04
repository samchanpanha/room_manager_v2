import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ reason: z.string().min(3).max(500) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");
  if (!member.blacklisted) return fail(409, "NOT_BLACKLISTED", "Member is not blacklisted");

  const g = await authorize("update", "M02", member.homePropertyId ? { propertyId: member.homePropertyId } : undefined);
  if (g.response) return g.response;

  await prisma.memberProfile.update({ where: { id }, data: { blacklisted: false, blacklistReason: null } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "update",
    entityType: "member_blacklist",
    entityId: id,
    summary: `Removed blacklist from ${member.party.name}: ${parsed.data.reason}`,
    propertyId: member.homePropertyId,
    before: { blacklisted: true, reason: member.blacklistReason },
    after: { blacklisted: false },
    ip: clientIp(req)
  });
  return ok({ blacklisted: false });
}
