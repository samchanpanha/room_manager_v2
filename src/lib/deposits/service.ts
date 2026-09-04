/// Deposits service (M10) — security deposit lifecycle.
/// Collection rides the invoice pipeline: activation issues a `deposit`-kind
/// invoice (installment lines) whose issue posting credits 2100 Deposit
/// Liability; M09 payments settle the receivable. Settlement = deductions
/// (evidence required) + refund of the remainder, each posting against 2100
/// until it nets 0 for the closed lease. Movements are append-only.
import { prisma } from "@/lib/db";
import { emitDomainEvent } from "@/lib/events";
import { logAudit } from "@/lib/audit";
import { postTransaction } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";
import { allocateInvoiceNumber } from "@/lib/billing/service";
import {
  canDepositTransition,
  deductionCreditAccount,
  installmentSplit,
  isDeductionReason,
  leaseAllowsSettlement,
  type DepositStatus
} from "./machines";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Tx = PrismaTx | typeof prisma;

const HEAVY_TX = { timeout: 20000, maxWait: 10000 } as const;

export interface ActorCtx {
  id: string;
  name: string;
}

const DEPOSIT_INVOICE_PERIOD = new Date(Date.UTC(2000, 0, 1)); // outside every real billing period

function settlementAccountCode(method: string): "1100" | "1200" {
  return method === "cash" || method === "cheque" ? "1100" : "1200";
}

/// Outstanding liability for a deposit: collected (paid deposit invoice) −
/// Σ movements. The ledger's 2100 rows for this member mirror it exactly.
export async function depositRemaining(depositId: string): Promise<number> {
  const deposit = await prisma.deposit.findUniqueOrThrow({
    where: { id: depositId },
    include: { invoice: true, transactions: true }
  });
  const collected = deposit.invoice?.amountPaidMinor ?? 0;
  const released = deposit.transactions.reduce((s, t) => s + t.amountMinor, 0);
  return Math.max(0, collected - released);
}

/// Recompute + persist the deposit status from its facts (idempotent,
/// forward-only): pending → billed (invoice issued) → held (invoice paid) →
/// settled (liability fully released by movements).
export async function refreshDepositStatus(depositId: string): Promise<DepositStatus> {
  return prisma.$transaction(async (tx) => refreshDepositStatusTx(tx, depositId), HEAVY_TX);
}

export async function refreshDepositStatusTx(tx: Tx, depositId: string): Promise<DepositStatus> {
  const deposit = await tx.deposit.findUniqueOrThrow({
    where: { id: depositId },
    include: { invoice: true, transactions: true }
  });
  const current = deposit.status as DepositStatus;
  const collected = deposit.invoice?.amountPaidMinor ?? 0;
  const released = deposit.transactions.reduce((s, t) => s + t.amountMinor, 0);
  const remaining = Math.max(0, collected - released);
  let next = current;
  if (deposit.invoice && collected >= deposit.invoice.totalMinor && canDepositTransition(next, "held")) {
    next = "held";
  }
  if (remaining === 0 && released > 0 && canDepositTransition(next, "settled")) {
    next = "settled";
  }
  if (next !== current) {
    await tx.deposit.update({ where: { id: depositId }, data: { status: next } });
  }
  return next;
}

/// Create the deposit record + bill it as a `deposit`-kind invoice with
/// installment lines (idempotent per lease). Called at lease activation and
/// from the seed backfill.
export async function ensureDepositForLease(
  leaseId: string,
  actor: ActorCtx | null
): Promise<{ ok: true; depositId: string; invoiceCode: string | null; created: boolean } | { ok: false; code: string; message: string }> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      member: { include: { party: true } }
    }
  });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  const existing = await prisma.deposit.findUnique({ where: { leaseId } });
  if (existing) {
    const invoiceCode = existing.invoiceId
      ? (await prisma.invoice.findUnique({ where: { id: existing.invoiceId } }))?.code ?? null
      : null;
    return { ok: true, depositId: existing.id, invoiceCode, created: false };
  }
  if (lease.depositTotalMinor <= 0) return { ok: false, code: "NO_DEPOSIT", message: "Lease has no deposit terms" };

  const propertyCode = lease.room.floor.building.property.code;
  const amounts = installmentSplit(lease.depositTotalMinor, lease.depositInstallments);
  const lines = amounts.map((amount, i) => ({
    kind: "deposit" as const,
    name: `Security deposit installment ${i + 1}/${amounts.length}`,
    qty: 1,
    unitMinor: amount,
    amountMinor: amount
  }));
  const subtotal = lines.reduce((s, l) => s + l.amountMinor, 0);
  const total = subtotal; // deposits are not taxed; discount 0 — the invariant total = Σitems holds

  const { invoice, deposit } = await prisma.$transaction(
    async (tx) => {
      const code = await allocateInvoiceNumber(tx, propertyCode, new Date().getUTCFullYear());
      const createdInvoice = await tx.invoice.create({
        data: {
          code,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          memberProfileId: lease.memberProfileId,
          status: "issued",
          isDeposit: true, // excluded from the billing-period chain
          periodStart: DEPOSIT_INVOICE_PERIOD,
          periodEnd: DEPOSIT_INVOICE_PERIOD,
          issuedAt: new Date(),
          dueDate: lease.startDate, // due at move-in — oldest-first allocation collects it first
          subtotalMinor: subtotal,
          discountMinor: 0,
          taxMinor: 0,
          totalMinor: total,
          amountDueMinor: total,
          createdById: actor?.id ?? null,
          items: { create: lines }
        }
      });
      // M08: the deposit obligation — DR receivable / CR 2100 liability
      await postTransaction(tx, {
        memo: `Deposit billed on ${lease.code} (${lease.depositInstallments} installment(s)) — invoice ${code}`,
        refType: "deposit",
        refId: createdInvoice.id,
        propertyId: lease.propertyId,
        memberId: lease.memberProfileId,
        actorId: actor?.id ?? null,
        lines: [
          { code: ACC.RENT_RECEIVABLE, debit: total, credit: 0 },
          { code: ACC.DEPOSIT_LIABILITY, debit: 0, credit: total }
        ]
      });
      const createdDeposit = await tx.deposit.create({
        data: {
          leaseId: lease.id,
          memberProfileId: lease.memberProfileId,
          propertyId: lease.propertyId,
          requiredMinor: lease.depositTotalMinor,
          status: "billed",
          invoiceId: createdInvoice.id,
          createdById: actor?.id ?? null
        }
      });
      return { invoice: createdInvoice, deposit: createdDeposit };
    },
    HEAVY_TX
  );

  await logAudit({
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "system",
    module: "M10",
    action: "deposit.billed",
    entityType: "deposit",
    entityId: deposit.id,
    summary: `Deposit billed for ${lease.code} (${lease.member.party.name}): ${(total / 100).toFixed(2)} in ${lease.depositInstallments} installment(s) — invoice ${invoice.code}`,
    propertyId: lease.propertyId,
    after: { depositId: deposit.id, invoiceCode: invoice.code, totalMinor: total },
    ip: null
  });
  await emitDomainEvent(
    "deposit.billed",
    { depositId: deposit.id, leaseCode: lease.code, invoiceCode: invoice.code, totalMinor: total, installments: lease.depositInstallments },
    lease.propertyId
  );
  return { ok: true, depositId: deposit.id, invoiceCode: invoice.code, created: true };
}

export type SettlementResult =
  | { ok: true; remainingMinor: number; status: DepositStatus }
  | { ok: false; code: string; message: string };

/// Deduct from the deposit (move-out settlement). Evidence document REQUIRED;
/// damage/cleaning/other credit 4900, unpaid_rent credits 1300 (settles debt).
export async function deductDeposit(
  depositId: string,
  input: { amountMinor: number; reason: string; evidenceDocId: string; note: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<SettlementResult> {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { lease: true, invoice: true, member: { include: { party: true } } }
  });
  if (!deposit) return { ok: false, code: "NOT_FOUND", message: "Deposit not found" };
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Deduction must be a positive integer (minor units)" };
  }
  if (!isDeductionReason(input.reason)) return { ok: false, code: "INVALID_REASON", message: "Unknown deduction reason" };
  if (!input.note || input.note.trim().length < 3) return { ok: false, code: "NOTE_REQUIRED", message: "A written note is required" };
  const evidence = await prisma.documentRegistry.findUnique({ where: { id: input.evidenceDocId } });
  if (!evidence) return { ok: false, code: "EVIDENCE_REQUIRED", message: "Deductions require an evidence document (M17 registry id)" };
  if (deposit.status === "settled") return { ok: false, code: "ALREADY_SETTLED", message: "Deposit already settled" };
  if (!leaseAllowsSettlement(deposit.lease.status)) {
    return { ok: false, code: "LEASE_ACTIVE", message: "Settlement opens at move-out (notice / completed / terminated)" };
  }
  const remaining = await depositRemaining(depositId);
  if (remaining <= 0) return { ok: false, code: "NOTHING_HELD", message: "No collected deposit held" };
  if (input.amountMinor > remaining) {
    return { ok: false, code: "EXCEEDS_HELD", message: `Deduction exceeds the held amount (${(remaining / 100).toFixed(2)})` };
  }

  const creditCode = deductionCreditAccount(input.reason);
  await prisma.$transaction(
    async (tx) => {
      const ledgerTxId = await postTransaction(tx, {
        memo: `Deposit deduction (${input.reason}) on ${deposit.lease.code}: ${input.note}`,
        refType: "deposit_deduction",
        refId: deposit.id,
        propertyId: deposit.propertyId,
        memberId: deposit.memberProfileId,
        actorId: actor.id,
        lines: [
          { code: ACC.DEPOSIT_LIABILITY, debit: input.amountMinor, credit: 0 },
          { code: creditCode, debit: 0, credit: input.amountMinor, memo: input.reason }
        ]
      });
      await tx.depositTransaction.create({
        data: {
          depositId: deposit.id,
          type: "deduction",
          amountMinor: input.amountMinor,
          reason: input.reason,
          evidenceDocId: evidence.id,
          note: input.note,
          ledgerTxId
        }
      });
      await refreshDepositStatusTx(tx, deposit.id);
    },
    HEAVY_TX
  );

  const after = await depositRemaining(depositId);
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M10",
    action: "deposit.deducted",
    entityType: "deposit",
    entityId: deposit.id,
    summary: `Deposit deduction ${(input.amountMinor / 100).toFixed(2)} (${input.reason}) on ${deposit.lease.code} — evidence doc ${evidence.id}`,
    propertyId: deposit.propertyId,
    after: { amountMinor: input.amountMinor, reason: input.reason, evidenceDocId: evidence.id, remainingMinor: after },
    ip: ip ?? null
  });
  await emitDomainEvent(
    "deposit.deducted",
    { depositId: deposit.id, leaseCode: deposit.lease.code, amountMinor: input.amountMinor, reason: input.reason, remainingMinor: after },
    deposit.propertyId
  );
  return { ok: true, remainingMinor: after, status: (await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } })).status as DepositStatus };
}

/// Refund the deposit remainder (move-out settlement). Accountant+ approval —
/// GLOBAL M10:update enforced at the route (mirrors M09 refunds; §M10 "refunds
/// go through M09 with approval").
export async function refundDeposit(
  depositId: string,
  input: { amountMinor: number | null; method: string; note: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<SettlementResult> {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { lease: true, member: { include: { party: true } } }
  });
  if (!deposit) return { ok: false, code: "NOT_FOUND", message: "Deposit not found" };
  if (deposit.status === "settled") return { ok: false, code: "ALREADY_SETTLED", message: "Deposit already settled" };
  if (!leaseAllowsSettlement(deposit.lease.status)) {
    return { ok: false, code: "LEASE_ACTIVE", message: "Settlement opens at move-out (notice / completed / terminated)" };
  }
  if (!input.note || input.note.trim().length < 3) return { ok: false, code: "NOTE_REQUIRED", message: "A written note is required" };
  const remaining = await depositRemaining(depositId);
  if (remaining <= 0) return { ok: false, code: "NOTHING_TO_REFUND", message: "No collected deposit held" };
  const amount = input.amountMinor ?? remaining;
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Refund must be a positive integer (minor units)" };
  }
  if (amount > remaining) return { ok: false, code: "EXCEEDS_HELD", message: `Refund exceeds the held amount (${(remaining / 100).toFixed(2)})` };

  const settlement = settlementAccountCode(input.method);
  await prisma.$transaction(
    async (tx) => {
      const ledgerTxId = await postTransaction(tx, {
        memo: `Deposit refund on ${deposit.lease.code} (${deposit.member.party.name}): ${input.note}`,
        refType: "deposit_refund",
        refId: deposit.id,
        propertyId: deposit.propertyId,
        memberId: deposit.memberProfileId,
        actorId: actor.id,
        lines: [
          { code: ACC.DEPOSIT_LIABILITY, debit: amount, credit: 0 },
          { code: settlement, debit: 0, credit: amount }
        ]
      });
      await tx.depositTransaction.create({
        data: {
          depositId: deposit.id,
          type: "refund",
          amountMinor: amount,
          note: input.note,
          method: input.method,
          ledgerTxId
        }
      });
      await refreshDepositStatusTx(tx, deposit.id);
    },
    HEAVY_TX
  );

  const after = await depositRemaining(depositId);
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M10",
    action: "deposit.refunded",
    entityType: "deposit",
    entityId: deposit.id,
    summary: `Deposit refund ${(amount / 100).toFixed(2)} via ${input.method} on ${deposit.lease.code} — remaining ${(after / 100).toFixed(2)}`,
    propertyId: deposit.propertyId,
    after: { amountMinor: amount, method: input.method, remainingMinor: after },
    ip: ip ?? null
  });
  await emitDomainEvent(
    "deposit.refunded",
    { depositId: deposit.id, leaseCode: deposit.lease.code, amountMinor: amount, remainingMinor: after, method: input.method },
    deposit.propertyId
  );
  return { ok: true, remainingMinor: after, status: (await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } })).status as DepositStatus };
}
