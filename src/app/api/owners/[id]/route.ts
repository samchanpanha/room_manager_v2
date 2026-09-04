import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loadOwnerGuardTarget } from "@/lib/owners";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  companyName: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(["active", "archived"]).optional()
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const target = await loadOwnerGuardTarget(id);
  if (!target) return fail(404, "NOT_FOUND", "Owner not found");

  const g = await authorize("update", "M03", { ownerUserId: target.ownerUserId });
  if (g.response) return g.response;

  const before = await prisma.ownerProfile.findUnique({ where: { id }, include: { party: true } });
  if (!before) return fail(404, "NOT_FOUND", "Owner not found");

  await prisma.$transaction([
    prisma.ownerProfile.update({
      where: { id },
      data: { companyName: parsed.data.companyName, notes: parsed.data.notes, status: parsed.data.status },
      include: { party: true }
    }),
    prisma.party.update({
      where: { id: target.owner.partyId },
      data: { name: parsed.data.name, phone: parsed.data.phone }
    })
  ]);

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M03",
    action: "update",
    entityType: "owner",
    entityId: id,
    summary: `Updated owner ${before.party.name}`,
    before: { name: before.party.name, phone: before.party.phone, status: before.status, companyName: before.companyName },
    after: parsed.data,
    ip: clientIp(req)
  });
  return ok({ id });
}
