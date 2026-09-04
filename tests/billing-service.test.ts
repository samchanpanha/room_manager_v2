/**
 * Billing service (M07) — DB-backed tests against a disposable COPY of the
 * seeded database. Run with:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/billing-service.test.ts
 * (see package.json script `test:billing`). PDF bytes are not written — the
 * storage adapter is mocked; documentRegistry rows still prove the filing path.
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
import {
  applyLateFees,
  computePendingPeriods,
  createCreditNote,
  generateInvoices,
  runDunning,
  voidInvoice
} from "@/lib/billing/service";
import { ledgerIntegrity, memberStatement, postTransaction, reverseTransaction, trialBalance } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";
import type { InvoiceStatus } from "@/lib/billing/machines";

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

let actor: { id: string; name: string };
let leaseCode: string;
let stubId = "";
let sepId = "";
// Baseline ledger state (vitest file order is not guaranteed — other DB
// suites may have posted before this file runs; the ledger is append-only).
let ledgerTxsBase = 0;
let recvBase = 0;
let rentRevBase = 0;
let svcRevBase = 0;
let chanRecvBase = 0;

beforeAll(async () => {
  // Self-clean any billing state so the suite is deterministic even against a
  // stale copy (InvoiceItems cascade with their invoice; credit notes first).
  await prisma.creditNote.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.numberSequence.deleteMany({
    where: { OR: [{ key: { startsWith: "INV:" } }, { key: "CREDITNOTE" }] }
  });
  await prisma.documentRegistry.deleteMany({ where: { entity: "INVOICE" } });
  await prisma.auditLog.deleteMany({
    where: { entityType: { in: ["invoice", "invoice_status", "invoice_late_fee", "invoice_dunning", "credit_note"] } }
  });
  await prisma.domainEvent.deleteMany({
    where: {
      type: {
        in: ["invoice.issued", "invoice.late_fee_applied", "invoice.dunning_reminder", "invoice.voided", "credit_note.issued"]
      }
    }
  });

  const tbBase = await trialBalance();
  const baseByCode = new Map(tbBase.rows.map((r) => [r.code, r]));
  ledgerTxsBase = (await ledgerIntegrity()).transactions;
  recvBase = baseByCode.get(ACC.RENT_RECEIVABLE)?.balance ?? 0;
  rentRevBase = baseByCode.get(ACC.RENT_REVENUE)?.balance ?? 0;
  svcRevBase = baseByCode.get(ACC.SERVICE_REVENUE)?.balance ?? 0;
  const chanBase = await prisma.memberProfile.findFirst({ where: { party: { name: { contains: "Chan" } } } });
  chanRecvBase = chanBase ? (await memberStatement(chanBase.id)).receivableMinor : 0;

  const root = await prisma.user.findFirst({ where: { email: "root@demo.test" } });
  if (!root) throw new Error("seed user missing — is this the copied dev.db?");
  actor = { id: root.id, name: root.name };
  const lease = await prisma.lease.findUnique({
    where: { code: "LSE-0001" },
    include: { room: { include: { floor: { include: { building: { include: { property: true } } } } } } }
  });
  if (!lease) throw new Error("LSE-0001 missing");
  leaseCode = lease.room.floor.building.property.code;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("computePendingPeriods (pure)", () => {
  it("chains mid-month start → stub → full periods up to today", () => {
    const periods = computePendingPeriods({ startDate: D("2026-08-15"), billingCycleDay: 1 }, null, D("2026-09-02"));
    expect(periods).toHaveLength(2);
    expect(periods[0].start.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(periods[0].end.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(periods[1].start.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(periods[1].end.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("continues from the last invoice's period end", () => {
    const periods = computePendingPeriods({ startDate: D("2026-08-15"), billingCycleDay: 1 }, D("2026-10-01"), D("2026-10-20"));
    expect(periods).toEqual([{ start: D("2026-10-01"), end: D("2026-11-01") }]);
  });

  it("generates nothing when the lease has not started yet", () => {
    expect(computePendingPeriods({ startDate: D("2026-10-15"), billingCycleDay: 1 }, null, D("2026-09-02"))).toEqual([]);
  });
});

describe("generateInvoices", () => {
  it("bills the active lease (catch-up stub + September) and skips draft leases", async () => {
    const summary = await generateInvoices(actor);
    expect(summary.generated).toBe(2);
    expect(summary.skipped).toBe(0);

    const invoices = await prisma.invoice.findMany({
      where: { lease: { code: "LSE-0001" } },
      include: { items: true },
      orderBy: { periodStart: "asc" }
    });
    expect(invoices).toHaveLength(2);

    const [stub, sep] = invoices;
    stubId = stub.id;
    sepId = sep.id;

    // stub Aug 15 → Sep 1: rent 25000×17/31 = 13710 + WiFi 823 = 14533
    expect(stub.periodStart.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(stub.subtotalMinor).toBe(14533);
    expect(stub.totalMinor).toBe(14533);
    expect(stub.status).toBe("issued");
    expect(stub.amountDueMinor).toBe(14533);
    expect(stub.items.some((i) => i.kind === "rent" && i.amountMinor === 13710)).toBe(true);
    expect(stub.items.some((i) => i.kind === "service" && i.amountMinor === 823)).toBe(true);
    expect(stub.items.find((i) => i.kind === "rent")?.name).toContain("17/31");
    // due date = today when the period start is in the past
    expect(stub.dueDate?.toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));

    // September: full cycle (25000 + 1500), no proration label
    expect(sep.totalMinor).toBe(26500);
    expect(sep.items.find((i) => i.kind === "rent")?.name).not.toContain("prorated");

    // gapless per-property numbering, allocated in period order
    expect(stub.code).toBe(`${leaseCode}-2026-0001`);
    expect(sep.code).toBe(`${leaseCode}-2026-0002`);
    // PDFs filed to M17 on generation
    for (const inv of invoices) {
      const doc = await prisma.documentRegistry.findFirst({ where: { entity: "INVOICE", entityId: inv.id, docTypeId: "invoice" } });
      expect(doc).toBeTruthy();
      expect(doc?.version).toBe(1);
    }
  });

  it("is idempotent — re-runs create no duplicates", async () => {
    const again = await generateInvoices(actor);
    expect(again.generated).toBe(0);
    // catch-up chains from the LAST invoice (periodEnd Oct 1 → future), so a
    // settled book has nothing pending at all; the count below is the guarantee
    expect(again.skipped).toBe(0);
    const count = await prisma.invoice.count({ where: { lease: { code: "LSE-0001" } } });
    expect(count).toBe(2);
  });

  it("skips draft leases (LSE-0002 is not billed)", async () => {
    const draftLease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-0002" } });
    const count = await prisma.invoice.count({ where: { leaseId: draftLease.id } });
    expect(count).toBe(0);
  });
});

describe("late fees (M06 daily job)", () => {
  it("applies once per invoice after the grace window, then never again", async () => {
    // Age the stub's due date to exactly 13 days before today (UTC midnight
    // arithmetic — date-rot-proof): stage 2 on the +3/+7/+14 ladder.
    const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const due13 = new Date(todayUtc.getTime() - 13 * 86_400_000);
    await prisma.invoice.update({ where: { id: stubId }, data: { dueDate: due13 } });

    const first = await applyLateFees(actor);
    expect(first.applied).toBe(1);

    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId }, include: { items: true } });
    const feeItems = stub.items.filter((i) => i.kind === "late_fee");
    expect(feeItems).toHaveLength(1);
    expect(feeItems[0].amountMinor).toBe(500); // FIXED rule $5
    // invariant survives the fee: total = Σitems − discount + tax
    const sum = stub.items.reduce((s, i) => s + i.amountMinor, 0);
    expect(stub.totalMinor).toBe(sum - stub.discountMinor + stub.taxMinor);
    expect(stub.amountDueMinor).toBe(stub.totalMinor - stub.amountPaidMinor - stub.amountCreditedMinor);

    const second = await applyLateFees(actor);
    expect(second.applied).toBe(0); // once-only
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId }, include: { items: true } });
    expect(after.items.filter((i) => i.kind === "late_fee")).toHaveLength(1);

    // fresh invoices inside the grace window are untouched (Sep invoice due today)
    const sep = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId }, include: { items: true } });
    expect(sep.items.filter((i) => i.kind === "late_fee")).toHaveLength(0);
  });
});

describe("dunning ladder (M06 daily job)", () => {
  it("marks overdue and advances stage 2 (13 days past due on +3/+7/+14)", async () => {
    const run = await runDunning(actor);
    expect(run.overdueMarked).toBe(1);
    expect(run.remindersSent).toBe(1);

    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId } });
    expect(stub.status).toBe("overdue");
    expect(stub.dunningStage).toBe(2); // day 13 ≥ 3 and ≥ 7, < 14

    // settled September invoice is not dunned
    const sep = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    expect(sep.dunningStage).toBe(0);
  });

  it("does not repeat reminders at the same stage", async () => {
    const rerun = await runDunning(actor);
    expect(rerun.overdueMarked).toBe(0);
    expect(rerun.remindersSent).toBe(0);
  });
});

describe("credit notes", () => {
  it("rejects credits exceeding the outstanding due", async () => {
    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId } });
    const result = await createCreditNote(stubId, stub.amountDueMinor + 1, "too much", actor);
    expect(result).toMatchObject({ ok: false, code: "EXCEEDS_DUE" });
  });

  it("credits reduce amount due without touching items; full credit settles the invoice", async () => {
    const stub = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId }, include: { items: true } });
    const due = stub.amountDueMinor;
    const itemsBefore = JSON.stringify(stub.items.map((i) => [i.kind, i.amountMinor]));

    const result = await createCreditNote(stubId, due, "goodwill — move-out compensation", actor);
    expect(result).toMatchObject({ ok: true, code: "CN-0001", invoiceStatus: "paid" });

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: stubId }, include: { items: true } });
    expect(after.amountCreditedMinor).toBe(due);
    expect(after.amountDueMinor).toBe(0);
    expect(after.status).toBe("paid");
    expect(JSON.stringify(after.items.map((i) => [i.kind, i.amountMinor]))).toBe(itemsBefore); // §9.3 immutability
  });

  it("rejects non-positive amounts and settled invoices", async () => {
    expect(await createCreditNote(stubId, 100, "on paid invoice", actor)).toMatchObject({ ok: false, code: "INVALID_STATUS" });
    expect(await createCreditNote(sepId, 0, "zero", actor)).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
    expect(await createCreditNote(sepId, -5, "negative", actor)).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
  });
});

describe("void → re-bill", () => {
  it("voids with mandatory reason (due zeroed, document kept) and blocks terminal transitions", async () => {
    const ok = await voidInvoice(sepId, "member gave notice before period start", actor);
    expect(ok).toMatchObject({ ok: true });

    const voided = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    expect(voided.status).toBe("void");
    expect(voided.voidReason).toContain("notice");
    expect(voided.amountDueMinor).toBe(0);
    expect(voided.code).toBe(`${leaseCode}-2026-0002`); // number stays consumed

    const doubleVoid = await voidInvoice(sepId, "again", actor);
    expect(doubleVoid).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("regenerates the voided period with the NEXT gapless number", async () => {
    const summary = await generateInvoices(actor);
    expect(summary.generated).toBe(1);

    const regenerated = summary.invoices[0];
    expect(regenerated.code).toBe(`${leaseCode}-2026-0003`);
    expect(regenerated.totalMinor).toBe(26500); // September again, same composition

    const seq = await prisma.numberSequence.findUniqueOrThrow({ where: { key: `INV:${leaseCode}:2026` } });
    expect(seq.value).toBe(3);
    const live = await prisma.invoice.findFirst({ where: { lease: { code: "LSE-0001" }, periodStart: D("2026-09-01"), status: { not: "void" } } });
    expect(live?.id).toBe(regenerated.id);
  });
});

describe("state machine gates inside the service", () => {
  it("refuses to issue/credit a void or paid invoice via the service layer", async () => {
    const { issueInvoice } = await import("@/lib/billing/service");
    const sep = await prisma.invoice.findUniqueOrThrow({ where: { id: sepId } });
    expect(sep.status as InvoiceStatus).toBe("void");
    expect(await issueInvoice(sepId, actor)).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });
});


// ─────────────────────── M08 Ledger ───────────────────────
// Runs AFTER the billing flow above. Ledger state at this point:
// 3 issue postings (stub 14533, sep 26500, regenerated 26500) + 1 late fee
// (500) + 1 credit note (150.33) + 1 void reversal (sep issue) = 6 postings.
describe("ledger postings from the billing flow (M08)", () => {
  it("posted every domain fact and the books balance", async () => {
    const integrity = await ledgerIntegrity();
    expect(integrity.transactions).toBe(ledgerTxsBase + 6); // +3 issues +late fee +credit note +void reversal over the baseline
    expect(integrity.balanced).toBe(true);
    expect(integrity.totalDebit).toBe(integrity.totalCredit);
  });

  it("mapped the invoice composition onto the chart exactly", async () => {
    const tb = await trialBalance();
    const byCode = new Map(tb.rows.map((r) => [r.code, r]));
    // the only live invoice is the regenerated September (rent 25000 + WiFi 1500)
    expect(byCode.get(ACC.RENT_RECEIVABLE)?.balance).toBe(recvBase + 26500);
    expect(byCode.get(ACC.RENT_REVENUE)?.balance).toBe(rentRevBase + 25000);
    expect(byCode.get(ACC.SERVICE_REVENUE)?.balance).toBe(svcRevBase + 1500);
    expect(byCode.get(ACC.LATE_FEE_REVENUE)?.balance).toBe(0); // the full credit reversed the fee too (pro-rata across live postings)
    expect(tb.balanced).toBe(true);
  });

  it("kept the member statement running balance consistent", async () => {
    const member = await prisma.memberProfile.findFirstOrThrow({ where: { party: { name: { contains: "Chan" } } } });
    const statement = await memberStatement(member.id);
    expect(statement.receivableMinor).toBe(chanRecvBase + 26500);
    const running = statement.rows.reduce(
      (sum, r) => sum + r.entries.filter((e) => e.code === ACC.RENT_RECEIVABLE).reduce((s, e) => s + e.debit - e.credit, 0),
      0
    );
    expect(running).toBe(statement.receivableMinor);
    const last = statement.rows[statement.rows.length - 1];
    expect(last.receivableAfter).toBe(statement.receivableMinor);
  });

  it("rejects unbalanced postings, unknown accounts and double reversals", async () => {
    await expect(
      postTransaction(prisma, {
        memo: "broken",
        refType: "adjustment",
        lines: [
          { code: ACC.RENT_RECEIVABLE, debit: 100, credit: 0 },
          { code: ACC.RENT_REVENUE, debit: 0, credit: 99 }
        ]
      })
    ).rejects.toThrowError(/Σ debits/);

    await expect(
      postTransaction(prisma, {
        memo: "bad account",
        refType: "adjustment",
        lines: [
          { code: "9999", debit: 100, credit: 0 },
          { code: ACC.RENT_REVENUE, debit: 0, credit: 100 }
        ]
      })
    ).rejects.toThrowError(/unknown or inactive account/);

    const voidTx = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { refType: "invoice_void" },
      include: { reversalOf: true }
    });
    expect(voidTx.reversalOfId).toBeTruthy();
    await expect(
      reverseTransaction(prisma, voidTx.reversalOf!.id, { memo: "double reversal", refType: "invoice_void" })
    ).rejects.toThrowError(/already reversed/);
  });

  it("enforces append-only at the DB level (triggers reject UPDATE/DELETE)", async () => {
    const entry = await prisma.ledgerEntry.findFirstOrThrow();
    await expect(prisma.ledgerEntry.update({ where: { id: entry.id }, data: { memo: "tampered" } })).rejects.toThrow();
    await expect(prisma.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow();
    const tx = await prisma.ledgerTransaction.findFirstOrThrow();
    await expect(prisma.ledgerTransaction.update({ where: { id: tx.id }, data: { memo: "tampered" } })).rejects.toThrow();
    await expect(prisma.ledgerTransaction.delete({ where: { id: tx.id } })).rejects.toThrow();
    const after = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(after.memo).toBe(tx.memo); // untouched
  });
});
