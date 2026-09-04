import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { nextNumber } from "@/lib/numbering";
import { toMinor } from "@/lib/money";

const createSchema = z.object({
  ownerProfileId: z.string().min(1),
  buildingId: z.string().min(1),
  model: z.enum(["FIXED_RENT", "REVENUE_SHARE"]),
  sharePercent: z.coerce.number().int().min(1).max(100).nullable().optional(),
  fixedRent: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  managementFeePercent: z.coerce.number().int().min(0).max(50).default(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable().optional(),
  payoutCycleDay: z.coerce.number().int().min(1).max(28).default(1),
  notes: z.string().max(500).optional()
});

/// Create an owner contract (draft) — M05 owner contracts.
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const building = await prisma.building.findUnique({ where: { id: d.buildingId }, include: { property: true, owner: { include: { party: true } } } });
  if (!building) return fail(404, "NOT_FOUND", "Building not found");

  const g = await authorize("create", "M05", { propertyId: building.propertyId });
  if (g.response) return g.response;

  const owner = await prisma.ownerProfile.findUnique({ where: { id: d.ownerProfileId }, include: { party: true } });
  if (!owner) return fail(404, "NOT_FOUND", "Owner not found");

  if (d.model === "REVENUE_SHARE" && !d.sharePercent) return fail(400, "SHARE_REQUIRED", "Revenue-share contracts need a share percentage");
  if (d.model === "FIXED_RENT" && (d.fixedRent === undefined || d.fixedRent === null)) {
    return fail(400, "RENT_REQUIRED", "Fixed-rent contracts need a monthly master rent");
  }
  const activeContract = await prisma.ownerContract.findFirst({ where: { buildingId: d.buildingId, status: { in: ["draft", "active"] } } });
  if (activeContract) {
    return fail(409, "CONTRACT_EXISTS", `${building.name} already has a ${activeContract.status} contract (${activeContract.code})`);
  }
  if (building.ownerId && building.ownerId !== owner.id) {
    return fail(409, "BUILDING_OWNED", `${building.name} belongs to ${building.owner?.party.name} — unassign it first`);
  }
  if (d.endDate && new Date(d.endDate) <= new Date(d.startDate)) {
    return fail(400, "INVALID_TERM", "End date must be after the start date");
  }

  const code = await nextNumber("OWC", (n) => `OWC-${String(n).padStart(4, "0")}`);
  const contract = await prisma.ownerContract.create({
    data: {
      code,
      ownerProfileId: owner.id,
      buildingId: building.id,
      model: d.model,
      sharePercent: d.sharePercent ?? null,
      fixedRentMinor: d.fixedRent === undefined || d.fixedRent === null ? null : toMinor(d.fixedRent),
      managementFeePercent: d.managementFeePercent,
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
      payoutCycleDay: d.payoutCycleDay,
      notes: d.notes
    }
  });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "create",
    entityType: "owner_contract",
    entityId: contract.id,
    summary: `Draft owner contract ${contract.code}: ${owner.party.name} ↔ ${building.property.code}/${building.name} (${d.model}${d.sharePercent ? ` ${d.sharePercent}%` : d.fixedRent !== undefined && d.fixedRent !== null ? ` @ ${(d.fixedRent).toFixed(2)}/mo` : ""})`,
    propertyId: building.propertyId,
    after: { code, model: d.model },
    ip: clientIp(req)
  });
  return ok({ id: contract.id, code }, 201);
}
