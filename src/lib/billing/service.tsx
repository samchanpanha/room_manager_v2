/// Invoice service (M07) — DB operations composed from the pure rent engine.
/// All money math happens in engine.ts; this layer persists, audits, emits
/// events and files PDFs. Transaction clients are threaded everywhere
/// (root-client-inside-tx deadlocks SQLite — see BUILD_LOG Phase 5).
import * as React from "react"; // classic JSX runtime (tsx/vitest) needs React in scope
import { prisma } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { logAudit } from "@/lib/audit";
import { composeInvoice, dunningStage, evalLateFee, type EngineLine } from "@/lib/billing/engine";
import { nextCycleBoundary, type ProrationBasis } from "@/lib/billing/proration";
import { canInvoiceTransition, type InvoiceStatus } from "@/lib/billing/machines";
import { storage } from "@/lib/storage";
import { env } from "@/lib/env";
import { postTransaction, reverseTransaction, liveTransactionIds } from "@/lib/ledger/service";
import { creditNoteLines, invoiceIssueLines, lateFeeLines } from "@/lib/ledger/postings";
import { getSettings } from "@/lib/settings";
import { chargeLabel } from "@/lib/utilities/service";
import { formatMilli } from "@/lib/utilities/machines";

const MAX_CATCHUP_PERIODS = 24;

export interface ActorCtx {
  id: string;
  name: string;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatPeriodLabel(start: Date, endExclusive: Date): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" };
  const s = new Intl.DateTimeFormat("en-US", opts).format(start);
  const e = new Intl.DateTimeFormat("en-US", { ...opts, day: "numeric", month: "short" }).format(new Date(endExclusive.getTime() - 86_400_000));
  return `${s} – ${e}`;
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function allocateInvoiceNumber(tx: PrismaTx, propertyCode: string, year: number, prefix = ""): Promise<string> {
  // §M28: the org-wide invoicePrefix setting prepends the property code (forward-only)
  const key = `INV:${propertyCode}:${year}`;
  await tx.numberSequence.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  const row = await tx.numberSequence.findUniqueOrThrow({ where: { key } });
  return `${prefix}${propertyCode}-${year}-${String(row.value).padStart(4, "0")}`;
}

/// Periods awaiting billing for a lease, chaining from the last invoice.
export function computePendingPeriods(
  lease: { startDate: Date; billingCycleDay: number },
  lastPeriodEnd: Date | null,
  today: Date
): Array<{ start: Date; end: Date }> {
  const out: Array<{ start: Date; end: Date }> = [];
  let start = lastPeriodEnd ?? lease.startDate;
  for (let i = 0; i < MAX_CATCHUP_PERIODS; i++) {
    if (start.getTime() > today.getTime()) break;
    const end = nextCycleBoundary(start, lease.billingCycleDay);
    out.push({ start, end });
    start = end;
  }
  return out;
}

export interface GenerationSummary {
  generated: number;
  skipped: number;
  invoices: Array<{ id: string; code: string; leaseCode: string; totalMinor: number; periodStart: string; periodEnd: string }>;
}

/// Monthly generation job (INTENT.md M07): compose + issue invoices for all
/// active leases with a pending period. Idempotent — one live invoice per
/// (lease, periodStart); re-runs only fill gaps.
export async function generateInvoices(
  actor: ActorCtx,
  propertyFilter?: string[]
): Promise<GenerationSummary> {
  const today = utcMidnight(new Date());
  const { billing } = await getSettings(); // §M28 invoice prefix
  const leases = await prisma.lease.findMany({
    where: { status: "active", ...(propertyFilter && propertyFilter.length > 0 ? { propertyId: { in: propertyFilter } } : {}) },
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      services: true
    },
    orderBy: { code: "asc" }
  });

  const taxRule = await prisma.taxRule.findFirst({ where: { isActive: true, isDefault: true } });
  const taxPercentBps = taxRule?.percentBps ?? 0;

  const summary: GenerationSummary = { generated: 0, skipped: 0, invoices: [] };

  for (const lease of leases) {
    const last = await prisma.invoice.findFirst({
      where: { leaseId: lease.id, status: { not: "void" }, isDeposit: false },
      orderBy: { periodEnd: "desc" }
    });
    const periods = computePendingPeriods(
      { startDate: lease.startDate, billingCycleDay: lease.billingCycleDay },
      last?.periodEnd ?? null,
      today
    );

    for (const period of periods) {
      const existing = await prisma.invoice.findFirst({
        where: { leaseId: lease.id, periodStart: period.start, status: { not: "void" }, isDeposit: false }
      });
      if (existing) {
        summary.skipped += 1;
        continue;
      }

      // M11/M12: pending utility charges and per-use service entries ride
      // this invoice cycle as one-time lines (§M11 charges attach to the next
      // invoice cycle automatically; §M12 per-use → one-time lines).
      const pendingCharges = await prisma.utilityCharge.findMany({
        where: { leaseId: lease.id, status: "pending" },
        include: { meter: true },
        orderBy: { createdAt: "asc" }
      });
      const pendingUsages = await prisma.serviceUsage.findMany({
        where: { leaseId: lease.id, status: "pending" },
        include: { service: true },
        orderBy: { usedAt: "asc" }
      });

      const composition = composeInvoice({
        lease: {
          rentMinor: lease.rentAmountMinor,
          billingCycleDay: lease.billingCycleDay,
          prorationBasis: (lease.prorationBasis as ProrationBasis) ?? "calendar",
          services: lease.services.map((s) => ({
            name: s.name,
            amountMinor: s.amountMinor,
            pricingModel: s.pricingModel,
            activeFrom: s.activeFrom,
            activeThrough: s.activeThrough
          }))
        },
        periodStart: period.start,
        periodEnd: period.end,
        taxPercentBps,
        discountMinor: 0,
        oneTimeLines: [
          ...pendingCharges.map((c) => ({
            kind: "utility" as const,
            name: chargeLabel(c.meter.type, c.meter.code, c.consumptionMilli, c.meter.unitLabel, c.anomaly),
            unitMinor: c.amountMinor
          })),
          ...pendingUsages.map((u) => ({
            kind: "one_time" as const,
            name: `${u.service.name} — ${formatMilli(u.qtyMilli)} ${u.unitLabel ?? "unit"}`,
            unitMinor: Math.round((u.unitPriceMinor * u.qtyMilli) / 1000)
          }))
        ],
        periodLabel: formatPeriodLabel(period.start, period.end)
      });

      const propertyCode = lease.room.floor.building.property.code;
      const dueDate = period.start.getTime() < today.getTime() ? today : period.start;

      const invoice = await prisma.$transaction(
        async (tx) => {
          const code = await allocateInvoiceNumber(tx, propertyCode, period.start.getUTCFullYear(), billing.invoicePrefix);
          const invoice = await tx.invoice.create({
            data: {
              code,
              propertyId: lease.propertyId,
              leaseId: lease.id,
              memberProfileId: lease.memberProfileId,
              status: "issued",
              periodStart: period.start,
              periodEnd: period.end,
              issuedAt: new Date(),
              dueDate,
              subtotalMinor: composition.subtotalMinor,
              discountMinor: composition.discountMinor,
              taxMinor: composition.taxMinor,
              totalMinor: composition.totalMinor,
              amountDueMinor: composition.totalMinor,
              createdById: actor.id,
              items: {
                create: composition.lines.map((l) => ({
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

          // M11/M12: attach the consumed charges/usages to this invoice
          const freeUtility = new Set(invoice.items.filter((i) => i.kind === "utility").map((i) => i.id));
          for (const charge of pendingCharges) {
            const item = invoice.items.find((i) => freeUtility.has(i.id) && i.amountMinor === charge.amountMinor);
            if (!item) continue;
            freeUtility.delete(item.id);
            await tx.utilityCharge.update({
              where: { id: charge.id },
              data: { status: "billed", invoiceId: invoice.id, invoiceItemId: item.id }
            });
          }
          const freeUsage = new Set(invoice.items.filter((i) => i.kind === "one_time").map((i) => i.id));
          for (const usage of pendingUsages) {
            const amountMinor = Math.round((usage.unitPriceMinor * usage.qtyMilli) / 1000);
            const item = invoice.items.find((i) => freeUsage.has(i.id) && i.amountMinor === amountMinor);
            if (!item) continue;
            freeUsage.delete(item.id);
            await tx.serviceUsage.update({
              where: { id: usage.id },
              data: { status: "billed", invoiceId: invoice.id, invoiceItemId: item.id }
            });
          }

          // M08: accrual posting — DR Receivable / CR revenue by kind (+ tax payable)
          await postTransaction(tx, {
            memo: `Invoice ${code} issued to ${lease.member.party.name} (${composition.isPartial ? "prorated" : "full"} period)`,
            refType: "invoice",
            refId: invoice.id,
            propertyId: lease.propertyId,
            memberId: lease.memberProfileId,
            actorId: actor.id,
            lines: invoiceIssueLines({
              totalMinor: composition.totalMinor,
              discountMinor: composition.discountMinor,
              taxMinor: composition.taxMinor,
              items: composition.lines.map((l) => ({ kind: l.kind, amountMinor: l.amountMinor }))
            })
          });
          return invoice;
        },
        { timeout: 20000, maxWait: 10000 }
      );

      await fileInvoicePdf(invoice.id).catch(() => undefined);

      await logAudit({
        actorId: actor.id,
        actorName: actor.name,
        module: "M07",
        action: "create",
        entityType: "invoice",
        entityId: invoice.id,
        summary: `Generation job issued ${invoice.code} for ${lease.code} (${lease.member.party.name}): ${composition.lines.length} line(s), total ${(composition.totalMinor / 100).toFixed(2)}`,
        propertyId: lease.propertyId,
        after: { code: invoice.code, totalMinor: composition.totalMinor, lines: composition.lines.length },
        ip: null
      });
      await emitDomainEvent(
        "invoice.issued",
        {
          invoiceId: invoice.id,
          code: invoice.code,
          leaseCode: lease.code,
          member: lease.member.party.name,
          totalMinor: composition.totalMinor,
          dueDate: dueDate.toISOString()
        },
        lease.propertyId
      );

      summary.generated += 1;
      summary.invoices.push({
        id: invoice.id,
        code: invoice.code,
        leaseCode: lease.code,
        totalMinor: composition.totalMinor,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString()
      });
    }
  }
  return summary;
}

export async function recomputeAmountsTx(tx: PrismaTx, invoiceId: string): Promise<{ totalMinor: number; dueMinor: number }> {
  const agg = await tx.invoiceItem.aggregate({ where: { invoiceId }, _sum: { amountMinor: true } });
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const subtotal = agg._sum.amountMinor ?? 0;
  const total = subtotal - invoice.discountMinor + invoice.taxMinor;
  const due = Math.max(0, total - invoice.amountPaidMinor - invoice.amountCreditedMinor);
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { subtotalMinor: subtotal, totalMinor: total, amountDueMinor: due }
  });
  return { totalMinor: total, dueMinor: due };
}

/// System-applied late fee (M06 job): once per invoice, after the grace
/// period, on any live invoice with an outstanding amount.
export async function applyLateFees(actor: ActorCtx): Promise<{ applied: number; checked: number }> {
  // §M28: an explicit M06 LateFeeRule wins; otherwise the org-wide M28
  // late-fee defaults apply (mode "none" disables late fees entirely).
  let rule = await prisma.lateFeeRule.findFirst({ where: { isActive: true } });
  if (!rule) {
    const { lateFee, billing } = await getSettings();
    if (lateFee.mode === "none") return { applied: 0, checked: 0 };
    rule = {
      id: "settings-default",
      name: `M28 org default (${lateFee.mode})`,
      isActive: true,
      graceDays: lateFee.mode === "percent" ? billing.graceDays : billing.graceDays,
      type: lateFee.mode === "percent" ? "PERCENT" : "FIXED",
      amountMinor: lateFee.mode === "flat" ? lateFee.flatMinor : null,
      percentBps: lateFee.mode === "percent" ? lateFee.monthlyPctBps : null,
      capMinor: lateFee.maxMinor > 0 ? lateFee.maxMinor : null
    };
  }
  const today = utcMidnight(new Date());
  const graceCutoff = new Date(today.getTime() - rule.graceDays * 86_400_000);

  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 }, dueDate: { lt: graceCutoff } },
    include: { items: { where: { kind: "late_fee" } } }
  });

  let applied = 0;
  for (const inv of candidates) {
    if (inv.items.length > 0) continue; // once per invoice
    const fee = evalLateFee(rule, inv.amountDueMinor);
    if (fee === null || fee <= 0) continue;
    const daysPast = Math.floor((today.getTime() - (inv.dueDate?.getTime() ?? today.getTime())) / 86_400_000);

    await prisma.$transaction(
      async (tx) => {
        await tx.invoiceItem.create({
          data: { invoiceId: inv.id, kind: "late_fee", name: `Late fee (${rule.type === "PERCENT" ? `${(rule.percentBps ?? 0) / 100}%` : "fixed"}, ${daysPast}d past due)`, qty: 1, unitMinor: fee, amountMinor: fee }
        });
        await recomputeAmountsTx(tx, inv.id); // total = Σitems − discount + tax; due grows by the fee
        await postTransaction(tx, {
          memo: `Late fee on ${inv.code} (${daysPast}d past due)`,
          refType: "late_fee",
          refId: inv.id,
          propertyId: inv.propertyId,
          memberId: inv.memberProfileId,
          actorId: actor.id,
          lines: lateFeeLines(fee, inv.code)
        });
      },
      { timeout: 20000, maxWait: 10000 }
    );
    applied += 1;
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M06",
      action: "update",
      entityType: "invoice_late_fee",
      entityId: inv.id,
      summary: `Late fee ${(fee / 100).toFixed(2)} applied to ${inv.code} (${daysPast}d past due, grace ${rule.graceDays}d)`,
      propertyId: inv.propertyId,
      after: { feeMinor: fee },
      ip: null
    });
    await emitDomainEvent("invoice.late_fee_applied", { invoiceId: inv.id, code: inv.code, feeMinor: fee }, inv.propertyId);
  }
  return { applied, checked: candidates.length };
}

/// Overdue marking + dunning ladder (+3/+7/+14 reminders). Delivery channels
/// (Telegram/email) consume the emitted events from Phase 19.
export async function runDunning(actor: ActorCtx): Promise<{ overdueMarked: number; remindersSent: number }> {
  const today = utcMidnight(new Date());
  const { billing } = await getSettings(); // §M28: graceDays + dunningDays feed the sweep
  const schedule = billing.dunningDays.length > 0 ? billing.dunningDays : [3, 7, 14];

  const open = await prisma.invoice.findMany({
    where: { status: { in: ["issued", "partial_paid", "overdue"] }, dueDate: { lt: today } }
  });

  let overdueMarked = 0;
  let remindersSent = 0;
  for (const inv of open) {
    const daysPast = Math.floor((today.getTime() - (inv.dueDate?.getTime() ?? today.getTime())) / 86_400_000);
    const updates: { status?: InvoiceStatus; dunningStage?: number } = {};
    if (inv.status !== "overdue" && daysPast > billing.graceDays && canInvoiceTransition(inv.status as InvoiceStatus, "overdue")) {
      // §M28: the invoice only becomes overdue once the configured grace period has passed
      updates.status = "overdue";
    }
    const stage = dunningStage(daysPast, schedule);
    if (stage > inv.dunningStage) updates.dunningStage = stage;

    if (Object.keys(updates).length === 0) continue;
    await prisma.invoice.update({ where: { id: inv.id }, data: updates });
    if (updates.status === "overdue") overdueMarked += 1;
    if (updates.dunningStage) {
      remindersSent += 1;
      await emitDomainEvent(
        "invoice.dunning_reminder",
        { invoiceId: inv.id, code: inv.code, stage: updates.dunningStage, daysPastDue: daysPast, schedule },
        inv.propertyId
      );
      await logAudit({
        actorId: actor.id,
        actorName: actor.name,
        module: "M07",
        action: "update",
        entityType: "invoice_dunning",
        entityId: inv.id,
        summary: `${inv.code}: ${updates.status === "overdue" ? "marked overdue; " : ""}dunning stage ${updates.dunningStage} (day ${daysPast} past due)`,
        propertyId: inv.propertyId,
        after: updates,
        ip: null
      });
    }
  }
  return { overdueMarked, remindersSent };
}

/// Draft → issued (allocates the gapless number and files the PDF).
export async function issueInvoice(invoiceId: string, actor: ActorCtx, ip?: string | null): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { property: true, member: { include: { party: true } } } });
  if (!invoice) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
  if (!canInvoiceTransition(invoice.status as InvoiceStatus, "issued")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot issue a ${invoice.status} invoice` };
  }
  const year = (invoice.issuedAt ?? invoice.periodStart ?? new Date()).getUTCFullYear();
  const { billing } = await getSettings(); // §M28 invoice prefix
  const issued = await prisma.$transaction(
    async (tx) => {
      const code = await allocateInvoiceNumber(tx, invoice.propertyId ? invoice.property.code : "GEN", year, billing.invoicePrefix);
      const dueDate = invoice.dueDate ?? new Date();
      const issued = await tx.invoice.update({
        where: { id: invoiceId },
        data: { code, status: "issued", issuedAt: new Date(), dueDate },
        include: { items: true }
      });
      await postTransaction(tx, {
        memo: `Invoice ${code} issued to ${invoice.member.party.name}`,
        refType: "invoice",
        refId: invoiceId,
        propertyId: invoice.propertyId,
        memberId: invoice.memberProfileId,
        actorId: actor.id,
        lines: invoiceIssueLines({
          totalMinor: issued.totalMinor,
          discountMinor: issued.discountMinor,
          taxMinor: issued.taxMinor,
          items: issued.items.map((i) => ({ kind: i.kind, amountMinor: i.amountMinor }))
        })
      });
      return issued;
    },
    { timeout: 20000, maxWait: 10000 }
  );
  await fileInvoicePdf(invoiceId).catch(() => undefined);
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M07",
    action: "update",
    entityType: "invoice_status",
    entityId: invoiceId,
    summary: `Invoice ${issued.code} issued (total ${(issued.totalMinor / 100).toFixed(2)}, due ${issued.dueDate?.toISOString().slice(0, 10)})`,
    propertyId: invoice.propertyId,
    before: { status: invoice.status },
    after: { status: "issued", code: issued.code },
    ip: ip ?? null
  });
  await emitDomainEvent("invoice.issued", { invoiceId, code: issued.code, member: invoice.member.party.name, totalMinor: issued.totalMinor }, invoice.propertyId);
  return { ok: true };
}

/// Void with mandatory reason (permission checked at the route: M07:void).
export async function voidInvoice(invoiceId: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
  if (!canInvoiceTransition(invoice.status as InvoiceStatus, "void")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot void a ${invoice.status} invoice` };
  }
  await prisma.$transaction(
    async (tx) => {
      const ids = await liveTransactionIds(tx, ["invoice", "late_fee"], invoiceId);
      for (const id of ids) {
        await reverseTransaction(tx, id, {
          memo: `Invoice ${invoice.code} voided: ${reason}`,
          refType: "invoice_void",
          refId: invoiceId,
          actorId: actor.id
        });
      }
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "void", voidReason: reason, voidedAt: new Date(), amountDueMinor: 0 }
      });
      // M11/M12: this invoice's utility charges / per-use entries go back to
      // pending so the next cycle re-bills them (§M11 attachment semantics).
      await tx.utilityCharge.updateMany({ where: { invoiceId }, data: { status: "pending", invoiceId: null, invoiceItemId: null } });
      await tx.serviceUsage.updateMany({ where: { invoiceId }, data: { status: "pending", invoiceId: null, invoiceItemId: null } });
    },
    { timeout: 20000, maxWait: 10000 }
  );
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M07",
    action: "void",
    entityType: "invoice",
    entityId: invoiceId,
    summary: `Invoice ${invoice.code} voided: ${reason}`,
    propertyId: invoice.propertyId,
    before: { status: invoice.status, totalMinor: invoice.totalMinor },
    after: { status: "void", reason },
    ip: ip ?? null
  });
  await emitDomainEvent("invoice.voided", { invoiceId, code: invoice.code, reason }, invoice.propertyId);
  return { ok: true };
}

/// Credit note (corrections — issued invoices are immutable otherwise).
export async function createCreditNote(
  invoiceId: string,
  amountMinor: number,
  reason: string,
  actor: ActorCtx,
  ip?: string | null
): Promise<{ ok: true; code: string; invoiceStatus: string } | { ok: false; code: string; message: string }> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
  if (!["issued", "partial_paid", "overdue"].includes(invoice.status)) {
    return { ok: false, code: "INVALID_STATUS", message: `Credit notes apply to open invoices (current: ${invoice.status})` };
  }
  if (amountMinor <= 0) return { ok: false, code: "INVALID_AMOUNT", message: "Credit amount must be positive" };
  if (amountMinor > invoice.amountDueMinor) {
    return { ok: false, code: "EXCEEDS_DUE", message: `Credit exceeds outstanding due (${(invoice.amountDueMinor / 100).toFixed(2)})` };
  }

  const noteCode = await prisma.$transaction(
    async (tx) => {
      await tx.numberSequence.upsert({ where: { key: "CREDITNOTE" }, create: { key: "CREDITNOTE", value: 1 }, update: { value: { increment: 1 } } });
      const seq = await tx.numberSequence.findUniqueOrThrow({ where: { key: "CREDITNOTE" } });
      const code = `CN-${String(seq.value).padStart(4, "0")}`;

      await tx.creditNote.create({
        data: { code, invoiceId, amountMinor, reason, createdById: actor.id }
      });

      // M08: DR revenue pro-rata of the invoice's LIVE postings (issue + any
      // late fees), CR Receivable — so a full credit reverses the invoice's
      // entire outstanding composition, fee included.
      const liveIds = await liveTransactionIds(tx, ["invoice", "late_fee"], invoiceId);
      const originals = liveIds.length
        ? await tx.ledgerTransaction.findMany({ where: { id: { in: liveIds } }, include: { entries: { include: { account: true } } } })
        : [];
      const revenue = originals.flatMap((t) =>
        t.entries.filter((e) => e.credit > 0 && e.account.code !== "2300").map((e) => ({ code: e.account.code, credit: e.credit }))
      );
      await postTransaction(tx, {
        memo: `Credit note ${code} on ${invoice.code}: ${reason}`,
        refType: "credit_note",
        refId: invoiceId,
        propertyId: invoice.propertyId,
        memberId: invoice.memberProfileId,
        actorId: actor.id,
        lines: creditNoteLines(revenue, amountMinor)
      });
      // The issued document stays immutable (§9.3): credits reduce the amount
      // due via amountCreditedMinor, they do not rewrite invoice items.
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountCreditedMinor: { increment: amountMinor } }
      });
      const { dueMinor } = await recomputeAmountsTx(tx, invoiceId);
      const invoiceAfter = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (dueMinor === 0 && canInvoiceTransition(invoiceAfter.status as InvoiceStatus, "paid")) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: "paid" } });
      }
      return code;
    },
    { timeout: 20000, maxWait: 10000 }
  );

  const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M07",
    action: "update",
    entityType: "credit_note",
    entityId: invoiceId,
    summary: `Credit note ${noteCode} (${(amountMinor / 100).toFixed(2)}) on ${invoice.code}: ${reason}${after.status === "paid" ? " — invoice settled" : ""}`,
    propertyId: invoice.propertyId,
    after: { noteCode, amountMinor, reason },
    ip: ip ?? null
  });
  await emitDomainEvent("credit_note.issued", { noteCode, invoiceId, code: invoice.code, amountMinor, reason }, invoice.propertyId);
  return { ok: true, code: noteCode, invoiceStatus: after.status };
}

/// Render + file the invoice PDF into M17 (idempotent-ish: versions on refile).
export async function fileInvoicePdf(invoiceId: string, refile = false): Promise<void> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { InvoicePdf } = await import("./invoice-pdf");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      property: true,
      member: { include: { party: true } },
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] }
    }
  });
  if (!invoice) throw new Error("Invoice not found");

  const { org: orgSettings, locale } = await getSettings(); // §M28 org identity + currency
  const orgProfile = { name: orgSettings.name, currency: locale.currency };

  // M13: print the member's scan-to-pay QR on open invoices (§M13 receipt).
  let payQrDataUrl: string | undefined;
  if (invoice.amountDueMinor > 0 && invoice.status !== "void") {
    const { memberPayQrDataUrl } = await import("@/lib/qrpay/tokens");
    payQrDataUrl = await memberPayQrDataUrl(env.APP_BASE_URL, invoice.memberProfileId).catch(() => undefined);
  }

  const buffer = await renderToBuffer(
    <InvoicePdf
      data={{
        code: invoice.code,
        status: invoice.status,
        orgName: orgProfile.name ?? "RentManager",
        currency: orgProfile.currency ?? "USD",
        memberName: invoice.member.party.name,
        memberEmail: invoice.member.party.email,
        propertyName: invoice.property.name,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        issuedAt: invoice.issuedAt ?? invoice.createdAt,
        dueDate: invoice.dueDate ?? invoice.createdAt,
        items: invoice.items.map((i) => ({ kind: i.kind, name: i.name, qty: i.qty, unitMinor: i.unitMinor, amountMinor: i.amountMinor })),
        subtotalMinor: invoice.subtotalMinor,
        discountMinor: invoice.discountMinor,
        taxMinor: invoice.taxMinor,
        totalMinor: invoice.totalMinor,
        amountDueMinor: invoice.amountDueMinor,
        payQrDataUrl
      }}
    />
  );

  const existing = await prisma.documentRegistry.findFirst({
    where: { entity: "INVOICE", entityId: invoiceId, docTypeId: "invoice" },
    orderBy: { version: "desc" }
  });
  if (!existing || refile) {
    const { randomBytes } = await import("node:crypto");
    const storageKey = randomBytes(16).toString("hex");
    await storage.put(storageKey, buffer);
    await prisma.documentRegistry.create({
      data: {
        docTypeId: "invoice",
        entity: "INVOICE",
        entityId: invoiceId,
        fileName: `invoice-${invoice.code}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
        storageKey,
        version: existing ? existing.version + 1 : 1,
        propertyId: invoice.propertyId,
        notes: "Auto-generated invoice PDF"
      }
    });
  }
}

export type { EngineLine };
