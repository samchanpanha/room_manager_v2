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
  serviceId: z.string().optional(),
  name: z.string().min(2, "Service name must be at least 2 characters").max(80, "Service name is too long"),
  amount: z.coerce.number().min(0, "Service amount must be 0 or greater").max(100_000, "Service amount is too large"),
  pricingModel: z.enum(["fixed_monthly", "per_use", "metered"]).default("fixed_monthly"),
  parkingSlotCode: z.string().optional(),
  wifiSsid: z.string().optional()
});

const createSchema = z.object({
  memberProfileId: z.string().min(1, "Please select a member"),
  roomId: z.string().min(1, "Please select a room"),
  bedId: z.string().nullable().default(null),
  startDate: z.string().min(1, "Start date is required").refine((v) => !isNaN(Date.parse(v)), "Invalid start date format"),
  endDate: z.string().nullable().optional().refine((v) => !v || !isNaN(Date.parse(v)), "Invalid end date format"),
  rentAmount: z.coerce.number().min(0, "Rent amount must be 0 or greater").max(1_000_000, "Rent amount is too large"),
  billingCycleDay: z.coerce.number().int().min(1, "Cycle day must be 1–28").max(28, "Cycle day must be 1–28").default(1),
  prorationBasis: z.enum(["calendar", "thirty_day"]).default("calendar"),
  depositTotal: z.coerce.number().min(0, "Deposit amount must be 0 or greater").max(1_000_000).default(0),
  depositInstallments: z.coerce.number().int().min(1, "Deposit installments must be at least 1").max(12).default(1),
  noticeDays: z.coerce.number().int().min(0, "Notice days must be 0 or greater").max(180).default(30),
  autoRenew: z.boolean().default(false),
  escalationPercent: z.coerce.number().min(0, "Escalation % must be 0 or greater").max(50, "Escalation % cannot exceed 50%").nullable().optional(),
  services: z.array(serviceSchema).max(20).default([])
});

/// Create a member lease (draft). Room goes to `reserved` while the draft is open.
export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, createSchema);
    if (parsed.response) return parsed.response;
    const d = parsed.data;

    const room = await prisma.room.findUnique({ where: { id: d.roomId }, include: { floor: { include: { building: true } }, beds: true } });
    if (!room) return fail(404, "NOT_FOUND", "Room not found. Please select an available room.");
    const propertyId = room.floor.building.propertyId;

    const g = await authorize("create", "M05", { propertyId });
    if (g.response) return g.response;

    const member = await prisma.memberProfile.findUnique({ where: { id: d.memberProfileId }, include: { party: true } });
    if (!member) return fail(404, "NOT_FOUND", "Member not found. Please select a valid member.");
    if (member.blacklisted) return fail(423, "BLACKLISTED", "Member is blacklisted — new leases are blocked for blacklisted members.");
    if (member.status === "moved_out") {
      return fail(422, "MEMBER_MOVED_OUT", "Member is marked as moved out — reactivate or re-register member before creating a lease.");
    }

    if (d.bedId) {
      const bed = await prisma.bed.findUnique({ where: { id: d.bedId } });
      if (!bed || bed.roomId !== room.id) return fail(400, "INVALID_BED", "Selected bed does not belong to the selected room.");
    }
    if (!isMoveInReady(room.status)) {
      return fail(422, "ROOM_NOT_AVAILABLE", `Room status "${room.status}" — move-ins need vacant, reserved, or occupied (co-living) rooms.`);
    }

    const startDate = new Date(d.startDate);
    if (isNaN(startDate.getTime())) {
      return fail(400, "INVALID_START_DATE", "Start date is invalid.");
    }
    const endDate = d.endDate ? new Date(d.endDate) : null;
    if (endDate && isNaN(endDate.getTime())) {
      return fail(400, "INVALID_END_DATE", "End date is invalid.");
    }
    if (endDate && endDate <= startDate) {
      return fail(400, "INVALID_TERM", "End date must be after the start date.");
    }
    if (d.billingCycleDay < 1 || d.billingCycleDay > 28) {
      return fail(400, "INVALID_CYCLE_DAY", "Billing cycle day must be between 1 and 28.");
    }

    // Pre-validate any parking slots or wifi accounts
    const serviceBindings: Array<{
      serviceId?: string;
      name: string;
      amountMinor: number;
      pricingModel: string;
      parkingSlotId?: string;
      wifiAccountId?: string;
    }> = [];

    const seenSlots = new Set<string>();
    const seenWifi = new Set<string>();

    for (const s of d.services) {
      let parkingSlotId: string | undefined;
      let wifiAccountId: string | undefined;
      let finalName = s.name;

      if (s.parkingSlotCode) {
        if (seenSlots.has(s.parkingSlotCode)) {
          return fail(422, "SLOT_DUPLICATE", `Parking slot ${s.parkingSlotCode} is specified more than once`);
        }
        seenSlots.add(s.parkingSlotCode);

        const slot = await prisma.parkingSlot.findUnique({ where: { code: s.parkingSlotCode } });
        if (!slot) return fail(404, "NOT_FOUND", `Parking slot ${s.parkingSlotCode} not found`);
        if (slot.status !== "free") return fail(422, "SLOT_TAKEN", `Parking slot ${slot.code} is already assigned`);
        if (slot.propertyId !== propertyId) return fail(422, "SLOT_OTHER_PROPERTY", "Parking slot belongs to another property");
        parkingSlotId = slot.id;
        if (!finalName.includes(slot.code)) {
          finalName = `${finalName} (${slot.code})`;
        }
      }
      if (s.wifiSsid) {
        if (seenWifi.has(s.wifiSsid)) {
          return fail(422, "WIFI_DUPLICATE", `WiFi account ${s.wifiSsid} is specified more than once`);
        }
        seenWifi.add(s.wifiSsid);

        const wifi = await prisma.wifiAccount.findUnique({ where: { ssid: s.wifiSsid } });
        if (!wifi) return fail(404, "NOT_FOUND", `WiFi account ${s.wifiSsid} not found`);
        if (wifi.status !== "free") return fail(422, "WIFI_TAKEN", `WiFi account ${wifi.ssid} is already assigned`);
        if (wifi.propertyId !== propertyId) return fail(422, "WIFI_OTHER_PROPERTY", "WiFi account belongs to another property");
        wifiAccountId = wifi.id;
      }

      serviceBindings.push({
        serviceId: s.serviceId,
        name: finalName,
        amountMinor: toMinor(s.amount),
        pricingModel: s.pricingModel,
        parkingSlotId,
        wifiAccountId
      });
    }

    // Generate unique lease code with sequence alignment
    const code = await nextNumber("LEASE", (n) => `LSE-${String(n).padStart(4, "0")}`);
    const lease = await prisma.$transaction(async (tx) => {
      const created = await tx.lease.create({
        data: {
          code,
          memberProfileId: member.id,
          roomId: room.id,
          bedId: d.bedId,
          propertyId,
          startDate,
          endDate,
          rentAmountMinor: toMinor(d.rentAmount),
          billingCycleDay: d.billingCycleDay,
          prorationBasis: d.prorationBasis,
          depositTotalMinor: toMinor(d.depositTotal),
          depositInstallments: d.depositInstallments,
          noticeDays: d.noticeDays,
          autoRenew: d.autoRenew,
          escalationPercent: d.escalationPercent ?? null,
          createdById: g.user.id
        }
      });

      for (const sb of serviceBindings) {
        const leaseSvc = await tx.leaseService.create({
          data: {
            leaseId: created.id,
            name: sb.name,
            amountMinor: sb.amountMinor,
            pricingModel: sb.pricingModel,
            activeFrom: startDate
          }
        });

        if (sb.serviceId) {
          await tx.serviceAssignment.create({
            data: {
              serviceId: sb.serviceId,
              leaseId: created.id,
              snapshotId: leaseSvc.id,
              startDate,
              parkingSlotId: sb.parkingSlotId ?? null,
              wifiAccountId: sb.wifiAccountId ?? null
            }
          });
        }

        if (sb.parkingSlotId) {
          await tx.parkingSlot.update({ where: { id: sb.parkingSlotId }, data: { status: "assigned" } });
        }
        if (sb.wifiAccountId) {
          await tx.wifiAccount.update({ where: { id: sb.wifiAccountId }, data: { status: "assigned" } });
        }
      }

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
  } catch (err: unknown) {
    console.error("POST /api/leases exception:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return fail(500, "SERVER_ERROR", `Failed to create lease: ${msg}`);
  }
}
