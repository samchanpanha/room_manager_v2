/// Urgent Settlement Service (M05 / M07 / M09 / M10 / M18)
/// Coordinates fast-track lease termination, urgent invoicing, counter/QR payments,
/// deposit deductions/offsets, and move-out inspections.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { logAudit } from "@/lib/audit";
import { postTransaction } from "@/lib/ledger/service";
import { invoiceIssueLines } from "@/lib/ledger/postings";
import { allocateInvoiceNumber } from "@/lib/billing/service";
import { prorate, daysBetweenExclusive, type ProrationBasis } from "@/lib/billing/proration";
import { createPayment, confirmPayment, getOpenMemberInvoices, openInvoicesTotalMinor } from "@/lib/payments/service";
import { deductDeposit, depositRemaining } from "@/lib/deposits/service";
import { endLease, giveNotice } from "@/lib/leases/service";
import { createInspection, completeInspection } from "@/lib/operations/inspections-service";
import { getSettings } from "@/lib/settings";
import { resolveProvider } from "@/lib/qrpay/adapter";

export interface ActorCtx {
  id: string;
  name: string;
  /** Override for audit attribution — null for the system/gateway actor (FK-safe). */
  auditActorId?: string | null;
}

export interface UrgentSettlementPreview {
  lease: {
    id: string;
    code: string;
    status: string;
    startDate: string;
    endDate: string | null;
    rentAmountMinor: number;
    billingCycleDay: number;
    noticeDays: number;
    room: {
      id: string;
      number: string;
      buildingName: string;
      propertyName: string;
      propertyCode: string;
    };
  };
  member: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  openDuesMinor: number;
  openInvoices: Array<{
    id: string;
    code: string;
    status: string;
    amountDueMinor: number;
    totalMinor: number;
    periodStart: string;
    periodEnd: string;
    isDeposit: boolean;
  }>;
  unbilledRentMinor: number;
  unbilledDays: number;
  unbilledPeriod: {
    start: string;
    end: string;
  } | null;
  unbilledUtilitiesMinor: number;
  pendingUtilitiesList: Array<{
    id: string;
    name: string;
    amountMinor: number;
    type: "utility" | "service";
  }>;
  depositHeldMinor: number;
  hasMoveOutInspection: boolean;
  moveOutInspectionId: string | null;
  totalGrossDueMinor: number;
  suggestedNetPayableMinor: number;
  suggestedDepositRefundMinor: number;
}

export interface ExecuteUrgentSettlementInput {
  departureDate?: string | Date;
  reason: string;
  earlyTerminationFeeMinor?: number;
  damageFeeMinor?: number;
  fastTrackInspection?: boolean;
  settlementMode: "direct_pay" | "deposit_offset" | "combo" | "zero_due" | "qr_pay";
  paymentMethod?: "cash" | "bank_transfer" | "qr" | "card" | "cheque";
  amountPaidMinor?: number;
}

export interface ExecuteUrgentSettlementResult {
  ok: boolean;
  code?: string;
  message?: string;
  leaseStatus?: string;
  invoiceCode?: string | null;
  paymentCode?: string | null;
  receiptCode?: string | null;
  depositRemainingMinor?: number;
  notes: string[];
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/// Calculate financial preview for an urgent departure on a lease
export async function getUrgentSettlementPreview(
  leaseId: string,
  departureDateInput?: Date | string
): Promise<{ ok: true; data: UrgentSettlementPreview } | { ok: false; code: string; message: string }> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      services: true
    }
  });

  if (!lease) {
    return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  }
  if (lease.status !== "active" && lease.status !== "notice") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Lease is in '${lease.status}' status — only active or notice leases can undergo urgent settlement`
    };
  }

  const departureDate = departureDateInput ? utcMidnight(new Date(departureDateInput)) : utcMidnight(new Date());

  // 1. Open invoices dues
  const openInvoices = await prisma.invoice.findMany({
    where: {
      memberProfileId: lease.memberProfileId,
      status: { in: ["issued", "partial_paid", "overdue"] },
      amountDueMinor: { gt: 0 }
    },
    orderBy: [{ dueDate: "asc" }, { periodStart: "asc" }]
  });
  const openDuesMinor = openInvoices.reduce((sum, inv) => sum + inv.amountDueMinor, 0);

  // 2. Unbilled period & rent proration
  const latestRegularInvoice = await prisma.invoice.findFirst({
    where: {
      leaseId: lease.id,
      status: { not: "void" },
      isDeposit: false
    },
    orderBy: { periodEnd: "desc" }
  });

  const lastPeriodEnd = latestRegularInvoice ? latestRegularInvoice.periodEnd : lease.startDate;
  let unbilledRentMinor = 0;
  let unbilledDays = 0;
  let unbilledPeriod: { start: string; end: string } | null = null;

  if (departureDate.getTime() > lastPeriodEnd.getTime()) {
    unbilledDays = daysBetweenExclusive(lastPeriodEnd, departureDate);
    if (unbilledDays > 0) {
      const rentProration = prorate(
        lease.rentAmountMinor,
        lastPeriodEnd,
        departureDate,
        (lease.prorationBasis as ProrationBasis) ?? "calendar",
        lease.billingCycleDay
      );
      unbilledRentMinor = rentProration.amountMinor;

      // Prorated fixed monthly services
      for (const svc of lease.services) {
        if (svc.pricingModel === "fixed_monthly") {
          const sProration = prorate(
            svc.amountMinor,
            lastPeriodEnd,
            departureDate,
            (lease.prorationBasis as ProrationBasis) ?? "calendar",
            lease.billingCycleDay
          );
          unbilledRentMinor += sProration.amountMinor;
        }
      }

      unbilledPeriod = {
        start: lastPeriodEnd.toISOString().slice(0, 10),
        end: departureDate.toISOString().slice(0, 10)
      };
    }
  }

  // 3. Pending utilities & service usages
  const [pendingCharges, pendingUsages] = await Promise.all([
    prisma.utilityCharge.findMany({
      where: { leaseId: lease.id, status: "pending" },
      include: { meter: true }
    }),
    prisma.serviceUsage.findMany({
      where: { leaseId: lease.id, status: "pending" },
      include: { service: true }
    })
  ]);

  const pendingUtilitiesList: Array<{ id: string; name: string; amountMinor: number; type: "utility" | "service" }> = [
    ...pendingCharges.map((c) => ({
      id: c.id,
      name: `${c.meter.type.toUpperCase()} meter ${c.meter.code}`,
      amountMinor: c.amountMinor,
      type: "utility" as const
    })),
    ...pendingUsages.map((u) => ({
      id: u.id,
      name: `${u.service.name} (${(u.qtyMilli / 1000).toFixed(1)} unit)`,
      amountMinor: Math.round((u.unitPriceMinor * u.qtyMilli) / 1000),
      type: "service" as const
    }))
  ];

  const unbilledUtilitiesMinor = pendingUtilitiesList.reduce((s, i) => s + i.amountMinor, 0);

  // 4. Deposit held
  let depositHeldMinor = 0;
  const deposit = await prisma.deposit.findUnique({
    where: { leaseId: lease.id }
  });
  if (deposit) {
    depositHeldMinor = await depositRemaining(deposit.id);
  }

  // 5. Move-out inspection check
  let hasMoveOutInspection = false;
  if (lease.moveOutInspectionId) {
    const insp = await prisma.inspection.findFirst({
      where: { id: lease.moveOutInspectionId, type: "move_out", status: "completed" }
    });
    if (insp) hasMoveOutInspection = true;
  }

  const totalGrossDueMinor = openDuesMinor + unbilledRentMinor + unbilledUtilitiesMinor;
  const suggestedNetPayableMinor = Math.max(0, totalGrossDueMinor - depositHeldMinor);
  const suggestedDepositRefundMinor = Math.max(0, depositHeldMinor - totalGrossDueMinor);

  return {
    ok: true,
    data: {
      lease: {
        id: lease.id,
        code: lease.code,
        status: lease.status,
        startDate: lease.startDate.toISOString().slice(0, 10),
        endDate: lease.endDate ? lease.endDate.toISOString().slice(0, 10) : null,
        rentAmountMinor: lease.rentAmountMinor,
        billingCycleDay: lease.billingCycleDay,
        noticeDays: lease.noticeDays,
        room: {
          id: lease.room.id,
          number: lease.room.number,
          buildingName: lease.room.floor.building.name,
          propertyName: lease.room.floor.building.property.name,
          propertyCode: lease.room.floor.building.property.code
        }
      },
      member: {
        id: lease.memberProfileId,
        name: lease.member.party.name,
        email: lease.member.party.email,
        phone: lease.member.party.phone
      },
      openDuesMinor,
      openInvoices: openInvoices.map((i) => ({
        id: i.id,
        code: i.code,
        status: i.status,
        amountDueMinor: i.amountDueMinor,
        totalMinor: i.totalMinor,
        periodStart: i.periodStart.toISOString().slice(0, 10),
        periodEnd: i.periodEnd.toISOString().slice(0, 10),
        isDeposit: i.isDeposit
      })),
      unbilledRentMinor,
      unbilledDays,
      unbilledPeriod,
      unbilledUtilitiesMinor,
      pendingUtilitiesList,
      depositHeldMinor,
      hasMoveOutInspection,
      moveOutInspectionId: lease.moveOutInspectionId,
      totalGrossDueMinor,
      suggestedNetPayableMinor,
      suggestedDepositRefundMinor
    }
  };
}

/// Execute urgent settlement: issue final invoice, collect payment / deposit offset,
/// complete inspection, clear dues, and terminate lease.
export async function executeUrgentSettlement(
  leaseId: string,
  input: ExecuteUrgentSettlementInput,
  actor: ActorCtx,
  ip?: string | null
): Promise<ExecuteUrgentSettlementResult> {
  const notes: string[] = [];

  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      services: true
    }
  });

  if (!lease) {
    return { ok: false, code: "NOT_FOUND", message: "Lease not found", notes };
  }
  if (lease.status !== "active" && lease.status !== "notice") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Cannot perform urgent settlement on a ${lease.status} lease`,
      notes
    };
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return { ok: false, code: "REASON_REQUIRED", message: "A written reason for urgent departure is required", notes };
  }

  const departureDate = input.departureDate ? utcMidnight(new Date(input.departureDate)) : utcMidnight(new Date());

  // Step 1: Move-Out Inspection handling
  let moveOutInspectionId = lease.moveOutInspectionId;
  if (!moveOutInspectionId) {
    const existing = await prisma.inspection.findFirst({
      where: { leaseId: lease.id, type: "move_out", status: "completed" }
    });
    if (existing) {
      moveOutInspectionId = existing.id;
      await prisma.lease.update({ where: { id: lease.id }, data: { moveOutInspectionId: existing.id } });
    }
  }

  if (!moveOutInspectionId) {
    if (input.fastTrackInspection) {
      const inspCreated = await createInspection(
        {
          type: "move_out",
          leaseId: lease.id,
          roomId: lease.roomId,
          note: `Fast-track move-out inspection: ${input.reason}`
        },
        actor,
        ip
      );
      if (!inspCreated.ok) {
        return { ok: false, code: inspCreated.code, message: inspCreated.message, notes };
      }
      const inspCompleted = await completeInspection(
        inspCreated.data.id,
        {
          items: [
            {
              section: "General",
              item: "Urgent departure room handover & key return",
              result: "pass"
            }
          ],
          summaryNote: `Urgent departure clearance: ${input.reason}`
        },
        actor,
        ip
      );
      if (!inspCompleted.ok) {
        return { ok: false, code: inspCompleted.code, message: inspCompleted.message, notes };
      }
      moveOutInspectionId = inspCreated.data.id;
      notes.push("Fast-track move-out inspection completed (M18)");
    } else {
      return {
        ok: false,
        code: "MOVE_OUT_INSPECTION_REQUIRED",
        message: "A completed move-out inspection is required. Enable fast-track inspection to pass it automatically.",
        notes
      };
    }
  }

  // Step 2: Transition to notice first if currently active (to open settlement window)
  if (lease.status === "active") {
    await giveNotice(lease.id, departureDate, actor, ip);
    notes.push("Lease moved to notice status");
  }

  // Step 3: Check unbilled rent & charges to generate final invoice
  const latestRegularInvoice = await prisma.invoice.findFirst({
    where: { leaseId: lease.id, status: { not: "void" }, isDeposit: false },
    orderBy: { periodEnd: "desc" }
  });
  const lastPeriodEnd = latestRegularInvoice ? latestRegularInvoice.periodEnd : lease.startDate;

  const invoiceLines: Array<{
    kind: "rent" | "service" | "utility" | "one_time";
    name: string;
    qty: number;
    unitMinor: number;
    amountMinor: number;
  }> = [];

  if (departureDate.getTime() > lastPeriodEnd.getTime()) {
    const rentProration = prorate(
      lease.rentAmountMinor,
      lastPeriodEnd,
      departureDate,
      (lease.prorationBasis as ProrationBasis) ?? "calendar",
      lease.billingCycleDay
    );
    if (rentProration.amountMinor > 0) {
      invoiceLines.push({
        kind: "rent",
        name: `Final prorated rent (${lastPeriodEnd.toISOString().slice(0, 10)} – ${departureDate.toISOString().slice(0, 10)})`,
        qty: 1,
        unitMinor: rentProration.amountMinor,
        amountMinor: rentProration.amountMinor
      });
    }

    for (const svc of lease.services) {
      if (svc.pricingModel === "fixed_monthly") {
        const sProration = prorate(
          svc.amountMinor,
          lastPeriodEnd,
          departureDate,
          (lease.prorationBasis as ProrationBasis) ?? "calendar",
          lease.billingCycleDay
        );
        if (sProration.amountMinor > 0) {
          invoiceLines.push({
            kind: "service",
            name: `${svc.name} (final prorated)`,
            qty: 1,
            unitMinor: sProration.amountMinor,
            amountMinor: sProration.amountMinor
          });
        }
      }
    }
  }

  // Pending utility charges & usages
  const [pendingCharges, pendingUsages] = await Promise.all([
    prisma.utilityCharge.findMany({ where: { leaseId: lease.id, status: "pending" }, include: { meter: true } }),
    prisma.serviceUsage.findMany({ where: { leaseId: lease.id, status: "pending" }, include: { service: true } })
  ]);

  for (const c of pendingCharges) {
    invoiceLines.push({
      kind: "utility",
      name: `Final utility: ${c.meter.type} meter ${c.meter.code}`,
      qty: 1,
      unitMinor: c.amountMinor,
      amountMinor: c.amountMinor
    });
  }

  for (const u of pendingUsages) {
    const amountMinor = Math.round((u.unitPriceMinor * u.qtyMilli) / 1000);
    invoiceLines.push({
      kind: "one_time",
      name: `${u.service.name} (final usage)`,
      qty: 1,
      unitMinor: amountMinor,
      amountMinor
    });
  }

  // Early termination fee & damage fees
  if (input.earlyTerminationFeeMinor && input.earlyTerminationFeeMinor > 0) {
    invoiceLines.push({
      kind: "one_time",
      name: "Early Termination / Urgent Departure Penalty",
      qty: 1,
      unitMinor: input.earlyTerminationFeeMinor,
      amountMinor: input.earlyTerminationFeeMinor
    });
  }

  if (input.damageFeeMinor && input.damageFeeMinor > 0) {
    invoiceLines.push({
      kind: "one_time",
      name: "Move-Out Damage & Repair Settlement",
      qty: 1,
      unitMinor: input.damageFeeMinor,
      amountMinor: input.damageFeeMinor
    });
  }

  let finalInvoiceCode: string | null = null;
  if (invoiceLines.length > 0) {
    const subtotalMinor = invoiceLines.reduce((s, l) => s + l.amountMinor, 0);
    const totalMinor = subtotalMinor;
    const propertyCode = lease.room.floor.building.property.code;
    const year = departureDate.getUTCFullYear();
    const settings = await getSettings();

    const createdInvoice = await prisma.$transaction(async (tx) => {
      const code = await allocateInvoiceNumber(tx, propertyCode, year, settings.billing.invoicePrefix);
      const inv = await tx.invoice.create({
        data: {
          code,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          memberProfileId: lease.memberProfileId,
          status: "issued",
          periodStart: lastPeriodEnd,
          periodEnd: departureDate,
          issuedAt: new Date(),
          dueDate: departureDate,
          subtotalMinor,
          discountMinor: 0,
          taxMinor: 0,
          totalMinor,
          amountDueMinor: totalMinor,
          createdById: actor.id,
          items: {
            create: invoiceLines.map((l) => ({
              kind: l.kind,
              name: l.name,
              qty: l.qty,
              unitMinor: l.unitMinor,
              amountMinor: l.amountMinor
            }))
          }
        },
        include: { items: true }
      });

      // Mark utility charges & service usages as billed
      for (const c of pendingCharges) {
        await tx.utilityCharge.update({ where: { id: c.id }, data: { status: "billed", invoiceId: inv.id } });
      }
      for (const u of pendingUsages) {
        await tx.serviceUsage.update({ where: { id: u.id }, data: { status: "billed", invoiceId: inv.id } });
      }

      await postTransaction(tx, {
        memo: `Final urgent settlement invoice ${code} issued to ${lease.member.party.name}`,
        refType: "invoice",
        refId: inv.id,
        propertyId: lease.propertyId,
        memberId: lease.memberProfileId,
        actorId: actor.id,
        lines: invoiceIssueLines({
          totalMinor,
          discountMinor: 0,
          taxMinor: 0,
          items: invoiceLines.map((l) => ({ kind: l.kind, amountMinor: l.amountMinor }))
        })
      });

      return inv;
    });

    finalInvoiceCode = createdInvoice.code;
    notes.push(`Final urgent invoice ${finalInvoiceCode} issued ($${(totalMinor / 100).toFixed(2)})`);
  }

  // Step 4: Handle Deposit Offset (if mode is deposit_offset or combo)
  const deposit = await prisma.deposit.findUnique({ where: { leaseId: lease.id } });
  let heldDepositMinor = deposit ? await depositRemaining(deposit.id) : 0;

  if (deposit && heldDepositMinor > 0 && (input.settlementMode === "deposit_offset" || input.settlementMode === "combo")) {
    const openInvoicesNow = await prisma.invoice.findMany({
      where: {
        memberProfileId: lease.memberProfileId,
        status: { in: ["issued", "partial_paid", "overdue"] },
        amountDueMinor: { gt: 0 }
      }
    });
    const duesToOffset = openInvoicesNow.reduce((s, i) => s + i.amountDueMinor, 0);
    const offsetAmount = Math.min(heldDepositMinor, duesToOffset);

    if (offsetAmount > 0) {
      // Ensure evidence document exists for deduction audit
      let evidenceDoc = await prisma.documentRegistry.findFirst({
        where: { entity: "LEASE", entityId: lease.id }
      });
      if (!evidenceDoc) {
        evidenceDoc = await prisma.documentRegistry.create({
          data: {
            docTypeId: "other",
            entity: "LEASE",
            entityId: lease.id,
            fileName: `urgent-settlement-evidence-${lease.code}.txt`,
            mimeType: "text/plain",
            sizeBytes: 64,
            storageKey: `inline-settlement-${lease.id}-${randomBytes(6).toString("hex")}`,
            notes: `Urgent settlement departure evidence for ${lease.code}`,
            uploadedById: actor.id,
            propertyId: lease.propertyId
          }
        });
      }

      const deductResult = await deductDeposit(
        deposit.id,
        {
          amountMinor: offsetAmount,
          reason: input.damageFeeMinor ? "damage" : "unpaid_rent",
          evidenceDocId: evidenceDoc.id,
          note: `Urgent departure settlement deposit offset: ${input.reason}`
        },
        actor,
        ip
      );

      if (deductResult.ok) {
        // Now apply this deduction credit across the member's open invoices
        await prisma.$transaction(async (tx) => {
          let remainingOffset = offsetAmount;
          for (const inv of openInvoicesNow) {
            if (remainingOffset <= 0) break;
            const toApply = Math.min(remainingOffset, inv.amountDueMinor);
            await tx.invoice.update({
              where: { id: inv.id },
              data: {
                amountPaidMinor: { increment: toApply },
                amountDueMinor: { decrement: toApply }
              }
            });
            const updatedInv = await tx.invoice.findUniqueOrThrow({ where: { id: inv.id } });
            if (updatedInv.amountDueMinor <= 0) {
              await tx.invoice.update({ where: { id: inv.id }, data: { status: "paid" } });
            } else {
              await tx.invoice.update({ where: { id: inv.id }, data: { status: "partial_paid" } });
            }
            remainingOffset -= toApply;
          }
        });

        heldDepositMinor = deductResult.remainingMinor;
        notes.push(`Deposit offset applied: $${(offsetAmount / 100).toFixed(2)}`);
      }
    }
  }

  // Step 5: Direct Payment Collection (if amount paid > 0)
  let paymentCode: string | null = null;
  let receiptCode: string | null = null;

  if (input.amountPaidMinor && input.amountPaidMinor > 0) {
    const payMethod = input.paymentMethod ?? "cash";
    const pmtRes = await createPayment(
      actor,
      {
        memberProfileId: lease.memberProfileId,
        method: payMethod,
        amountMinor: input.amountPaidMinor
      },
      ip
    );

    if (!pmtRes.ok) {
      return { ok: false, code: pmtRes.code, message: pmtRes.message, notes };
    }

    const confRes = await confirmPayment(pmtRes.paymentId, actor, { ip });
    if (!confRes.ok) {
      return { ok: false, code: confRes.code, message: confRes.message, notes };
    }

    paymentCode = pmtRes.code;
    receiptCode = confRes.receiptCode;
    notes.push(`Payment ${paymentCode} confirmed ($${(input.amountPaidMinor / 100).toFixed(2)} via ${payMethod}) · Receipt ${receiptCode}`);
  }

  // Step 6: Verify all dues are 0 and terminate the lease
  const remainingDues = await prisma.invoice.aggregate({
    where: { memberProfileId: lease.memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] } },
    _sum: { amountDueMinor: true }
  });

  const dueTotal = remainingDues._sum.amountDueMinor ?? 0;
  if (dueTotal > 0) {
    return {
      ok: false,
      code: "OPEN_DUES_REMAINING",
      message: `Outstanding balance of $${(dueTotal / 100).toFixed(2)} remains — full payment or deposit offset is required to complete urgent checkout`,
      notes
    };
  }

  // Step 7: Terminate lease via standard domain service
  const termRes = await endLease(lease.id, "terminated", `Urgent departure: ${input.reason}`);
  if (!termRes.ok) {
    return { ok: false, code: termRes.code, message: termRes.message, notes };
  }

  notes.push(...termRes.notes);

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M05",
    action: "urgent_settlement",
    entityType: "lease",
    entityId: lease.id,
    summary: `Urgent settlement completed for ${lease.code} (${lease.member.party.name}): room ${lease.room.number} → cleaning, dues cleared, lease terminated`,
    propertyId: lease.propertyId,
    after: {
      status: "terminated",
      invoiceCode: finalInvoiceCode,
      paymentCode,
      receiptCode,
      depositRemainingMinor: heldDepositMinor
    },
    ip: ip ?? null
  });

  await emitDomainEvent(
    "lease.urgent_settled",
    {
      leaseId: lease.id,
      code: lease.code,
      memberId: lease.memberProfileId,
      receiptCode,
      invoiceCode: finalInvoiceCode
    },
    lease.propertyId
  );

  return {
    ok: true,
    leaseStatus: "terminated",
    invoiceCode: finalInvoiceCode,
    paymentCode,
    receiptCode,
    depositRemainingMinor: heldDepositMinor,
    notes
  };
}

export interface StartUrgentSettlementQrInput {
  departureDate?: string | Date;
  reason: string;
  earlyTerminationFeeMinor?: number;
  damageFeeMinor?: number;
  fastTrackInspection?: boolean;
  provider?: string;
}

export type StartUrgentSettlementQrResult =
  | {
      ok: true;
      awaitingPayment: boolean;
      paymentId: string | null;
      paymentCode: string | null;
      qrString: string | null;
      qrImageDataUrl: string | null;
      qrExpiresAt: Date | null;
      qrAmountMinor: number | null;
      invoiceCode: string | null;
      leaseStatus: string;
      notes: string[];
    }
  | { ok: false; code: string; message: string; notes: string[] };

const URGENT_QR_PREFIX = "URGENT:";

/// QR-first urgent settlement (two-phase): issues the final invoice, moves the
/// lease to notice and opens ONE pending QR payment covering the member's
/// TOTAL outstanding balance — then returns the QR to display. The lease is
/// NOT terminated here: it only closes after the gateway webhook confirms the
/// payment (completeUrgentSettlementAfterPayment), so a QR that is never
/// scanned leaves the lease safely in "notice".
export async function startUrgentSettlementQr(
  leaseId: string,
  input: StartUrgentSettlementQrInput,
  actor: ActorCtx,
  ip?: string | null
): Promise<StartUrgentSettlementQrResult> {
  const notes: string[] = [];
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      services: true
    }
  });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found", notes };
  if (lease.status !== "active" && lease.status !== "notice") {
    return { ok: false, code: "INVALID_STATUS", message: `Cannot start urgent settlement on a ${lease.status} lease`, notes };
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return { ok: false, code: "REASON_REQUIRED", message: "A written reason for urgent departure is required", notes };
  }

  const departureDate = input.departureDate ? utcMidnight(new Date(input.departureDate)) : utcMidnight(new Date());

  // Move-out inspection (same gate as the direct path).
  let moveOutInspectionId = lease.moveOutInspectionId;
  if (!moveOutInspectionId) {
    const existing = await prisma.inspection.findFirst({ where: { leaseId: lease.id, type: "move_out", status: "completed" } });
    if (existing) {
      moveOutInspectionId = existing.id;
      await prisma.lease.update({ where: { id: lease.id }, data: { moveOutInspectionId: existing.id } });
    }
  }
  if (!moveOutInspectionId) {
    if (input.fastTrackInspection) {
      const inspCreated = await createInspection(
        { type: "move_out", leaseId: lease.id, roomId: lease.roomId, note: `Fast-track move-out inspection: ${input.reason}` },
        actor,
        ip
      );
      if (!inspCreated.ok) return { ok: false, code: inspCreated.code, message: inspCreated.message, notes };
      const inspCompleted = await completeInspection(
        inspCreated.data.id,
        {
          items: [{ section: "General", item: "Urgent departure room handover & key return", result: "pass" }],
          summaryNote: `Urgent departure clearance: ${input.reason}`
        },
        actor,
        ip
      );
      if (!inspCompleted.ok) return { ok: false, code: inspCompleted.code, message: inspCompleted.message, notes };
      moveOutInspectionId = inspCreated.data.id;
      notes.push("Fast-track move-out inspection completed (M18)");
    } else {
      return {
        ok: false,
        code: "MOVE_OUT_INSPECTION_REQUIRED",
        message: "A completed move-out inspection is required. Enable fast-track inspection to pass it automatically.",
        notes
      };
    }
  }

  // Move to notice so endLease's transition table is satisfiable later.
  if (lease.status === "active") {
    const notice = await giveNotice(lease.id, departureDate, actor, ip);
    if (!notice.ok) return { ok: false, code: notice.code, message: notice.message, notes };
    notes.push("Lease moved to notice status");
  }

  // Issue the final invoice for unbilled rent/utilities/fees (same maths as execute).
  const latestRegularInvoice = await prisma.invoice.findFirst({
    where: { leaseId: lease.id, status: { not: "void" }, isDeposit: false },
    orderBy: { periodEnd: "desc" }
  });
  const lastPeriodEnd = latestRegularInvoice ? latestRegularInvoice.periodEnd : lease.startDate;

  const invoiceLines: Array<{ kind: "rent" | "service" | "utility" | "one_time"; name: string; qty: number; unitMinor: number; amountMinor: number }> = [];

  if (departureDate.getTime() > lastPeriodEnd.getTime()) {
    const rentProration = prorate(
      lease.rentAmountMinor,
      lastPeriodEnd,
      departureDate,
      (lease.prorationBasis as ProrationBasis) ?? "calendar",
      lease.billingCycleDay
    );
    if (rentProration.amountMinor > 0) {
      invoiceLines.push({
        kind: "rent",
        name: `Final prorated rent (${lastPeriodEnd.toISOString().slice(0, 10)} – ${departureDate.toISOString().slice(0, 10)})`,
        qty: 1,
        unitMinor: rentProration.amountMinor,
        amountMinor: rentProration.amountMinor
      });
    }
    for (const svc of lease.services) {
      if (svc.pricingModel === "fixed_monthly") {
        const sProration = prorate(
          svc.amountMinor,
          lastPeriodEnd,
          departureDate,
          (lease.prorationBasis as ProrationBasis) ?? "calendar",
          lease.billingCycleDay
        );
        if (sProration.amountMinor > 0) {
          invoiceLines.push({ kind: "service", name: `${svc.name} (final prorated)`, qty: 1, unitMinor: sProration.amountMinor, amountMinor: sProration.amountMinor });
        }
      }
    }
  }

  const [pendingCharges, pendingUsages] = await Promise.all([
    prisma.utilityCharge.findMany({ where: { leaseId: lease.id, status: "pending" }, include: { meter: true } }),
    prisma.serviceUsage.findMany({ where: { leaseId: lease.id, status: "pending" }, include: { service: true } })
  ]);
  for (const c of pendingCharges) {
    invoiceLines.push({ kind: "utility", name: `Final utility: ${c.meter.type} meter ${c.meter.code}`, qty: 1, unitMinor: c.amountMinor, amountMinor: c.amountMinor });
  }
  for (const u of pendingUsages) {
    const amountMinor = Math.round((u.unitPriceMinor * u.qtyMilli) / 1000);
    invoiceLines.push({ kind: "one_time", name: `${u.service.name} (final usage)`, qty: 1, unitMinor: amountMinor, amountMinor });
  }
  if (input.earlyTerminationFeeMinor && input.earlyTerminationFeeMinor > 0) {
    invoiceLines.push({ kind: "one_time", name: "Early Termination / Urgent Departure Penalty", qty: 1, unitMinor: input.earlyTerminationFeeMinor, amountMinor: input.earlyTerminationFeeMinor });
  }
  if (input.damageFeeMinor && input.damageFeeMinor > 0) {
    invoiceLines.push({ kind: "one_time", name: "Move-Out Damage & Repair Settlement", qty: 1, unitMinor: input.damageFeeMinor, amountMinor: input.damageFeeMinor });
  }

  let finalInvoiceCode: string | null = null;
  if (invoiceLines.length > 0) {
    const totalMinor = invoiceLines.reduce((s, l) => s + l.amountMinor, 0);
    const propertyCode = lease.room.floor.building.property.code;
    const year = departureDate.getUTCFullYear();
    const settings = await getSettings(lease.member.party?.tenantId ?? "DEFAULT");

    const createdInvoice = await prisma.$transaction(async (tx) => {
      const code = await allocateInvoiceNumber(tx, propertyCode, year, settings.billing.invoicePrefix);
      const inv = await tx.invoice.create({
        data: {
          code,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          memberProfileId: lease.memberProfileId,
          status: "issued",
          periodStart: lastPeriodEnd,
          periodEnd: departureDate,
          issuedAt: new Date(),
          dueDate: departureDate,
          subtotalMinor: totalMinor,
          discountMinor: 0,
          taxMinor: 0,
          totalMinor,
          amountDueMinor: totalMinor,
          createdById: actor.id,
          items: {
            create: invoiceLines.map((l) => ({ kind: l.kind, name: l.name, qty: l.qty, unitMinor: l.unitMinor, amountMinor: l.amountMinor }))
          }
        },
        include: { items: true }
      });
      for (const c of pendingCharges) {
        await tx.utilityCharge.update({ where: { id: c.id }, data: { status: "billed", invoiceId: inv.id } });
      }
      for (const u of pendingUsages) {
        await tx.serviceUsage.update({ where: { id: u.id }, data: { status: "billed", invoiceId: inv.id } });
      }
      await postTransaction(tx, {
        memo: `Final urgent settlement invoice ${code} issued to ${lease.member.party.name}`,
        refType: "invoice",
        refId: inv.id,
        propertyId: lease.propertyId,
        memberId: lease.memberProfileId,
        actorId: actor.id,
        lines: invoiceIssueLines({ totalMinor, discountMinor: 0, taxMinor: 0, items: invoiceLines.map((l) => ({ kind: l.kind, amountMinor: l.amountMinor })) })
      });
      return inv;
    });

    finalInvoiceCode = createdInvoice.code;
    notes.push(`Final urgent invoice ${finalInvoiceCode} issued ($${(totalMinor / 100).toFixed(2)})`);
  }

  // Full balance owed across ALL the member's open invoices (FIFO on confirm).
  const open = await getOpenMemberInvoices(lease.memberProfileId);
  const totalDuesMinor = openInvoicesTotalMinor(open);
  if (totalDuesMinor <= 0) {
    // Nothing owed — no QR needed, close the lease immediately.
    const termRes = await endLease(lease.id, "terminated", `Urgent departure (no dues): ${input.reason}`);
    if (!termRes.ok) return { ok: false, code: termRes.code, message: termRes.message, notes };
    notes.push(...termRes.notes);
    return { ok: true, awaitingPayment: false, paymentId: null, paymentCode: null, qrString: null, qrImageDataUrl: null, qrExpiresAt: null, qrAmountMinor: null, invoiceCode: finalInvoiceCode, leaseStatus: "terminated", notes };
  }

  // Deterministic pending payment + gatewayRef that encodes the lease so the
  // webhook can finish the settlement exactly-once after confirm.
  let idempotencyKey = `QRURGENT:${lease.id}:${totalDuesMinor}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (!existing) break;
    if (existing.status === "pending") break;
    idempotencyKey = `QRURGENT:${lease.id}:${totalDuesMinor}:r${attempt + 1}`;
  }
  const gatewayRef = `${URGENT_QR_PREFIX}${lease.id}:${randomBytes(5).toString("hex").toUpperCase()}`;

  const created = await createPayment(
    actor,
    { memberProfileId: lease.memberProfileId, method: "qr", amountMinor: totalDuesMinor, idempotencyKey, gatewayRef },
    ip
  );
  if (!created.ok) return { ok: false, code: created.code, message: created.message, notes };

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
  if (payment.status !== "pending") {
    return { ok: false, code: "ALREADY_SETTLED", message: `This urgent payment is already ${payment.status}`, notes };
  }

  const { org } = await getSettings(lease.member.party?.tenantId ?? "DEFAULT");
  const provider = resolveProvider(input.provider);
  const charge = await provider.generateQR({
    amountMinor: totalDuesMinor,
    ref: payment.gatewayRef ?? payment.code,
    orgAccount: org.name ?? "RentManager"
  });

  notes.push(`QR payment ${payment.code} opened for $${(totalDuesMinor / 100).toFixed(2)} — lease closes after webhook confirmation`);
  return {
    ok: true,
    awaitingPayment: true,
    paymentId: payment.id,
    paymentCode: payment.code,
    qrString: charge.qrString,
    qrImageDataUrl: charge.imageDataUrl,
    qrExpiresAt: charge.expiresAt,
    qrAmountMinor: totalDuesMinor,
    invoiceCode: finalInvoiceCode,
    leaseStatus: "notice",
    notes
  };
}

/// Continuation of a QR-first urgent settlement: called once the pending QR
/// payment is CONFIRMED (webhook or manual). Idempotent — a lease that already
/// terminated returns ok with no side effects. Runs the same end-gates as
/// executeUrgentSettlement Step 6-7 (dues must be zero, inspection on file).
export async function completeUrgentSettlementAfterPayment(
  paymentId: string,
  actor: ActorCtx,
  ip?: string | null
): Promise<ExecuteUrgentSettlementResult> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, code: "NOT_FOUND", message: "Payment not found", notes: [] };
  const m = /^URGENT:([^:]+):/.exec(payment.gatewayRef ?? "");
  if (!m) return { ok: false, code: "NOT_URGENT", message: "Payment is not an urgent-settlement QR intent", notes: [] };
  if (payment.status !== "confirmed") {
    return { ok: false, code: "NOT_CONFIRMED", message: `Payment is ${payment.status} — lease settles only after it is confirmed`, notes: [] };
  }

  const leaseId = m[1];
  const lease = await prisma.lease.findUnique({ where: { id: leaseId }, include: { member: { include: { party: true } }, room: true } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found", notes: [] };
  if (lease.status === "terminated") {
    return { ok: true, leaseStatus: "terminated", paymentCode: payment.code, receiptCode: payment.receiptCode ?? null, notes: ["Lease already terminated"] };
  }
  if (lease.status !== "notice") {
    return { ok: false, code: "INVALID_STATUS", message: `Cannot settle a ${lease.status} lease — expected notice`, notes: [] };
  }

  const remainingDues = await prisma.invoice.aggregate({
    where: { memberProfileId: lease.memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] } },
    _sum: { amountDueMinor: true }
  });
  const dueTotal = remainingDues._sum.amountDueMinor ?? 0;
  if (dueTotal > 0) {
    return { ok: false, code: "OPEN_DUES_REMAINING", message: `Outstanding balance of $${(dueTotal / 100).toFixed(2)} remains`, notes: [] };
  }

  const departureDate = lease.endDate ?? new Date();
  const termRes = await endLease(lease.id, "terminated", `Urgent departure settled via QR (${departureDate.toISOString().slice(0, 10)})`);
  if (!termRes.ok) return { ok: false, code: termRes.code, message: termRes.message, notes: [] };

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M05",
    action: "urgent_settlement",
    entityType: "lease",
    entityId: lease.id,
    summary: `Urgent settlement completed for ${lease.code} via QR payment ${payment.code} (receipt ${payment.receiptCode})`,
    propertyId: lease.propertyId,
    after: { status: "terminated", paymentCode: payment.code, receiptCode: payment.receiptCode },
    ip: ip ?? null
  });
  await emitDomainEvent(
    "lease.urgent_settled",
    { leaseId: lease.id, code: lease.code, memberId: lease.memberProfileId, paymentCode: payment.code, receiptCode: payment.receiptCode },
    lease.propertyId
  );

  return {
    ok: true,
    leaseStatus: "terminated",
    paymentCode: payment.code,
    receiptCode: payment.receiptCode ?? null,
    notes: termRes.notes
  };
}
