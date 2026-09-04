import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contact = await prisma.emergencyContact.findUnique({
    where: { id },
    include: { member: { include: { party: true } } }
  });
  if (!contact) return fail(404, "NOT_FOUND", "Contact not found");

  const g = await authorize("update", "M02", contact.member.homePropertyId ? { propertyId: contact.member.homePropertyId } : undefined);
  if (g.response) return g.response;

  await prisma.emergencyContact.delete({ where: { id } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "delete",
    entityType: "emergency_contact",
    entityId: id,
    summary: `Removed emergency contact ${contact.name} from ${contact.member.party.name}`,
    propertyId: contact.member.homePropertyId,
    before: contact,
    ip: clientIp(req)
  });
  return ok({ deleted: true });
}
