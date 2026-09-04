import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { assertTransitionAllowed, isMemberStatus, transitionRequirement } from "@/lib/members/lifecycle";
import { kycChecklist } from "@/lib/members/kyc";

const bodySchema = z.object({ to: z.string().min(1) });

/// Lifecycle transition with machine + requirement enforcement (M02):
/// prospect→verified needs complete KYC; verified→active needs an active lease (M05).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;
  const { to } = parsed.data;
  if (!isMemberStatus(to)) return fail(400, "INVALID_STATUS", `Unknown member status: ${to}`);

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");

  const g = await authorize("update", "M02", member.homePropertyId ? { propertyId: member.homePropertyId } : undefined);
  if (g.response) return g.response;

  if (!isMemberStatus(member.status)) return fail(500, "CORRUPT_STATE", "Member has invalid status");
  const gate = assertTransitionAllowed(member.status, to, member.blacklisted);
  if (!gate.ok) return fail(gate.code === "BLACKLISTED" ? 423 : 422, gate.code, gate.message);

  const requirement = transitionRequirement(member.status, to);
  if (requirement.kind === "kyc_complete") {
    const required = await prisma.docType.findMany({ where: { kycRequired: true } });
    const docs = await prisma.documentRegistry.findMany({
      where: { entity: "MEMBER", entityId: id },
      select: { docTypeId: true, expiryDate: true }
    });
    const checklist = kycChecklist(required.map((r) => r.id), docs);
    if (!checklist.complete) {
      return fail(422, "KYC_INCOMPLETE", `KYC checklist incomplete — missing: ${checklist.missing.join(", ") || "—"}; expired: ${checklist.expired.join(", ") || "—"}`);
    }
  }
  if (requirement.kind === "active_lease") {
    const activeLeases = await prisma.lease.count({ where: { memberProfileId: id, status: "active" } });
    if (activeLeases === 0) {
      return fail(422, "LEASE_REQUIRED", "Activating a member requires an active lease — create and activate one first (M05)");
    }
  }

  const updated = await prisma.memberProfile.update({ where: { id }, data: { status: to } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M02",
    action: "update",
    entityType: "member_status",
    entityId: id,
    summary: `Member ${member.party.name}: ${member.status} → ${to}`,
    propertyId: member.homePropertyId,
    before: { status: member.status },
    after: { status: to },
    ip: clientIp(req)
  });
  await emitDomainEvent("member.status_changed", { memberId: id, from: member.status, to }, member.homePropertyId);
  return ok(updated);
}
