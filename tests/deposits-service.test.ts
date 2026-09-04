/**
 * M10 Deposits service (§M10 acceptance) — DB-backed tests against a disposable
 * COPY of the seeded database (same pattern as the billing/payments suites):
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/deposits-service.test.ts
 *
 * Golden flow: collect 500.00 in 2 installments via the deposit-kind invoice →
 * deduct 100.00 with evidence at move-out → refund the 400.00 remainder →
 * account 2100 nets to 0 for the closed lease. DepositTransaction rows are
 * append-only even in tests (DB triggers) — this suite runs once per fresh
 * copy and asserts deltas scoped to its own refTypes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import { createPayment, confirmPayment } from "@/lib/payments/service";
import { ensureDepositForLease, deductDeposit, refundDeposit, depositRemaining } from "@/lib/deposits/service";
import { endLease } from "@/lib/leases/service";
import { ledgerIntegrity } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";

let actor: { id: string; name: string };
let member = { id: "" };
let leaseId = "";
let depositId = "";
let invoiceId = "";
let evidenceDocId = "";

beforeAll(async () => {
  // Order-independent cleanup: this suite may run before OR after the billing
  // and payments suites on the shared disposable copy. Payments, allocations
  // and their invoices are append-only (Phase 8 triggers) and may already
  // exist — never delete them, just clean what this suite owns. Deposits:
  // detach leftovers (append-only transactions are tolerated) so
  // ensureDepositForLease starts fresh.
  await prisma.deposit.updateMany({ data: { invoiceId: null } });
  await prisma.depositTransaction.deleteMany().catch(() => undefined); // blocked by trigger if rows exist — tolerated
  await prisma.deposit.deleteMany().catch(() => undefined); // FK-restricted if transactions exist — tolerated
  await prisma.documentRegistry.deleteMany({ where: { entity: "LEASE" } });
  await prisma.auditLog.deleteMany({ where: { module: "M10" } });
  await prisma.domainEvent.deleteMany({
    where: { type: { in: ["deposit.billed", "deposit.deducted", "deposit.refunded"] } }
  });

  const root = await prisma.user.findFirst({ where: { email: "root@demo.test" } });
  if (!root) throw new Error("seed user missing");
  actor = { id: root.id, name: root.name };

  const lease = await prisma.lease.findUnique({ where: { code: "LSE-0001" } });
  if (!lease) throw new Error("LSE-0001 missing");
  leaseId = lease.id;
  member = { id: lease.memberProfileId };

  // M18 gate fixture (§15 v1.1): lease end requires a completed move_out
  // inspection — create this suite's own (idempotent re-run safe).
  await prisma.inspection.deleteMany({ where: { code: { startsWith: "INSP-TEST-DEP" } } }).catch(() => undefined);
  const insp = await prisma.inspection.create({
    data: {
      code: "INSP-TEST-DEP",
      type: "move_out",
      status: "completed",
      leaseId: lease.id,
      roomId: lease.roomId!,
      propertyId: lease.propertyId,
      completedAt: new Date(),
      overallScore: 90,
      items: "{}"
    }
  });
  await prisma.lease.update({ where: { id: lease.id }, data: { moveOutInspectionId: insp.id } });
});

async function suiteTxCount(refTypes: string[]): Promise<number> {
  return prisma.ledgerTransaction.count({ where: { refType: { in: refTypes } } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("§M10 acceptance: 2-installment collection → $100 evidence-backed deduction → remainder refund", () => {
  it("bills the deposit as an invoice with 2 installment lines (held in 2100)", async () => {
    const billed = await ensureDepositForLease(leaseId, actor);
    expect(billed.ok).toBe(true);
    if (!billed.ok || !billed.created) throw new Error("deposit invoice not created");
    depositId = billed.depositId;
    invoiceId = (await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } })).invoiceId as string;
    expect(billed.invoiceCode).toMatch(/^BLR-2026-\d{4}$/);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
    expect(invoice.isDeposit).toBe(true);
    expect(invoice.status).toBe("issued");
    expect(invoice.totalMinor).toBe(50000);
    expect([...invoice.items].map((i) => i.amountMinor).sort((a, b) => b - a)).toEqual([25000, 25000]);
    expect(invoice.items.every((i) => i.kind === "deposit")).toBe(true);

    const deposit = await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } });
    expect(deposit.status).toBe("billed");
    expect(deposit.requiredMinor).toBe(50000);

    // Issue posting: DR 1300 receivable / CR 2100 deposit liability
    const entries = await prisma.ledgerEntry.findMany({ where: { transaction: { refType: "deposit" } }, include: { account: true } });
    expect(entries.find((e) => e.account.code === "1300")?.debit).toBe(50000);
    expect(entries.find((e) => e.account.code === "2100")?.credit).toBe(50000);

    // Idempotent: a second call bills nothing new.
    const again = await ensureDepositForLease(leaseId, actor);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.created).toBe(false);
  });

  it("collects the deposit in 2 installments → status held", async () => {
    const rec1 = await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: 25000 });
    expect(rec1.ok).toBe(true);
    const c1 = await confirmPayment((rec1 as { paymentId: string }).paymentId, actor);
    expect(c1).toMatchObject({ ok: true, ignored: false, paymentStatus: "confirmed" });
    expect(await depositRemaining(depositId)).toBe(25000);
    // Partially collected: still "billed" — "held" means fully collected.
    expect((await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } })).status).toBe("billed");

    const rec2 = await createPayment(actor, { memberProfileId: member.id, method: "bank_transfer", amountMinor: 25000 });
    const c2 = await confirmPayment((rec2 as { paymentId: string }).paymentId, actor);
    expect(c2.ok).toBe(true);
    expect(await depositRemaining(depositId)).toBe(50000);
    expect((await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } })).status).toBe("held");

    // Deposit invoice fully paid; payment allocation went to the oldest due invoice (deposit first).
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe("paid");
  });

  it("blocks deduction while the lease is active and without evidence", async () => {
    const noEvidence = await deductDeposit(depositId, { amountMinor: 10000, reason: "damage", evidenceDocId: "no-such-doc", note: "wall damage" }, actor, "127.0.0.1");
    expect(noEvidence).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });

    const inspectionType = await prisma.docType.findUniqueOrThrow({ where: { id: "inspection_report" } });
    const doc = await prisma.documentRegistry.create({
      data: {
        docTypeId: inspectionType.id,
        entity: "LEASE",
        entityId: leaseId,
        fileName: "move-out-inspection.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageKey: `test/inspection-${Date.now()}.pdf`,
        uploadedById: actor.id
      }
    });
    evidenceDocId = doc.id;

    const active = await deductDeposit(depositId, { amountMinor: 10000, reason: "damage", evidenceDocId, note: "wall damage" }, actor, "127.0.0.1");
    expect(active).toMatchObject({ ok: false, code: "LEASE_ACTIVE" });
    expect(noEvidence).toMatchObject({ ok: false, code: "EVIDENCE_REQUIRED" });

    const tooBigActive = await deductDeposit(depositId, { amountMinor: 60000, reason: "damage", evidenceDocId, note: "wall damage" }, actor, "127.0.0.1");
    expect(tooBigActive).toMatchObject({ ok: false, code: "LEASE_ACTIVE" });

    const badReason = await deductDeposit(
      depositId,
      { amountMinor: 10000, reason: "vibes", evidenceDocId, note: "nope" },
      actor,
      "127.0.0.1"
    );
    expect(badReason).toMatchObject({ ok: false, code: "INVALID_REASON" });
  });

  it("blocks move-out while rent invoices are open (OPEN_DUES gate)", async () => {
    // Deterministic open rent invoice (suite-order independent — earlier
    // suites may have paid every generated rent invoice already).
    const lease = await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } });
    await prisma.invoice.deleteMany({ where: { code: "BLR-TEST-GATE" } }).catch(() => undefined);
    await prisma.invoice.create({
      data: {
        code: "BLR-TEST-GATE",
        propertyId: lease.propertyId,
        leaseId,
        memberProfileId: member.id,
        status: "issued",
        issuedAt: new Date(),
        periodStart: new Date("2026-08-01"),
        periodEnd: new Date("2026-08-31"),
        dueDate: new Date("2026-08-31"),
        subtotalMinor: 12345,
        totalMinor: 12345,
        amountDueMinor: 12345,
        createdById: actor.id,
        items: { create: { name: "Open rent (gate test)", kind: "rent", qty: 1, unitMinor: 12345, amountMinor: 12345 } }
      }
    });
    const open = await prisma.invoice.findFirst({ where: { leaseId, isDeposit: false, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } } });
    expect(open).not.toBeNull();
    const result = await endLease(leaseId, "completed", null);
    expect(result).toMatchObject({ ok: false, code: "OPEN_DUES" });
  });

  it("settles rent, ends the lease, deducts 100.00 with evidence", async () => {
    const openInvoices = await prisma.invoice.findMany({ where: { leaseId, isDeposit: false, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } } });
    const owed = openInvoices.reduce((s, i) => s + i.amountDueMinor, 0);
    expect(owed).toBeGreaterThan(0);
    const rec = await createPayment(actor, { memberProfileId: member.id, method: "cash", amountMinor: owed });
    const conf = await confirmPayment((rec as { paymentId: string }).paymentId, actor);
    expect(conf).toMatchObject({ ok: true, paymentStatus: "confirmed" });

    const ended = await endLease(leaseId, "completed", null);
    if (!ended.ok) throw new Error(`endLease failed: ${ended.code} — ${("message" in ended && ended.message) || ""} (owed was ${owed})`);
    expect(ended.ok).toBe(true);

    const before = await suiteTxCount(["deposit_deduction"]);
    const tooBig = await deductDeposit(depositId, { amountMinor: 60000, reason: "damage", evidenceDocId, note: "wall damage" }, actor, "127.0.0.1");
    expect(tooBig).toMatchObject({ ok: false, code: "EXCEEDS_HELD" });
    const result = await deductDeposit(depositId, { amountMinor: 10000, reason: "damage", evidenceDocId, note: "Move-out: scratched floor + broken lamp" }, actor, "127.0.0.1");
    expect(result).toMatchObject({ ok: true, remainingMinor: 40000, status: "held" });
    expect(await suiteTxCount(["deposit_deduction"])).toBe(before + 1);

    // Deduction posting: DR 2100 / CR 4900 (damage → other income) — scoped
    // to THIS deposit (other suites may deduct on their own deposits).
    const entries = await prisma.ledgerEntry.findMany({ where: { transaction: { refType: "deposit_deduction", refId: depositId } }, include: { account: true } });
    expect(entries.find((e) => e.account.code === "2100")?.debit).toBe(10000);
    expect(entries.find((e) => e.account.code === "4900")?.credit).toBe(10000);

    // Deposit moved to settled after full refund later; here it stays held — refund first.
    const deposit = await prisma.deposit.findUniqueOrThrow({ where: { id: depositId } });
    expect(["held", "settled"]).toContain(deposit.status);

    // Append-only: DepositTransaction rows reject UPDATE and DELETE.
    const tx = await prisma.depositTransaction.findFirstOrThrow({ where: { depositId, type: "deduction" } });
    await expect(prisma.depositTransaction.update({ where: { id: tx.id }, data: { amountMinor: 1 } })).rejects.toThrow();
    await expect(prisma.depositTransaction.delete({ where: { id: tx.id } })).rejects.toThrow();
  });

  it("refunds the remainder and account 2100 nets to 0", async () => {
    const before = await suiteTxCount(["deposit_refund"]);
    const result = await refundDeposit(depositId, { amountMinor: null, method: "bank_transfer", note: "Full remainder after deductions" }, actor, "127.0.0.1");
    expect(result).toMatchObject({ ok: true, remainingMinor: 0, status: "settled" });
    expect(await suiteTxCount(["deposit_refund"])).toBe(before + 1);

    // Refund posting: DR 2100 / CR 1200 bank
    const entries = await prisma.ledgerEntry.findMany({ where: { transaction: { refType: "deposit_refund" } }, include: { account: true } });
    expect(entries.find((e) => e.account.code === "2100")?.debit).toBe(40000);
    expect(entries.find((e) => e.account.code === "1200")?.credit).toBe(40000);

    // Ledger stays balanced and the deposit liability nets to zero — scoped
    // to this suite's member (other suites may legitimately hold 2100 for
    // their own deposits; order between DB suites is not guaranteed).
    const integrity = await ledgerIntegrity();
    expect(integrity.balanced).toBe(true);
    const net = await prisma.ledgerEntry.aggregate({
      where: { account: { code: ACC.DEPOSIT_LIABILITY }, memberId: member.id },
      _sum: { debit: true, credit: true }
    });
    expect((net._sum.debit ?? 0) - (net._sum.credit ?? 0)).toBe(0);

    // Settled is terminal.
    const more = await refundDeposit(depositId, { amountMinor: 100, method: "cash", note: "double refund blocked" }, actor, "127.0.0.1");
    expect(more).toMatchObject({ ok: false, code: "ALREADY_SETTLED" });
    const audit = await prisma.auditLog.findMany({ where: { module: "M10" } });
    expect(audit.map((a) => a.action).sort()).toEqual(["deposit.billed", "deposit.deducted", "deposit.refunded"]);
  });
});
