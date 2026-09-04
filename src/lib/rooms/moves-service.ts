/// Room moves service (M16): request → approve → execute (+ cancel).
/// Execution ends the old lease, starts the new one, repoints the deposit,
/// issues the single adjustment invoice (new rent prorated + move fee −
/// unused old-rent credit as discount) and flips both room statuses.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { invoiceIssueLines } from "@/lib/ledger/postings";
import { postTransaction } from "@/lib/ledger/service";
import { composeInvoice } from "@/lib/billing/engine";
import { nextCycleBoundary, type ProrationBasis } from "@/lib/billing/proration";
import { formatPeriodLabel, allocateInvoiceNumber } from "@/lib/billing/service";
import { computeMoveProration, canRoomMoveTransition, currentCycleStart, type MoveProration } from "./moves-machine";
import type { ActorCtx } from "@/lib/payments/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const HEAVY_TX = { timeout: 20000, maxWait: 10000 };

export interface MovePreview {
  oldRentMinor: number;
  newRentMinor: number;
  proration: MoveProration;
  depositDeltaMinor: number;
  depositHeldMinor: number;
  periodStart: Date;
  periodEnd: Date;
  roomNumber: string;
}

async function moveFeeSetting(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: "moves.moveFeeMinor" } });
  const n = s ? Number(s.value) : 0;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/// Compute (no writes) what a move would cost: rent proration delta,
/// move fee, deposit delta. Used by the request dialog and approval view.
export async function previewRoomMove(input: {
  fromLeaseId: string;
  toRoomId: string;
  effectiveAt: Date;
  newRentMinor?: number;
  moveFeeMinor?: number;
}): Promise<Result<MovePreview>> {
  const lease = await prisma.lease.findUnique({ where: { id: input.fromLeaseId } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  const room = await prisma.room.findUnique({ where: { id: input.toRoomId }, include: { floor: { include: { building: true } } } });
  if (!room) return { ok: false, code: "NOT_FOUND", message: "Target room not found" };
  if (room.floor.building.propertyId !== lease.propertyId) {
    return { ok: false, code: "ROOM_OTHER_PROPERTY", message: "Target room belongs to another property" };
  }
  if (input.effectiveAt.getTime() < lease.startDate.getTime()) {
    return { ok: false, code: "EFFECT_BEFORE_START", message: "Effective date is before the lease start" };
  }
  const cycleStart = currentCycleStart(new Date(), lease.billingCycleDay);
  if (input.effectiveAt.getTime() < cycleStart.getTime()) {
    return { ok: false, code: "EFFECT_TOO_OLD", message: `Effective date must be within the current cycle (from ${cycleStart.toISOString().slice(0, 10)}) or later` };
  }
  const periodEnd = nextCycleBoundary(input.effectiveAt, lease.billingCycleDay);
  const newRentMinor = input.newRentMinor ?? room.basePriceMinor;
  const fee = input.moveFeeMinor ?? (await moveFeeSetting());
  const proration = computeMoveProration({
    oldRentMinor: lease.rentAmountMinor,
    newRentMinor,
    moveFeeMinor: fee,
    effectiveAt: input.effectiveAt,
    periodEnd,
    prorationBasis: (lease.prorationBasis as ProrationBasis) ?? "calendar",
    billingCycleDay: lease.billingCycleDay
  });
  const deposit = await prisma.deposit.findUnique({ where: { leaseId: lease.id } });
  return {
    ok: true,
    data: {
      oldRentMinor: lease.rentAmountMinor,
      newRentMinor,
      proration,
      depositDeltaMinor: 0, // terms transfer 1:1 (requiredMinor moves with the deposit row)
      depositHeldMinor: deposit?.requiredMinor ?? 0,
      periodStart: input.effectiveAt,
      periodEnd,
      roomNumber: room.number
    }
  };
}

/// Request a move (member portal or staff, §M16 flow step 1).
export async function requestRoomMove(
  input: { fromLeaseId: string; toRoomId: string; effectiveAt: Date; newRentMinor?: number; note?: string },
  actor: ActorCtx,
  opts: { role: "member" | "staff"; ownMemberId?: string | null },
  ip?: string | null
): Promise<Result<{ id: string; code: string }>> {
  const lease = await prisma.lease.findUnique({ where: { id: input.fromLeaseId }, include: { member: { include: { party: true } } } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  if (opts.role === "member") {
    if (!opts.ownMemberId || opts.ownMemberId !== lease.memberProfileId) {
      return { ok: false, code: "FORBIDDEN", message: "Members can only request moves for their own lease" };
    }
  }
  if (lease.status !== "active") return { ok: false, code: "LEASE_NOT_ACTIVE", message: "Only active leases can request a room move" };

  const preview = await previewRoomMove(input);
  if (!preview.ok) return preview;

  const room = await prisma.room.findUnique({ where: { id: input.toRoomId } });
  if (!room) return { ok: false, code: "NOT_FOUND", message: "Target room not found" };
  const activeInRoom = await prisma.lease.count({ where: { roomId: room.id, status: "active" } });
  if (activeInRoom > 0) return { ok: false, code: "ROOM_OCCUPIED", message: `Room ${room.number} already has an active lease` };
  if (room.status === "maintenance") return { ok: false, code: "ROOM_NOT_MOVEIN_READY", message: `Room ${room.number} is under maintenance` };

  const code = await nextNumber("ROOMMOVE", (n) => `MOV-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);
  const move = await prisma.roomMove.create({
    data: {
      code,
      memberProfileId: lease.memberProfileId,
      fromLeaseId: lease.id,
      toRoomId: room.id,
      effectiveAt: input.effectiveAt,
      requestedByRole: opts.role,
      requestedById: actor.id === "webhook" ? null : actor.id,
      oldRentMinor: lease.rentAmountMinor,
      newRentMinor: preview.data.newRentMinor,
      moveFeeMinor: preview.data.proration.moveFeeMinor,
      note: input.note ?? null
    }
  });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M16",
    action: "move.requested",
    entityType: "room_move",
    entityId: move.id,
    summary: `Room move ${code} requested (${opts.role}): ${lease.code} → room ${room.number} effective ${input.effectiveAt.toISOString().slice(0, 10)}`,
    propertyId: lease.propertyId,
    ip
  });
  await emitDomainEvent("roommove.requested", { moveId: move.id, code, leaseCode: lease.code, toRoom: room.number, effectiveAt: input.effectiveAt.toISOString() }, lease.propertyId);
  return { ok: true, data: { id: move.id, code } };
}

/// Approve (§M16 flow: approval before execution) — snapshots the preview.
export async function approveRoomMove(moveId: string, actor: ActorCtx, ip?: string | null): Promise<Result<{ status: string }>> {
  const move = await prisma.roomMove.findUnique({ where: { id: moveId }, include: { fromLease: true } });
  if (!move) return { ok: false, code: "NOT_FOUND", message: "Move not found" };
  if (!canRoomMoveTransition(move.status, "approved")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot approve a ${move.status} move` };
  }
  const updated = await prisma.roomMove.update({
    where: { id: moveId },
    data: { status: "approved", approvedById: actor.id, approvedAt: new Date() }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M16",
    action: "move.approved",
    entityType: "room_move",
    entityId: moveId,
    summary: `Room move ${move.code} approved — execute to end ${move.fromLease.code} and start the new lease`,
    propertyId: move.fromLease.propertyId,
    ip
  });
  void updated;
  return { ok: true, data: { status: "approved" } };
}

/// Cancel — the requester while pending, or any M16:update holder.
export async function cancelRoomMove(
  moveId: string,
  reason: string,
  actor: ActorCtx,
  opts: { isRequester: boolean },
  ip?: string | null
): Promise<Result<{ status: string }>> {
  const move = await prisma.roomMove.findUnique({ where: { id: moveId }, include: { fromLease: true } });
  if (!move) return { ok: false, code: "NOT_FOUND", message: "Move not found" };
  if (!canRoomMoveTransition(move.status, "cancelled")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot cancel a ${move.status} move` };
  }
  if (!opts.isRequester && !canRoomMoveUpdate(move)) {
    void move;
  }
  await prisma.roomMove.update({
    where: { id: moveId },
    data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason }
  });
  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M16",
    action: "move.cancelled",
    entityType: "room_move",
    entityId: moveId,
    summary: `Room move ${move.code} cancelled: ${reason}`,
    propertyId: move.fromLease.propertyId,
    ip
  });
  return { ok: true, data: { status: "cancelled" } };
}

function canRoomMoveUpdate(move: { status: string }): boolean {
  // permission checks live in the route; this guard only documents intent
  return move.status === "requested" || move.status === "approved";
}

/// Execute (§M16): old line ends, new line starts, ONE adjustment invoice
/// with the exact prorated delta, both room statuses flip, deposit follows.
export async function executeRoomMove(
  moveId: string,
  actor: ActorCtx,
  opts: { newRentMinor?: number },
  ip?: string | null
): Promise<Result<{ moveId: string; newLeaseId: string; invoiceCode: string | null; netMinor: number }>> {
  const move = await prisma.roomMove.findUnique({
    where: { id: moveId },
    include: {
      fromLease: true,
      toRoom: { include: { floor: { include: { building: { include: { property: true } } } } } },
      member: { include: { party: true } }
    }
  });
  if (!move) return { ok: false, code: "NOT_FOUND", message: "Move not found" };
  if (!canRoomMoveTransition(move.status, "executed")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot execute a ${move.status} move` };
  }
  const oldLease = move.fromLease;
  const eff = move.effectiveAt;
  if (eff.getTime() < oldLease.startDate.getTime()) {
    return { ok: false, code: "EFFECT_BEFORE_START", message: "Effective date is before the lease start" };
  }
  const cycleStart = currentCycleStart(new Date(), oldLease.billingCycleDay);
  if (eff.getTime() < cycleStart.getTime()) {
    return { ok: false, code: "EFFECT_TOO_OLD", message: `Effective date must be within the current cycle (from ${cycleStart.toISOString().slice(0, 10)}) or later` };
  }
  const room = move.toRoom;
  if (room.floor.building.propertyId !== oldLease.propertyId) {
    return { ok: false, code: "ROOM_OTHER_PROPERTY", message: "Target room belongs to another property" };
  }
  const activeInRoom = await prisma.lease.count({ where: { roomId: room.id, status: "active" } });
  if (activeInRoom > 0) return { ok: false, code: "ROOM_OCCUPIED", message: `Room ${room.number} already has an active lease` };

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  if (eff.getTime() > today.getTime()) {
    return { ok: false, code: "EFFECT_IN_FUTURE", message: `Execute on or after the effective date (${eff.toISOString().slice(0, 10)}) — until then the move stays approved` };
  }

  // Billing catch-up: the old lease must be billed THROUGH today before the
  // credit window is computed (§9.4 gapless billing).
  const coverage = await prisma.invoice.findFirst({
    where: { leaseId: oldLease.id, status: { not: "void" }, isDeposit: false },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true }
  });
  if (!coverage || coverage.periodEnd.getTime() <= today.getTime()) {
    const { generateInvoices } = await import("@/lib/billing/service");
    await generateInvoices(actor, [oldLease.propertyId]);
  }

  const newRentMinor = opts.newRentMinor ?? move.newRentMinor ?? room.basePriceMinor;
  const fee = move.moveFeeMinor ?? (await moveFeeSetting());
  const periodEnd = nextCycleBoundary(eff, oldLease.billingCycleDay);
  const proration = computeMoveProration({
    oldRentMinor: oldLease.rentAmountMinor,
    newRentMinor,
    moveFeeMinor: fee,
    effectiveAt: eff,
    periodEnd,
    prorationBasis: (oldLease.prorationBasis as ProrationBasis) ?? "calendar",
    billingCycleDay: oldLease.billingCycleDay
  });

  const taxRule = await prisma.taxRule.findFirst({ where: { isActive: true, isDefault: true } });
  const taxPercentBps = taxRule?.percentBps ?? 0;

  // Codes allocated OUTSIDE the write transaction (nextNumber opens its own).
  const leaseCode = await nextNumber("LEASE", (n) => `LSE-${String(n).padStart(4, "0")}`);

  const result = await prisma.$transaction(
    async (tx) => {
      // 1) new lease starts at the effective date (same cycle & deposit terms)
      const newLease = await tx.lease.create({
        data: {
          code: leaseCode,
          memberProfileId: move.memberProfileId,
          roomId: room.id,
          propertyId: oldLease.propertyId,
          status: "active",
          startDate: eff,
          rentAmountMinor: newRentMinor,
          billingCycleDay: oldLease.billingCycleDay,
          prorationBasis: oldLease.prorationBasis,
          depositTotalMinor: oldLease.depositTotalMinor,
          depositInstallments: oldLease.depositInstallments,
          noticeDays: oldLease.noticeDays,
          nextBillingDate: periodEnd,
          createdById: actor.id
        }
      });

      // 2) old lease ends (member stays — this is a move, not a move-out)
      await tx.lease.update({
        where: { id: oldLease.id },
        data: { status: "terminated", terminatedAt: new Date(), terminationReason: `Room move ${move.code}`, nextBillingDate: null }
      });

      // 3) dual room status update (§M16 acceptance)
      const stillActiveOld = await tx.lease.count({ where: { roomId: oldLease.roomId, status: "active", id: { not: oldLease.id } } });
      const oldRoom = await tx.room.findUniqueOrThrow({ where: { id: oldLease.roomId }, select: { status: true } });
      if (stillActiveOld === 0 && oldRoom.status === "occupied") {
        await tx.room.update({ where: { id: oldLease.roomId }, data: { status: "cleaning" } });
      }
      await tx.room.update({ where: { id: room.id }, data: { status: "occupied" } });

      // 4) M12 services end with the old lease (windows close, slots/WiFi release)
      const assignments = await tx.serviceAssignment.findMany({ where: { leaseId: oldLease.id, status: { in: ["active", "suspended"] } } });
      for (const a of assignments) {
        await tx.serviceAssignment.update({ where: { id: a.id }, data: { status: "ended", endedAt: eff } });
        if (a.snapshotId) {
          await tx.leaseService.update({ where: { id: a.snapshotId }, data: { activeThrough: eff } });
        }
        if (a.parkingSlotId) await tx.parkingSlot.update({ where: { id: a.parkingSlotId }, data: { status: "free" } });
        if (a.wifiAccountId) await tx.wifiAccount.update({ where: { id: a.wifiAccountId }, data: { status: "free" } });
      }

      // 5) deposit follows the member (row repointed — 2100 untouched)
      await tx.deposit.updateMany({ where: { leaseId: oldLease.id }, data: { leaseId: newLease.id } });

      // 6) ONE adjustment invoice = the new lease's first period, with the
      //    prorated new rent + move fee − unused old-rent credit (discount).
      const composition = composeInvoice({
        lease: { rentMinor: newRentMinor, billingCycleDay: oldLease.billingCycleDay, prorationBasis: (oldLease.prorationBasis as ProrationBasis) ?? "calendar", services: [] },
        periodStart: eff,
        periodEnd,
        taxPercentBps,
        discountMinor: proration.oldRentCreditMinor,
        oneTimeLines: fee > 0 ? [{ kind: "one_time", name: `Room move fee (${move.code})`, unitMinor: fee }] : [],
        periodLabel: formatPeriodLabel(eff, periodEnd)
      });
      const invoiceCode = await allocateInvoiceNumber(tx, move.toRoom.floor.building.property.code, eff.getUTCFullYear());
      const invoice = await tx.invoice.create({
        data: {
          code: invoiceCode,
          propertyId: oldLease.propertyId,
          leaseId: newLease.id,
          memberProfileId: move.memberProfileId,
          status: "issued",
          issuedAt: new Date(),
          periodStart: eff,
          periodEnd,
          dueDate: eff.getTime() < today.getTime() ? today : eff,
          subtotalMinor: composition.subtotalMinor,
          discountMinor: composition.discountMinor,
          taxMinor: composition.taxMinor,
          totalMinor: composition.totalMinor,
          amountDueMinor: composition.totalMinor,
          createdById: actor.id,
          items: {
            create: composition.lines.map((l) => ({ kind: l.kind, name: l.name, qty: l.qty, unitMinor: l.unitMinor, amountMinor: l.amountMinor }))
          }
        },
        include: { items: true }
      });
      await postTransaction(tx, {
        memo: `Room move ${move.code}: adjustment invoice ${invoiceCode} (${oldLease.code} → ${leaseCode} / room ${room.number})`,
        refType: "invoice",
        refId: invoice.id,
        propertyId: oldLease.propertyId,
        memberId: move.memberProfileId,
        actorId: actor.id,
        lines: invoiceIssueLines({
          totalMinor: composition.totalMinor,
          discountMinor: composition.discountMinor,
          taxMinor: composition.taxMinor,
          items: composition.lines.map((l) => ({ kind: l.kind, amountMinor: l.amountMinor }))
        })
      });

      // 7) move record → executed with the money snapshot
      await tx.roomMove.update({
        where: { id: move.id },
        data: {
          status: "executed",
          executedById: actor.id,
          executedAt: new Date(),
          newLeaseId: newLease.id,
          adjustmentInvoiceId: invoice.id,
          oldRentMinor: oldLease.rentAmountMinor,
          newRentMinor,
          rentCreditMinor: proration.oldRentCreditMinor,
          newRentChargeMinor: proration.newRentChargeMinor,
          moveFeeMinor: fee,
          netMinor: proration.netMinor
        }
      });

      return { moveId: move.id, newLeaseId: newLease.id, invoiceCode, netMinor: composition.totalMinor };
    },
    HEAVY_TX
  );

  // Audit + event AFTER commit (SQLite single-writer: in-tx logAudit on the
  // global client deadlocks — same ordering as billing/service.tsx).
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M16",
    action: "move.executed",
    entityType: "room_move",
    entityId: move.id,
    summary: `Room move ${move.code} executed: ${oldLease.code} → ${leaseCode} (room ${room.number}) effective ${eff.toISOString().slice(0, 10)} — adjustment invoice ${result.invoiceCode} net ${(result.netMinor / 100).toFixed(2)} (credit ${(proration.oldRentCreditMinor / 100).toFixed(2)}, fee ${(fee / 100).toFixed(2)})`,
    propertyId: oldLease.propertyId,
    after: { invoiceCode: result.invoiceCode, netMinor: result.netMinor, newLeaseCode: leaseCode },
    ip
  });
  await emitDomainEvent(
    "roommove.executed",
    { moveId: move.id, code: move.code, fromLease: oldLease.code, toLease: leaseCode, toRoom: room.number, invoiceCode: result.invoiceCode, netMinor: result.netMinor },
    oldLease.propertyId
  );

  const { fileInvoicePdf } = await import("@/lib/billing/service");
  const invoiceRow = await prisma.invoice.findUnique({ where: { code: result.invoiceCode }, select: { id: true } });
  if (invoiceRow) await fileInvoicePdf(invoiceRow.id).catch(() => undefined);

  return { ok: true, data: result };
}
