import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loadOwnerGuardTarget } from "@/lib/owners";

const patchSchema = z.object({
  isPrimary: z.boolean().optional(),
  notes: z.string().max(300).nullable().optional(),
  accountName: z.string().min(2).max(120).optional()
});

async function guard(methodId: string) {
  const method = await prisma.ownerPayoutMethod.findUnique({ where: { id: methodId } });
  if (!method) return { fail: fail(404, "NOT_FOUND", "Payout method not found") } as const;
  const target = await loadOwnerGuardTarget(method.ownerProfileId);
  if (!target) return { fail: fail(404, "NOT_FOUND", "Owner not found") } as const;
  const g = await authorize("update", "M03", { ownerUserId: target.ownerUserId });
  if (g.response) return { fail: g.response } as const;
  return { method, g } as const;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;
  const r = await guard(id);
  if ("fail" in r) return r.fail;

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.ownerPayoutMethod.updateMany({ where: { ownerProfileId: r.method.ownerProfileId, isPrimary: true }, data: { isPrimary: false } });
    }
    await tx.ownerPayoutMethod.update({ where: { id }, data: parsed.data });
  });
  await logAudit({
    actorId: r.g.user.id,
    actorName: r.g.user.name,
    module: "M03",
    action: "update",
    entityType: "owner_payout_method",
    entityId: id,
    summary: `Updated payout method ••••${r.method.accountNumber.slice(-4)}${parsed.data.isPrimary ? " → primary" : ""}`,
    after: parsed.data,
    ip: clientIp(req)
  });
  return ok({ id });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await guard(id);
  if ("fail" in r) return r.fail;
  if (r.method.isPrimary) {
    const total = await prisma.ownerPayoutMethod.count({ where: { ownerProfileId: r.method.ownerProfileId } });
    if (total > 1) return fail(409, "PRIMARY", "Set another method primary before deleting this one");
  }
  await prisma.ownerPayoutMethod.delete({ where: { id } });
  await logAudit({
    actorId: r.g.user.id,
    actorName: r.g.user.name,
    module: "M03",
    action: "delete",
    entityType: "owner_payout_method",
    entityId: id,
    summary: `Deleted payout method ••••${r.method.accountNumber.slice(-4)}`,
    before: { kind: r.method.kind, isPrimary: r.method.isPrimary },
    ip: clientIp(req)
  });
  return ok({ deleted: true });
}
