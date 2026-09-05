/// Payments service (M09) — collections against invoices, receipts, refunds.
/// Money moves only through the M08 ledger: confirm posts DR cash/bank /
/// CR receivable; refunds post the inverse on the unallocated credit.
/// All writes ride the caller's transaction (SQLite deadlock rule) and are
/// audited + emitted. Rows are append-only (DB triggers block deletes).
import * as React from "react"; // classic JSX runtime (tsx/vitest)
import { prisma } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { logAudit } from "@/lib/audit";
import { postTransaction } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";
import { storage } from "@/lib/storage";
import { canPaymentTransition, isPaymentMethod, settlementAccountCode, type PaymentStatus } from "./machines";
import { allocateOldestFirst, validateExplicitAllocations } from "./allocation";
import { recomputeAmountsTx } from "@/lib/billing/service";
import { refreshDepositStatusTx } from "@/lib/deposits/service";
import { getSettings } from "@/lib/settings";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Tx = PrismaTx | typeof prisma;

const HEAVY_TX = { timeout: 20000, maxWait: 10000 } as const;

export interface ActorCtx {
  id: string;
  name: string;
  /** Override for audit attribution — null for the system/gateway actor (FK-safe). */
  auditActorId?: string | null;
}

export const GATEWAY_ACTOR: ActorCtx = { id: "webhook", name: "payment-gateway", auditActorId: null };

async function allocateCode(tx: Tx, key: string, prefix: string, year: number): Promise<string> {
  await tx.numberSequence.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  const row = await tx.numberSequence.findUniqueOrThrow({ where: { key } });
  return `${prefix}-${year}-${String(row.value).padStart(4, "0")}`;
}

export type CreatePaymentResult =
  | { ok: true; paymentId: string; code: string; allocatedMinor: number; remainderMinor: number }
  | { ok: false; code: string; message: string };

export interface CreatePaymentInput {
  memberProfileId: string;
  method: string;
  amountMinor: number;
  allocations?: Array<{ invoiceId: string; amountMinor: number }>;
  gatewayRef?: string | null;
  idempotencyKey?: string | null;
  receivedAt?: Date | null;
}

/// Record a payment (status pending). Allocations may be explicit or are
/// applied oldest-first (§M09 default). Nothing touches invoices or the
/// ledger until confirmation. Idempotent on idempotencyKey (§9.6).
export async function createPayment(
  actor: ActorCtx,
  input: CreatePaymentInput,
  ip?: string | null
): Promise<CreatePaymentResult> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Payment amount must be a positive integer (minor units)" };
  }
  if (!isPaymentMethod(input.method)) {
    return { ok: false, code: "INVALID_METHOD", message: "Unknown payment method" };
  }
  if (input.idempotencyKey) {
    const dup = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (dup) {
      return { ok: true, paymentId: dup.id, code: dup.code, allocatedMinor: dup.amountMinor - dup.remainingMinor, remainderMinor: dup.remainingMinor };
    }
  }

  const member = await prisma.memberProfile.findUnique({ where: { id: input.memberProfileId }, include: { party: true } });
  if (!member) return { ok: false, code: "NOT_FOUND", message: "Member not found" };

  const open = await prisma.invoice.findMany({
    where: { memberProfileId: member.id, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } },
    orderBy: [{ dueDate: "asc" }, { periodStart: "asc" }]
  });

  let allocations: Array<{ invoiceId: string; amountMinor: number }>;
  if (input.allocations && input.allocations.length > 0) {
    const check = validateExplicitAllocations(input.allocations, input.amountMinor);
    if (!check.ok) return { ok: false, code: "INVALID_ALLOCATIONS", message: check.message };
    const openById = new Map(open.map((i) => [i.id, i]));
    for (const a of input.allocations) {
      const inv = openById.get(a.invoiceId);
      if (!inv) return { ok: false, code: "INVALID_ALLOCATIONS", message: "Allocations may only target the member's open invoices" };
      if (a.amountMinor > inv.amountDueMinor) {
        return { ok: false, code: "EXCEEDS_DUE", message: `Allocation exceeds ${inv.code} outstanding due` };
      }
    }
    allocations = input.allocations;
  } else {
    allocations = allocateOldestFirst(
      open.map((i) => ({ id: i.id, dueMinor: i.amountDueMinor, dueDate: i.dueDate ?? i.periodStart, periodStart: i.periodStart })),
      input.amountMinor
    ).allocations;
  }

  const allocatedMinor = allocations.reduce((s, a) => s + a.amountMinor, 0);
  const firstProperty =
    allocations.length > 0
      ? (await prisma.invoice.findUnique({ where: { id: allocations[0].invoiceId } }))?.propertyId ?? null
      : null;
  const propertyId = firstProperty ?? member.homePropertyId;

  const created = await prisma.$transaction(
    async (tx) => {
      const year = new Date().getUTCFullYear();
      const code = await allocateCode(tx, `PMT:${year}`, "PMT", year);
      return tx.payment.create({
        data: {
          code,
          memberProfileId: member.id,
          propertyId,
          method: input.method,
          status: "pending",
          amountMinor: input.amountMinor,
          remainingMinor: input.amountMinor - allocatedMinor,
          gatewayRef: input.gatewayRef ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          receivedAt: input.receivedAt ?? new Date(),
          createdById: actor.id,
          allocations: allocations.length
            ? { create: allocations.map((a) => ({ invoiceId: a.invoiceId, amountMinor: a.amountMinor })) }
            : undefined
        },
        include: { allocations: true }
      });
    },
    HEAVY_TX
  );

  await logAudit({
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    actorName: actor.name,
    module: "M09",
    action: "create",
    entityType: "payment",
    entityId: created.id,
    summary: `Payment ${created.code} recorded for ${member.party.name}: ${(input.amountMinor / 100).toFixed(2)} via ${input.method} (${(allocatedMinor / 100).toFixed(2)} allocated, ${((input.amountMinor - allocatedMinor) / 100).toFixed(2)} credit)`,
    propertyId,
    after: { code: created.code, amountMinor: input.amountMinor, method: input.method, allocations: allocations.length },
    ip: ip ?? null
  });
  await emitDomainEvent(
    "payment.recorded",
    { paymentId: created.id, code: created.code, member: member.party.name, amountMinor: input.amountMinor, method: input.method },
    propertyId
  );
  return { ok: true, paymentId: created.id, code: created.code, allocatedMinor, remainderMinor: input.amountMinor - allocatedMinor };
}

export type ConfirmResult =
  | { ok: true; ignored: boolean; receiptCode: string | null; paymentStatus: PaymentStatus }
  | { ok: false; code: string; message: string };

/// App-level invoice transition guard (issued/partial_paid/overdue → paid|partial_paid).
function canInvoiceTransitionSafe(from: string, to: "paid" | "partial_paid"): boolean {
  const table: Record<string, string[]> = {
    draft: [],
    issued: ["partial_paid", "paid"],
    partial_paid: ["paid"],
    overdue: ["partial_paid", "paid"],
    paid: [],
    void: []
  };
  return (table[from] ?? []).includes(to);
}

/// Confirm a pending payment (manual collection or signed webhook). Idempotent:
/// an already-confirmed payment returns { ignored: true } with no side effects
/// (§9.6 duplicate webhooks are ignored). Allocates the receipt number, applies
/// allocations to invoices, posts DR cash/bank / CR receivable.
export async function confirmPayment(
  paymentId: string,
  actor: ActorCtx,
  opts: { viaWebhook?: boolean; ip?: string | null } = {}
): Promise<ConfirmResult> {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { include: { party: true } }, allocations: { include: { invoice: true } } }
  });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Payment not found" };
  if (existing.status === "confirmed") {
    return { ok: true, ignored: true, receiptCode: existing.receiptCode, paymentStatus: "confirmed" };
  }
  if (!canPaymentTransition(existing.status as PaymentStatus, "confirmed")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot confirm a ${existing.status} payment` };
  }

  const year = new Date().getUTCFullYear();
  const confirmed = await prisma.$transaction(
    async (tx) => {
      const receiptCode = await allocateCode(tx, `RCP:${year}`, "RCP", year);
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: "confirmed", confirmedAt: new Date(), receiptCode }
      });

      for (const allocation of existing.allocations) {
        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: { amountPaidMinor: { increment: allocation.amountMinor } }
        });
        const { dueMinor } = await recomputeAmountsTx(tx, allocation.invoiceId);
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: allocation.invoiceId } });
        if (dueMinor === 0 && canInvoiceTransitionSafe(invoice.status, "paid")) {
          await tx.invoice.update({ where: { id: invoice.id }, data: { status: "paid" } });
        } else if (dueMinor > 0 && canInvoiceTransitionSafe(invoice.status, "partial_paid")) {
          await tx.invoice.update({ where: { id: invoice.id }, data: { status: "partial_paid" } });
        }
        // M10: paying a deposit invoice advances the deposit (billed → held).
        // tx-threaded — a root-client write inside this tx would deadlock SQLite.
        const deposit = await tx.deposit.findUnique({ where: { invoiceId: allocation.invoiceId } });
        if (deposit) await refreshDepositStatusTx(tx, deposit.id);
      }

      await postTransaction(tx, {
        memo: `Payment ${payment.code} from ${existing.member.party.name} (${payment.method}) — receipt ${receiptCode}`,
        refType: "payment",
        refId: payment.id,
        propertyId: payment.propertyId,
        memberId: payment.memberProfileId,
        actorId: actor.id,
        lines: [
          { code: settlementAccountCode(payment.method), debit: payment.amountMinor, credit: 0 },
          { code: ACC.RENT_RECEIVABLE, debit: 0, credit: payment.amountMinor }
        ]
      });
      return payment;
    },
    HEAVY_TX
  );

  await logAudit({
    actorName: actor.name,
    module: "M09",
    action: "update",
    entityType: "payment",
    entityId: paymentId,
    summary: `Payment ${confirmed.code} confirmed — receipt ${confirmed.receiptCode} (${(confirmed.amountMinor / 100).toFixed(2)} via ${confirmed.method}${opts.viaWebhook ? ", webhook" : ""})`,
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    propertyId: confirmed.propertyId,
    before: { status: "pending" },
    after: { status: "confirmed", receiptCode: confirmed.receiptCode },
    ip: opts.ip ?? null
  });
  await emitDomainEvent(
    "payment.confirmed",
    { paymentId, code: confirmed.code, receiptCode: confirmed.receiptCode, amountMinor: confirmed.amountMinor, viaWebhook: Boolean(opts.viaWebhook) },
    confirmed.propertyId
  );
  await fileReceiptPdf(paymentId).catch(() => undefined);
  return { ok: true, ignored: false, receiptCode: confirmed.receiptCode, paymentStatus: "confirmed" };
}

/// Mark a pending payment failed (gateway timeout / bounced intake).
export async function failPayment(paymentId: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<ConfirmResult> {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Payment not found" };
  if (!canPaymentTransition(existing.status as PaymentStatus, "failed")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot fail a ${existing.status} payment` };
  }
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "failed", failedAt: new Date(), failReason: reason }
  });
  await logAudit({
    actorName: actor.name,
    module: "M09",
    action: "update",
    entityType: "payment",
    entityId: paymentId,
    summary: `Payment ${existing.code} marked failed: ${reason}`,
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    propertyId: existing.propertyId,
    before: { status: existing.status },
    after: { status: "failed", reason },
    ip: ip ?? null
  });
  await emitDomainEvent("payment.failed", { paymentId, code: existing.code, reason }, existing.propertyId);
  return { ok: true, ignored: false, receiptCode: null, paymentStatus: "failed" };
}

/// Refund the UNALLOCATED remainder (member credit) back to the member —
/// Accountant+ only (GLOBAL M09:update, enforced at the route). Allocated
/// amounts are not refundable in v1: the invoice machine treats `paid` as
/// terminal, so releasing allocations would need a §15 amendment first.
export async function refundPayment(paymentId: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<ConfirmResult> {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { include: { party: true } } }
  });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Payment not found" };
  if (!canPaymentTransition(existing.status as PaymentStatus, "refunded")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot refund a ${existing.status} payment` };
  }
  if (existing.remainingMinor <= 0) {
    return { ok: false, code: "NOTHING_TO_REFUND", message: "Fully allocated payments have no refundable credit in v1" };
  }

  const amount = existing.remainingMinor;
  await prisma.$transaction(
    async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "refunded", refundedMinor: amount, remainingMinor: 0, refundReason: reason, refundedAt: new Date() }
      });
      await postTransaction(tx, {
        memo: `Refund of member credit on ${existing.code}: ${reason}`,
        refType: "refund",
        refId: existing.id,
        propertyId: existing.propertyId,
        memberId: existing.memberProfileId,
        actorId: actor.id,
        lines: [
          { code: ACC.RENT_RECEIVABLE, debit: amount, credit: 0 },
          { code: settlementAccountCode(existing.method), debit: 0, credit: amount }
        ]
      });
    },
    HEAVY_TX
  );

  await logAudit({
    actorName: actor.name,
    module: "M09",
    action: "update",
    entityType: "payment",
    entityId: paymentId,
    summary: `Payment ${existing.code} refunded ${(amount / 100).toFixed(2)} (member credit): ${reason}`,
    actorId: actor.auditActorId === undefined ? actor.id : actor.auditActorId,
    propertyId: existing.propertyId,
    before: { status: "confirmed", remainingMinor: amount },
    after: { status: "refunded", refundedMinor: amount, reason },
    ip: ip ?? null
  });
  await emitDomainEvent("payment.refunded", { paymentId, code: existing.code, amountMinor: amount, reason }, existing.propertyId);
  return { ok: true, ignored: false, receiptCode: existing.receiptCode, paymentStatus: "refunded" };
}

/// Signed webhook intake: find by idempotencyKey → gatewayRef → explicit id.
/// Duplicate notifications (already-confirmed payments) are ignored (§9.6).
export async function handlePaymentWebhook(
  payload: { paymentId?: string; gatewayRef?: string; idempotencyKey?: string; status: string; reason?: string },
  ip?: string | null
): Promise<ConfirmResult | { ok: false; code: string; message: string }> {
  // The gateway is a system actor: audit rows carry actorId null + the name.
  const actor = GATEWAY_ACTOR;
  let payment: { id: string } | null = null;
  if (payload.idempotencyKey) {
    payment = await prisma.payment.findUnique({ where: { idempotencyKey: payload.idempotencyKey } });
  }
  if (!payment && payload.gatewayRef) {
    payment = await prisma.payment.findUnique({ where: { gatewayRef: payload.gatewayRef } });
  }
  if (!payment && payload.paymentId) {
    payment = await prisma.payment.findUnique({ where: { id: payload.paymentId } });
  }
  if (!payment) return { ok: false, code: "NOT_FOUND", message: "No payment matches the webhook payload" };

  if (payload.status === "confirmed") {
    return confirmPayment(payment.id, actor, { viaWebhook: true, ip });
  }
  if (payload.status === "failed") {
    return failPayment(payment.id, payload.reason ?? "gateway reported failure", actor, ip);
  }
  return { ok: false, code: "INVALID_STATUS", message: "Webhook status must be confirmed | failed" };
}

/// Render + file the receipt PDF into M17 (v1 at confirmation, refile versions).
export async function fileReceiptPdf(paymentId: string, refile = false): Promise<void> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { ReceiptPdf } = await import("./receipt-pdf");
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { include: { party: true } }, allocations: { include: { invoice: true } } }
  });
  if (!payment) throw new Error("Payment not found");

  const { org, locale } = await getSettings();
  const buffer = await renderToBuffer(
    <ReceiptPdf
      data={{
        orgName: org.name ?? "RentManager",
        orgAddress: org.address || undefined,
        orgPhone: org.phone || undefined,
        orgLogo: org.logo || undefined,
        orgFooterNote: org.invoiceFooterNote || undefined,
        currency: locale.currency ?? "USD",
        receiptCode: payment.receiptCode ?? "—",
        paymentCode: payment.code,
        status: payment.status,
        memberName: payment.member.party.name,
        method: payment.method,
        receivedAt: payment.confirmedAt ?? payment.receivedAt,
        amountMinor: payment.amountMinor,
        allocations: payment.allocations.map((a) => ({ code: a.invoice.code, amountMinor: a.amountMinor })),
        remainingMinor: payment.remainingMinor
      }}
    />
  );

  const existing = await prisma.documentRegistry.findFirst({
    where: { entity: "PAYMENT", entityId: paymentId, docTypeId: "receipt" },
    orderBy: { version: "desc" }
  });
  if (!existing || refile) {
    const { randomBytes } = await import("node:crypto");
    const storageKey = randomBytes(16).toString("hex");
    await storage.put(storageKey, buffer);
    await prisma.documentRegistry.create({
      data: {
        docTypeId: "receipt",
        entity: "PAYMENT",
        entityId: paymentId,
        fileName: `receipt-${payment.receiptCode ?? payment.code}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
        storageKey,
        version: existing ? existing.version + 1 : 1,
        propertyId: payment.propertyId,
        notes: "Auto-generated payment receipt"
      }
    });
  }
}
