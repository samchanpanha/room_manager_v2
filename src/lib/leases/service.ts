/// Lease lifecycle service — the activation/ending effects (INTENT.md M05
/// acceptance): room status flips, member status flips, first invoice
/// scheduled, deposit settlement triggered. All state changes happen in one
/// transaction and emit domain events; callers add the audit entries.
import { prisma } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { canLeaseTransition, type LeaseStatus } from "@/lib/leases/machine";
import { checkPlacement, type LeaseRef } from "@/lib/leases/rules";
import { computeNextBillingDate } from "@/lib/leases/billing";
import { ensureDepositForLease } from "@/lib/deposits/service";
import { logAudit } from "@/lib/audit";

export type LeaseEffectResult =
  | { ok: true; notes: string[] }
  | { ok: false; code: string; message: string };

/// Activate a draft lease: enforce eligibility + occupancy, flip room and
/// member status, schedule the first invoice.
export async function activateLease(leaseId: string): Promise<LeaseEffectResult> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { member: true, room: { include: { beds: true } } }
  });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  if (!canLeaseTransition(lease.status as LeaseStatus, "active")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot activate a ${lease.status} lease` };
  }

  const member = lease.member;
  if (member.blacklisted) {
    return { ok: false, code: "BLACKLISTED", message: "Member is blacklisted — new leases are blocked" };
  }
  if (member.status !== "verified" && member.status !== "active") {
    return {
      ok: false,
      code: "MEMBER_NOT_READY",
      message: `Member is ${member.status} — complete KYC and verify before move-in`
    };
  }

  const activeLeases = await prisma.lease.findMany({
    where: { roomId: lease.roomId, status: "active", id: { not: lease.id } },
    select: { id: true, bedId: true }
  });
  const placement = checkPlacement({
    roomStatus: lease.room.status,
    capacity: lease.room.capacity,
    activeLeases: activeLeases as LeaseRef[],
    requestedBedId: lease.bedId,
    existingBedIds: lease.room.beds.map((b) => b.id)
  });
  if (!placement.ok) return { ok: false, code: placement.code, message: placement.message };

  const notes: string[] = [];
  const nextBilling = computeNextBillingDate(lease.startDate, lease.billingCycleDay);

  await prisma.$transaction(
    async (tx) => {
      await tx.lease.update({
        where: { id: lease.id },
        data: { status: "active", nextBillingDate: nextBilling }
      });
    if (lease.room.status !== "occupied") {
      await tx.room.update({ where: { id: lease.roomId }, data: { status: "occupied" } });
    }
      if (member.status === "verified") {
        await tx.memberProfile.update({ where: { id: member.id }, data: { status: "active" } });
      }
    },
    { timeout: 20000, maxWait: 10000 }
  );

  await emitDomainEvent("lease.activated", { leaseId: lease.id, code: lease.code, roomId: lease.roomId, memberId: member.id }, lease.propertyId);
  await emitDomainEvent(
    "lease.first_invoice_scheduled",
    { leaseId: lease.id, code: lease.code, nextBillingDate: nextBilling.toISOString(), prorationBasis: lease.prorationBasis },
    lease.propertyId
  );
  if (member.status === "verified") {
    await emitDomainEvent("member.status_changed", { memberId: member.id, from: "verified", to: "active" }, lease.propertyId);
    notes.push("member activated");
  }
  if (lease.depositTotalMinor > 0) {
    // M10: bill the deposit as an installment invoice (liability-backed)
    const deposit = await ensureDepositForLease(lease.id, null);
    if (deposit.ok) {
      notes.push(`deposit billed via invoice ${deposit.invoiceCode ?? "(already billed)"}`);
    } else {
      notes.push(`deposit billing deferred: ${deposit.message}`);
    }
  }
  return { ok: true, notes: [`first invoice scheduled ${nextBilling.toISOString().slice(0, 10)}`, ...notes] };
}

/// Complete or terminate a lease: flip the room to cleaning when the last
/// active lease in the room ends, move the member out when they hold no other
/// active lease, trigger deposit settlement.
export async function endLease(
  leaseId: string,
  to: "completed" | "terminated",
  reason: string | null
): Promise<LeaseEffectResult> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { member: true, room: true }
  });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  if (!canLeaseTransition(lease.status as LeaseStatus, to)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot move a ${lease.status} lease to ${to}` };
  }
  if (to === "terminated" && !reason) {
    return { ok: false, code: "REASON_REQUIRED", message: "Termination requires a written reason" };
  }
  // Termination clearance (§15 v1.1, hard since Payments landed): the member
  // must have no outstanding invoice dues to end the lease.
  const openDues = await prisma.invoice.aggregate({
    where: { memberProfileId: lease.memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] } },
    _sum: { amountDueMinor: true }
  });
  if ((openDues._sum.amountDueMinor ?? 0) > 0) {
    return {
      ok: false,
      code: "OPEN_DUES",
      message: `Member still owes ${((openDues._sum.amountDueMinor ?? 0) / 100).toFixed(2)} — settle (or write off, M20) before ending the lease`
    };
  }
  // Move-out inspection gate (§15 v1.1, hard since Inspections landed): a
  // lease can only end with a completed move_out inspection on file (M18).
  const moveOut = lease.moveOutInspectionId
    ? await prisma.inspection.findFirst({ where: { id: lease.moveOutInspectionId, type: "move_out", status: "completed" } })
    : null;
  if (!moveOut) {
    return {
      ok: false,
      code: "MOVE_OUT_INSPECTION_REQUIRED",
      message: "A completed move-out inspection (M18) is required before ending the lease"
    };
  }

  const notes: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      await tx.lease.update({
        where: { id: lease.id },
        data: {
          status: to,
          terminatedAt: to === "terminated" ? new Date() : null,
          terminationReason: to === "terminated" ? reason : null,
          nextBillingDate: null
        }
      });

      // M12: end service assignments (closes billing windows, releases
      // parking slots and WiFi accounts).
      const assignments = await tx.serviceAssignment.findMany({
        where: { leaseId: lease.id, status: { in: ["active", "suspended"] } }
      });
      for (const a of assignments) {
        await tx.serviceAssignment.update({ where: { id: a.id }, data: { status: "ended", endedAt: new Date() } });
        if (a.snapshotId) {
          await tx.leaseService.update({ where: { id: a.snapshotId }, data: { activeThrough: new Date() } });
        }
        if (a.parkingSlotId) {
          await tx.parkingSlot.update({ where: { id: a.parkingSlotId }, data: { status: "free" } });
        }
        if (a.wifiAccountId) {
          await tx.wifiAccount.update({ where: { id: a.wifiAccountId }, data: { status: "free" } });
        }
      }
      if (assignments.length > 0) notes.push(`services ended: ${assignments.length}`);

      const stillActive = await tx.lease.count({
        where: { roomId: lease.roomId, status: "active", id: { not: lease.id } }
      });
      if (stillActive === 0 && lease.room.status === "occupied") {
        await tx.room.update({ where: { id: lease.roomId }, data: { status: "cleaning" } });
        notes.push("room → cleaning");
      }

      const memberActiveLeases = await tx.lease.count({
        where: { memberProfileId: lease.memberProfileId, status: "active", id: { not: lease.id } }
      });
      if (memberActiveLeases === 0 && (lease.member.status === "active" || lease.member.status === "notice")) {
        const from = lease.member.status;
        await tx.memberProfile.update({ where: { id: lease.memberProfileId }, data: { status: "moved_out" } });
        await emitDomainEvent(
          "member.status_changed",
          { memberId: lease.memberProfileId, from, to: "moved_out" },
          lease.propertyId,
          tx
        );
        notes.push("member → moved_out");
      }
    },
    { timeout: 20000, maxWait: 10000 }
  );

  await emitDomainEvent(
    to === "completed" ? "lease.completed" : "lease.terminated",
    { leaseId: lease.id, code: lease.code, reason, roomId: lease.roomId, memberId: lease.memberProfileId },
    lease.propertyId
  );
  if (lease.depositTotalMinor > 0) {
    await emitDomainEvent(
      "deposit.settlement_due",
      {
        leaseId: lease.id,
        code: lease.code,
        memberId: lease.memberProfileId,
        depositTotalMinor: lease.depositTotalMinor
      },
      lease.propertyId
    );
    notes.push("deposit settlement triggered (M10 acts from Phase 9)");
  }
  notes.push("move-out inspection gate passed (M18)");
  return { ok: true, notes };
}

/// Give notice on an active lease (§M05 machine: active → notice; the member
/// moves to `notice` when it was their only active lease). Shared by the M05
/// staff route and the M25 tenant-portal move-out request (§M25 — the portal
/// maps onto existing module logic, no duplicate business logic).
export async function giveNotice(
  leaseId: string,
  endDate: Date | null,
  actor: { id: string; name: string },
  ip?: string | null
): Promise<LeaseEffectResult> {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId }, include: { member: { include: { party: true } }, room: true } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  if (!canLeaseTransition(lease.status as LeaseStatus, "notice")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot give notice on a ${lease.status} lease` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.lease.update({
      where: { id: leaseId },
      data: {
        status: "notice",
        endDate: endDate ?? lease.endDate
      }
    });
    const otherActive = await tx.lease.count({ where: { memberProfileId: lease.memberProfileId, status: "active", id: { not: leaseId } } });
    if (otherActive === 0 && lease.member.status === "active") {
      await tx.memberProfile.update({ where: { id: lease.memberProfileId }, data: { status: "notice" } });
    }
  });

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M05",
    action: "update",
    entityType: "lease_status",
    entityId: leaseId,
    summary: `Lease ${lease.code} → notice (${lease.noticeDays}d notice; end ${endDate?.toISOString().slice(0, 10) ?? lease.endDate?.toISOString().slice(0, 10) ?? "open"})`,
    propertyId: lease.propertyId,
    before: { status: lease.status },
    after: { status: "notice" },
    ip
  });
  await emitDomainEvent("lease.notice_given", { leaseId, code: lease.code, memberId: lease.memberProfileId }, lease.propertyId);
  return { ok: true, notes: ["lease → notice"] };
}
