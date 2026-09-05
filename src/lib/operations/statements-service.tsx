/// M24 Owner Statements service — generation (§M24 "generation job"), the
/// audited ±adjustment, approval accrual (DR 3900 Owner Distributions /
/// CR 2200 Owner Payable — §15 v1.2), payout (DR 2200 / CR cash|bank,
/// refType `payout` — Owner Payable nets to 0 and the §M20 P&L payout term
/// equals the cash distributed), and the M17-filed PDF. Pure math in
/// statements-math.ts.
import * as React from "react"; // classic JSX runtime (tsx/vitest) needs React in scope
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { postTransaction } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";
import { getSettings } from "@/lib/settings";
import type { ActorCtx } from "@/lib/payments/service";
import {
  computeStatementLines,
  previousMonth,
  rollupExpensesByCharge,
  rollupCollections,
  statementMonthRange,
  statementReconciles,
  type CollectionRow,
  type ExpenseRow,
  type StatementContractModel,
  type StatementLines
} from "./statements-math";

interface Result<T> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
}

const HEAVY_TX = { maxWait: 5_000, timeout: 20_000 } as const;

export const PAYOUT_METHODS = ["cash", "bank_transfer"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

const PAYOUT_ACCOUNT: Record<PayoutMethod, string> = { cash: ACC.CASH, bank_transfer: ACC.BANK };

// ── inputs rollup (collections + pass-through expenses) ─────────────────────

async function monthInputs(buildingIds: string[], month: string): Promise<{
  collectedByBuilding: Map<string, number>;
  passthroughByBuilding: Map<string, number>;
  ownerMaintenanceByBuilding: Map<string, number>;
}> {
  const range = statementMonthRange(month)!;
  const [allocations, expenses] = await Promise.all([
    prisma.paymentAllocation.findMany({
      where: {
        payment: { status: "confirmed", confirmedAt: { gte: range.from, lt: range.to } },
        invoice: {
          lease: {
            room: {
              floor: { buildingId: { in: buildingIds } }
            }
          }
        }
      },
      select: {
        amountMinor: true,
        invoice: {
          select: {
            lease: {
              select: {
                room: { select: { floor: { select: { buildingId: true } } } }
              }
            }
          }
        }
      }
    }),
    // Expenses are property-scoped (M20); attribute the property's totals to
    // each contracted building of that property (v1: one contract per property).
    prisma.expense.findMany({
      where: {
        status: "approved",
        expenseDate: { gte: range.from, lt: range.to },
        category: { chargeTo: { in: ["passthrough", "owner_maintenance"] } }
      },
      select: { amountMinor: true, propertyId: true, category: { select: { chargeTo: true } } }
    })
  ]);

  // leaseId is nullable on invoices (POS charge-to-room invoices have none) — those never
  // match the lease-bearing where clause, but narrow for the type checker anyway.
  const collectionRows: CollectionRow[] = allocations.flatMap((a) =>
    a.invoice.lease && a.invoice.lease.room.floor
      ? [{ buildingId: a.invoice.lease.room.floor.buildingId, amountMinor: a.amountMinor }]
      : []
  );
  const collectedByBuilding = rollupCollections(collectionRows);

  // property → building map for expense attribution
  const buildings = await prisma.building.findMany({ where: { id: { in: buildingIds } }, select: { id: true, propertyId: true } });
  const propertyOf = new Map(buildings.map((b) => [b.id, b.propertyId]));

  const expenseRows: ExpenseRow[] = expenses.map((e) => {
    // attribute at building level: every contracted building of the property
    const buildingIdsOfProperty = buildings.filter((b) => b.propertyId === e.propertyId).map((b) => b.id);
    return { buildingId: buildingIdsOfProperty[0] ?? e.propertyId, chargeTo: e.category.chargeTo, amountMinor: e.amountMinor };
  });
  const { passthrough, ownerMaintenance } = rollupExpensesByCharge(expenseRows);
  void propertyOf;
  return { collectedByBuilding, passthroughByBuilding: passthrough, ownerMaintenanceByBuilding: ownerMaintenance };
}

// ── generation (§M24 "generation job (configurable day)") ───────────────────

export interface GenerateSummary {
  month: string;
  created: number;
  skippedExisting: number;
  skippedNotDue: number;
  statements: Array<{ code: string; contract: string; netMinor: number }>;
}

export async function generateStatements(
  input: { month?: string; force?: boolean },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<GenerateSummary>> {
  const month = input.month ?? previousMonth();
  if (!statementMonthRange(month)) return { ok: false, code: "INVALID_MONTH", message: "month must be YYYY-MM" };
  const range = statementMonthRange(month)!;
  const today = new Date().getUTCDate();

  const contracts = await prisma.ownerContract.findMany({
    where: { status: "active", startDate: { lt: range.to } },
    include: { building: { select: { id: true, name: true, propertyId: true } }, owner: { include: { party: true } } }
  });
  if (contracts.length === 0) return { ok: true, data: { month, created: 0, skippedExisting: 0, skippedNotDue: 0, statements: [] } };

  const existing = await prisma.ownerStatement.findMany({
    where: { contractId: { in: contracts.map((c) => c.id) }, month },
    select: { contractId: true }
  });
  const existingSet = new Set(existing.map((e) => e.contractId));

  const due = contracts.filter((c) => input.force || today >= c.payoutCycleDay);
  const notDue = contracts.length - due.length - (contracts.length - due.length ? 0 : 0);
  const toGenerate = due.filter((c) => !existingSet.has(c.id));
  const skippedNotDue = contracts.filter((c) => !input.force && today < c.payoutCycleDay).length;
  const skippedExisting = existingSet.size;
  void notDue;

  if (toGenerate.length === 0) {
    return { ok: true, data: { month, created: 0, skippedExisting, skippedNotDue, statements: [] } };
  }

  const inputs = await monthInputs(
    toGenerate.map((c) => c.building.id),
    month
  );

  const created: GenerateSummary["statements"] = [];
  for (const contract of toGenerate) {
    const collectedMinor = inputs.collectedByBuilding.get(contract.building.id) ?? 0;
    const lines = computeStatementLines({
      model: contract.model as StatementContractModel,
      sharePercent: contract.sharePercent,
      fixedRentMinor: contract.fixedRentMinor,
      managementFeePercent: contract.managementFeePercent,
      collectedMinor,
      passthroughMinor: inputs.passthroughByBuilding.get(contract.building.id) ?? 0,
      ownerMaintenanceMinor: inputs.ownerMaintenanceByBuilding.get(contract.building.id) ?? 0,
      adjustmentsMinor: 0
    });
    const code = await nextNumber("STATEMENT", (n) => `STM-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);
    const statement = await prisma.ownerStatement.create({
      data: {
        code,
        ownerProfileId: contract.ownerProfileId,
        contractId: contract.id,
        buildingId: contract.building.id,
        propertyId: contract.building.propertyId,
        month,
        status: "draft",
        ...lines,
        lineSnapshot: JSON.stringify({ model: contract.model, sharePercent: contract.sharePercent, fixedRentMinor: contract.fixedRentMinor, managementFeePercent: contract.managementFeePercent, reconciles: statementReconciles(lines) }),
        generatedById: actor.id
      }
    });
    created.push({ code: statement.code, contract: contract.code, netMinor: lines.netMinor });
    await emitDomainEvent("statement.generated", { statementId: statement.id, code, contract: contract.code, netMinor: lines.netMinor }, contract.building.propertyId);
  }

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M24",
    action: "statement.generated",
    entityType: "owner_statement",
    entityId: created.map((c) => c.code).join(",") || "none",
    summary: `Generated ${created.length} statement(s) for ${month}: ${created.map((c) => `${c.code}(${c.contract})`).join(", ") || "none due"}`,
    ip
  });
  return { ok: true, data: { month, created: created.length, skippedExisting, skippedNotDue, statements: created } };
}

// ── adjustment (draft only — §M24 "± adjustments") ───────────────────────────

export async function adjustStatement(
  statementId: string,
  input: { adjustmentsMinor: number; reason: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ netMinor: number }>> {
  if (!input.reason.trim()) return { ok: false, code: "REASON_REQUIRED", message: "An adjustment reason is required" };
  if (!Number.isInteger(input.adjustmentsMinor)) return { ok: false, code: "INVALID_AMOUNT", message: "adjustmentsMinor must be an integer" };
  const st = await prisma.ownerStatement.findUnique({ where: { id: statementId } });
  if (!st) return { ok: false, code: "NOT_FOUND", message: "Statement not found" };
  if (st.status !== "draft") return { ok: false, code: "INVALID_TRANSITION", message: `Only draft statements can be adjusted (${st.status})` };

  const lines: StatementLines = {
    collectedMinor: st.collectedMinor,
    grossShareMinor: st.grossShareMinor,
    managementFeeMinor: st.managementFeeMinor,
    passthroughMinor: st.passthroughMinor,
    ownerMaintenanceMinor: st.ownerMaintenanceMinor,
    adjustmentsMinor: input.adjustmentsMinor,
    netMinor: st.grossShareMinor - st.managementFeeMinor - st.passthroughMinor - st.ownerMaintenanceMinor + input.adjustmentsMinor
  };
  await prisma.ownerStatement.update({
    where: { id: st.id },
    data: { ...lines, adjustmentsReason: input.reason.trim(), lineSnapshot: JSON.stringify({ adjustedBy: actor.id, reconciles: statementReconciles(lines) }) }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M24",
    action: "statement.adjusted",
    entityType: "owner_statement",
    entityId: st.id,
    summary: `${st.code}: adjustment ${st.adjustmentsMinor} → ${input.adjustmentsMinor} — "${input.reason.trim()}" (net ${lines.netMinor})`,
    propertyId: st.propertyId,
    before: { adjustmentsMinor: st.adjustmentsMinor, netMinor: st.netMinor },
    after: { adjustmentsMinor: input.adjustmentsMinor, netMinor: lines.netMinor, reason: input.reason.trim() },
    ip
  });
  return { ok: true, data: { netMinor: lines.netMinor } };
}

// ── approval (accrual) ───────────────────────────────────────────────────────

export async function approveStatement(statementId: string, actor: ActorCtx, ip?: string | null): Promise<Result<{ code: string; netMinor: number }>> {
  const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: statementId } }).catch(() => null);
  if (!st) return { ok: false, code: "NOT_FOUND", message: "Statement not found" };
  if (st.status !== "draft") return { ok: false, code: "INVALID_TRANSITION", message: `Cannot approve from ${st.status}` };
  // A non-positive net cannot be accrued (negative/zero debit lines are not
  // valid postings) — adjust the draft until net > 0 or leave it unapproved.
  if (st.netMinor <= 0) return { ok: false, code: "NOTHING_TO_ACCRUE", message: "Net payout is not positive — nothing to accrue" };

  await prisma.$transaction(
    async (tx) => {
      const memo = `Owner statement ${st.code} — payout accrual (${st.month})`;
      const ledgerTxId = await postTransaction(tx, {
        memo,
        refType: "statement_accrual",
        refId: st.id,
        propertyId: st.propertyId,
        actorId: actor.id,
        lines: [
          { code: ACC.OWNER_DISTRIBUTIONS, debit: st.netMinor, credit: 0, memo },
          { code: ACC.OWNER_PAYABLE, debit: 0, credit: st.netMinor, memo }
        ]
      });
      await tx.ownerStatement.update({
        where: { id: st.id },
        data: { status: "approved", ledgerTxId, approvedById: actor.id, approvedAt: new Date() }
      });
    },
    HEAVY_TX
  );
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M24",
    action: "statement.approved",
    entityType: "owner_statement",
    entityId: st.id,
    summary: `Approved ${st.code}: accrual DR 3900/CR 2200 ${(st.netMinor / 100).toFixed(2)}`,
    propertyId: st.propertyId,
    ip
  });
  await emitDomainEvent("statement.approved", { statementId: st.id, code: st.code, netMinor: st.netMinor }, st.propertyId);
  await fileStatementPdf(st.id).catch(() => undefined);
  return { ok: true, data: { code: st.code, netMinor: st.netMinor } };
}

// ── payout (paid) ────────────────────────────────────────────────────────────

export async function payStatement(
  statementId: string,
  input: { method: PayoutMethod },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ code: string; netMinor: number; ownerPayableBalanceMinor: number }>> {
  const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { id: statementId } }).catch(() => null);
  if (!st) return { ok: false, code: "NOT_FOUND", message: "Statement not found" };
  if (st.status !== "approved") return { ok: false, code: "INVALID_TRANSITION", message: `Cannot pay from ${st.status}` };
  if (st.netMinor <= 0) return { ok: false, code: "NOTHING_TO_PAY", message: "Net payout is not positive — nothing to pay" };
  if (!st.ledgerTxId) return { ok: false, code: "NO_POSTING", message: "Approved statement has no accrual — data integrity issue" };

  await prisma.$transaction(
    async (tx) => {
      const memo = `Owner payout ${st.code} — ${st.month}`;
      await postTransaction(tx, {
        memo,
        refType: "payout",
        refId: st.id,
        propertyId: st.propertyId,
        actorId: actor.id,
        lines: [
          { code: ACC.OWNER_PAYABLE, debit: st.netMinor, credit: 0, memo },
          { code: PAYOUT_ACCOUNT[input.method], debit: 0, credit: st.netMinor, memo }
        ]
      });
      await tx.ownerStatement.update({
        where: { id: st.id },
        data: { status: "paid", paidVia: input.method, paidAt: new Date(), paidById: actor.id }
      });
    },
    HEAVY_TX
  );
  // §M24 acceptance evidence: the Owner Payable balance after the payout.
  const payable = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: ACC.OWNER_PAYABLE }, select: { id: true } });
  const agg = await prisma.ledgerEntry.aggregate({ where: { accountId: payable.id }, _sum: { debit: true, credit: true } });
  const ownerPayableBalanceMinor = (agg._sum.credit ?? 0) - (agg._sum.debit ?? 0);

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M24",
    action: "statement.paid",
    entityType: "owner_statement",
    entityId: st.id,
    summary: `Paid ${st.code}: ${(st.netMinor / 100).toFixed(2)} via ${input.method} — DR 2200/CR ${PAYOUT_ACCOUNT[input.method]}; Owner Payable balance ${ownerPayableBalanceMinor}`,
    propertyId: st.propertyId,
    ip
  });
  await emitDomainEvent("statement.paid", { statementId: st.id, code: st.code, method: input.method, ownerPayableBalanceMinor }, st.propertyId);
  return { ok: true, data: { code: st.code, netMinor: st.netMinor, ownerPayableBalanceMinor } };
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listStatements(filter: { ownerProfileId?: string | null; propertyIds?: string[] | null; month?: string | null }) {
  return prisma.ownerStatement.findMany({
    where: {
      ...(filter.ownerProfileId ? { ownerProfileId: filter.ownerProfileId } : {}),
      ...(filter.propertyIds ? { propertyId: { in: filter.propertyIds } } : {}),
      ...(filter.month ? { month: filter.month } : {})
    },
    include: {
      ownerProfile: { include: { party: { select: { name: true } } } },
      contract: { select: { code: true, model: true, sharePercent: true, fixedRentMinor: true, managementFeePercent: true } },
      building: { select: { name: true } },
      property: { select: { code: true } }
    },
    orderBy: [{ month: "desc" }, { code: "asc" }]
  });
}

// ── PDF (M17, entity STATEMENT, docType statement) ──────────────────────────

export async function fileStatementPdf(statementId: string): Promise<void> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { OwnerStatementPdf } = await import("./statement-pdf");
  const st = await prisma.ownerStatement.findUniqueOrThrow({
    where: { id: statementId },
    include: {
      ownerProfile: { include: { party: { select: { name: true } } } },
      contract: { select: { code: true, model: true } },
      building: { select: { name: true } },
      property: { select: { code: true, name: true } }
    }
  });
  const { org } = await getSettings();
  const buffer = await renderToBuffer(
    <OwnerStatementPdf
      data={{
        code: st.code,
        month: st.month,
        status: st.status,
        orgName: org.name ?? "RentManager",
        orgLegalName: org.legalName || undefined,
        orgAddress: org.address || undefined,
        orgPhone: org.phone || undefined,
        orgEmail: org.email || undefined,
        orgTaxId: org.taxId || undefined,
        orgLogo: org.logo || undefined,
        propertyName: st.property.name,
        buildingName: st.building.name,
        ownerName: st.ownerProfile.party.name,
        contractCode: st.contract.code,
        model: st.contract.model,
        collectedMinor: st.collectedMinor,
        grossShareMinor: st.grossShareMinor,
        managementFeeMinor: st.managementFeeMinor,
        passthroughMinor: st.passthroughMinor,
        ownerMaintenanceMinor: st.ownerMaintenanceMinor,
        adjustmentsMinor: st.adjustmentsMinor,
        netMinor: st.netMinor,
        paidVia: st.paidVia,
        paidAt: st.paidAt?.toISOString() ?? null
      }}
    />
  );
  const existing = await prisma.documentRegistry.findFirst({ where: { entity: "STATEMENT", entityId: statementId, docTypeId: "statement" } });
  if (existing) return;
  const { randomBytes } = await import("node:crypto");
  const storageKey = randomBytes(16).toString("hex");
  const { storage } = await import("@/lib/storage");
  await storage.put(storageKey, buffer);
  const doc = await prisma.documentRegistry.create({
    data: {
      docTypeId: "statement",
      entity: "STATEMENT",
      entityId: statementId,
      fileName: `statement-${st.code}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      storageKey,
      version: 1,
      propertyId: st.propertyId,
      notes: `Owner statement ${st.code} (${st.month})`
    }
  });
  await prisma.ownerStatement.update({ where: { id: statementId }, data: { statementDocId: doc.id } });
}
