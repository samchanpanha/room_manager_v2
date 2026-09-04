import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  relationship: z.string().min(2).max(60),
  phone: z.string().min(5).max(40),
  email: z.string().email().optional(),
  isPrimary: z.boolean().default(false)
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");

  const g = await authorize("update", "M02", member.homePropertyId ? { propertyId: member.homePropertyId } : undefined);
  if (g.response) return g.response;

  const contact = await prisma.emergencyContact.create({
    data: { memberProfileId: id, ...parsed.data }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "create",
    entityType: "emergency_contact",
    entityId: contact.id,
    summary: `Added emergency contact ${contact.name} (${contact.relationship}) for ${member.party.name}`,
    propertyId: member.homePropertyId,
    after: contact,
    ip: clientIp(req)
  });
  return ok({ id: contact.id }, 201);
}
