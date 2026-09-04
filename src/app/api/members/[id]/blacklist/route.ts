import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";

const bodySchema = z.object({ reason: z.string().min(3).max(500) });

/// Blacklist flag (M02) — reason required, blocks all lifecycle moves and new leases.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");
  if (member.blacklisted) return fail(409, "ALREADY_BLACKLISTED", "Member is already blacklisted");

  const g = await authorize("update", "M02", member.homePropertyId ? { propertyId: member.homePropertyId } : undefined);
  if (g.response) return g.response;

  await prisma.memberProfile.update({
    where: { id },
    data: { blacklisted: true, blacklistReason: parsed.data.reason }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "update",
    entityType: "member_blacklist",
    entityId: id,
    summary: `Blacklisted member ${member.party.name}: ${parsed.data.reason}`,
    propertyId: member.homePropertyId,
    before: { blacklisted: false },
    after: { blacklisted: true, reason: parsed.data.reason },
    ip: clientIp(req)
  });
  await emitDomainEvent("member.blacklisted", { memberId: id, reason: parsed.data.reason }, member.homePropertyId);
  return ok({ blacklisted: true });
}
