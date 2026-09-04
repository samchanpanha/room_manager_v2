import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toMinor } from "@/lib/money";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  nationality: z.string().max(60).nullable().optional(),
  idNumber: z.string().max(60).nullable().optional(),
  occupation: z.string().max(80).nullable().optional(),
  monthlyIncome: z.coerce.number().min(0).max(10_000_000).nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");

  const g = await authorize("update", "M02", member.homePropertyId ? { propertyId: member.homePropertyId } : undefined);
  if (g.response) return g.response;

  const d = parsed.data;
  const before = {
    name: member.party.name,
    phone: member.party.phone,
    nationality: member.nationality,
    idNumber: member.idNumber,
    occupation: member.occupation,
    monthlyIncomeMinor: member.monthlyIncomeMinor
  };
  const [updated] = await prisma.$transaction([
    prisma.memberProfile.update({
      where: { id },
      data: {
        nationality: d.nationality,
        idNumber: d.idNumber,
        occupation: d.occupation,
        monthlyIncomeMinor: d.monthlyIncome === undefined ? undefined : d.monthlyIncome === null ? null : toMinor(d.monthlyIncome),
        notes: d.notes
      },
      include: { party: true }
    }),
    prisma.party.update({
      where: { id: member.partyId },
      data: { name: d.name, phone: d.phone }
    })
  ]);

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "update",
    entityType: "member",
    entityId: id,
    summary: `Updated member profile ${updated.party.name ?? member.party.name}`,
    propertyId: member.homePropertyId,
    before,
    after: d,
    ip: clientIp(req)
  });
  return ok({ id });
}
