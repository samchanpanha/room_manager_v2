import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loadOwnerGuardTarget } from "@/lib/owners";

const bodySchema = z.object({
  kind: z.enum(["BANK", "MOBILE_MONEY", "CASH", "OTHER"]),
  bankName: z.string().max(120).optional(),
  accountName: z.string().min(2).max(120),
  accountNumber: z.string().min(3).max(60),
  notes: z.string().max(300).optional(),
  isPrimary: z.boolean().default(false)
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const target = await loadOwnerGuardTarget(id);
  if (!target) return fail(404, "NOT_FOUND", "Owner not found");
  const g = await authorize("update", "M03", { ownerUserId: target.ownerUserId });
  if (g.response) return g.response;

  const owner = await prisma.ownerProfile.findUnique({ where: { id }, include: { party: true } });
  if (!owner) return fail(404, "NOT_FOUND", "Owner not found");

  const method = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.ownerPayoutMethod.updateMany({ where: { ownerProfileId: id, isPrimary: true }, data: { isPrimary: false } });
    }
    return tx.ownerPayoutMethod.create({ data: { ownerProfileId: id, ...parsed.data } });
  });

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M03",
    action: "update",
    entityType: "owner_payout_method",
    entityId: method.id,
    summary: `Added payout method ${method.kind} ••••${method.accountNumber.slice(-4)} for ${owner.party.name}${method.isPrimary ? " (primary)" : ""}`,
    after: { kind: method.kind, isPrimary: method.isPrimary },
    ip: clientIp(req)
  });
  return ok({ id: method.id }, 201);
}
