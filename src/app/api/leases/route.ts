import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { toMinor } from "@/lib/money";
import { nextNumber } from "@/lib/numbering";
import { isMoveInReady } from "@/lib/leases/rules";

const serviceSchema = z.object({
  name: z.string().min(2).max(80),
  amount: z.coerce.number().min(0).max(100_000),
  pricingModel: z.enum(["fixed_monthly", "per_use", "metered"]).default("fixed_monthly")
});

const createSchema = z.object({
  memberProfileId: z.string().min(1),
  roomId: z.string().min(1),
  bedId: z.string().nullable().default(null),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable().optional(),
  rentAmount: z.coerce.number().min(0).max(1_000_000),
  billingCycleDay: z.coerce.number().int().min(1).max(28).default(1),
  prorationBasis: z.enum(["calendar", "thirty_day"]).default("calendar"),
  depositTotal: z.coerce.number().min(0).max(1_000_000).default(0),
  depositInstallments: z.coerce.number().int().min(1).max(12).default(1),
  noticeDays: z.coerce.number().int().min(0).max(180).default(30),
  autoRenew: z.boolean().default(false),
  escalationPercent: z.coerce.number().int().min(0).max(50).nullable().optional(),
  services: z.array(serviceSchema).max(20).default([])
});

/// Create a member lease (draft). Room goes to `reserved` while the draft is open.
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const room = await prisma.room.findUnique({ where: { id: d.roomId }, include: { floor: { include: { building: true } }, beds: true } });
  if (!room) return fail(404, "NOT_FOUND", "Room not found");
  const propertyId = room.floor.building.propertyId;

  const g = await authorize("create", "M05", { propertyId });
  if (g.response) return g.response;

  const member = await prisma.memberProfile.findUnique({ where: { id: d.memberProfileId }, include: { party: true } });
  if (!member) return fail(404, "NOT_FOUND", "Member not found");
  if (member.blacklisted) return fail(423, "BLACKLISTED", "Member is blacklisted — new leases are blocked");

  if (d.bedId) {
    const bed = await prisma.bed.findUnique({ where: { id: d.bedId } });
    if (!bed || bed.roomId !== room.id) return fail(400, "INVALID_BED", "Bed does not belong to the selected room");
  }
  if (!isMoveInReady(room.status)) {
    return fail(422, "ROOM_NOT_AVAILABLE", `Room status "${room.status}" — move-ins need vacant, reserved or occupied (co-living) rooms`);
  }
  if (d.endDate && new Date(d.endDate) <= new Date(d.startDate)) {
    return fail(400, "INVALID_TERM", "End date must be after the start date");
  }
  if (d.billingCycleDay < 1 || d.billingCycleDay > 28) {
    return fail(400, "INVALID_CYCLE_DAY", "Billing cycle day must be 1–28");
  }

  const code = await nextNumber("LEASE", (n) => `LSE-${String(n).padStart(4, "0")}`);
  const lease = await prisma.$transaction(async (tx) => {
    const created = await tx.lease.create({
      data: {
        code,
        memberProfileId: member.id,
        roomId: room.id,
        bedId: d.bedId,
        propertyId,
        startDate: new Date(d.startDate),
        endDate: d.endDate ? new Date(d.endDate) : null,
        rentAmountMinor: toMinor(d.rentAmount),
        billingCycleDay: d.billingCycleDay,
        prorationBasis: d.prorationBasis,
        depositTotalMinor: toMinor(d.depositTotal),
        depositInstallments: d.depositInstallments,
        noticeDays: d.noticeDays,
        autoRenew: d.autoRenew,
        escalationPercent: d.escalationPercent ?? null,
        createdById: g.user.id,
        services: { create: d.services.map((s) => ({ name: s.name, amountMinor: toMinor(s.amount), pricingModel: s.pricingModel })) }
      },
      include: { services: true }
    });
    // Pipeline effect: vacant room → reserved while the draft is open.
    if (room.status === "vacant") {
      await tx.room.update({ where: { id: room.id }, data: { status: "reserved" } });
    }
    return created;
  });

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "create",
    entityType: "lease",
    entityId: lease.id,
    summary: `Draft lease ${lease.code}: ${member.party.name} → room ${room.number}${d.bedId ? " (bed)" : ""} from ${d.startDate.slice(0, 10)}, rent ${(toMinor(d.rentAmount) / 100).toFixed(2)}/mo, ${d.services.length} service(s)`,
    propertyId,
    after: { code: lease.code, status: lease.status, rentAmountMinor: lease.rentAmountMinor },
    ip: clientIp(req)
  });
  await emitDomainEvent("lease.created", { leaseId: lease.id, code: lease.code, memberId: member.id, roomId: room.id }, propertyId);
  if (room.status === "vacant") {
    await emitDomainEvent("room.status_changed", { roomId: room.id, from: "vacant", to: "reserved" }, propertyId);
  }
  return ok({ id: lease.id, code: lease.code }, 201);
}
