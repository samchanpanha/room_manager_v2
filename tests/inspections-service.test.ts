/**
 * M18 inspections service (§M18 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/inspections-service.test.ts
 *
 * Self-contained fixture: lease LSE-INSPTEST (David Cruz, room A2-01) with a held
 * 500.00 deposit. Flow: move_in inspection completes with a major finding →
 * move_out inspection with photo-backed damage → finding → M19 ticket
 * (cross-link) and → M10 deduction proposal → approved deduction (matrix row
 * 13). Also proves the §15 v1.1 hard gate: a lease cannot end without a
 * completed move-out inspection (LSE-GATETEST).
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
import { createInspection, completeInspection, openFindingTicket, proposeFindingDeduction, approveFindingDeduction, dismissFindingDeduction } from "@/lib/operations/inspections-service";
import { endLease } from "@/lib/leases/service";

let actor = { id: "", name: "" };
let leaseId = "";
let gateLeaseId = "";
let propertyId = "";
let runnable = false;

async function cleanFixtureData(leaseIds: string[], memberId: string): Promise<void> {
  const inspections = await prisma.inspection.findMany({ where: { leaseId: { in: leaseIds } }, select: { id: true } });
  const inspIds = inspections.map((i) => i.id);
  await prisma.documentRegistry.deleteMany({ where: { entity: "INSPECTION" } }).catch(() => undefined);
  await prisma.deposit.updateMany({ where: { leaseId: { in: leaseIds } }, data: { invoiceId: null } }).catch(() => undefined);
  await prisma.complaintComment.deleteMany({ where: { complaint: { memberProfileId: memberId } } }).catch(() => undefined);
  await prisma.complaint.deleteMany({ where: { memberProfileId: memberId } }).catch(() => undefined);
  await prisma.inspectionFinding.deleteMany({ where: { inspectionId: { in: inspIds } } }).catch(() => undefined);
  await prisma.inspection.deleteMany({ where: { leaseId: { in: leaseIds } } }).catch(() => undefined);
  const tickets = await prisma.maintenanceTicket.findMany({ where: { leaseId: { in: leaseIds } }, select: { id: true } });
  await prisma.maintenanceCost.deleteMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } }).catch(() => undefined);
  await prisma.maintenanceTicket.deleteMany({ where: { leaseId: { in: leaseIds } } }).catch(() => undefined);
  const auditIds = [...inspIds, ...tickets.map((t) => t.id)];
  await prisma.auditLog.deleteMany({ where: { entityType: { in: ["inspection", "inspection_finding", "maintenance_ticket", "complaint"] }, entityId: { in: auditIds } } }).catch(() => undefined);
}

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };

  const member = await prisma.memberProfile.findFirstOrThrow({ where: { party: { email: "david.cruz@example.test" } } });
  const property = await prisma.property.findUniqueOrThrow({ where: { code: "BLR" } });
  const floor = await prisma.floor.findFirstOrThrow({ where: { name: "Floor 2", building: { name: "Building A" } } });
  const roomA201 = await prisma.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor.id, number: "A2-01" } } });
  const roomA203 = await prisma.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor.id, number: "A2-03" } } });
  propertyId = property.id;

  await cleanFixtureData([roomA201.id, roomA203.id], member.id);

  const start = new Date(Date.UTC(2026, 7, 1));
  const lease = await prisma.lease.upsert({
    where: { code: "LSE-INSPTEST" },
    create: {
      code: "LSE-INSPTEST",
      memberProfileId: member.id,
      roomId: roomA201.id,
      propertyId: property.id,
      status: "active",
      startDate: start,
      rentAmountMinor: 18_000,
      billingCycleDay: 1,
      prorationBasis: "calendar",
      depositTotalMinor: 50_000,
      depositInstallments: 1,
      noticeDays: 30
    },
    update: { status: "active", terminatedAt: null, terminationReason: null, moveOutInspectionId: null, roomId: roomA201.id }
  });
  const gateLease = await prisma.lease.upsert({
    where: { code: "LSE-GATETEST" },
    create: {
      code: "LSE-GATETEST",
      memberProfileId: member.id,
      roomId: roomA203.id,
      propertyId: property.id,
      status: "active",
      startDate: start,
      rentAmountMinor: 18_000,
      billingCycleDay: 1,
      prorationBasis: "calendar",
      depositTotalMinor: 0,
      depositInstallments: 0,
      noticeDays: 30
    },
    update: { status: "active", terminatedAt: null, terminationReason: null, moveOutInspectionId: null, roomId: roomA203.id }
  });
  await prisma.room.update({ where: { id: roomA201.id }, data: { status: "occupied" } });
  await prisma.room.update({ where: { id: roomA203.id }, data: { status: "occupied" } });
  await prisma.memberProfile.update({ where: { id: member.id }, data: { status: "active" } });
  await prisma.deposit.upsert({
    where: { leaseId: lease.id },
    create: { leaseId: lease.id, memberProfileId: member.id, propertyId: property.id, requiredMinor: 50_000, status: "held" },
    update: { status: "held" }
  });
  // Deposit collections ride the invoice pipeline (M10): a paid `deposit`
  // invoice is what makes the 500.00 deductible.
  const depInvoice = await prisma.invoice.upsert({
    where: { code: "BLR-TEST-INSP-DEP" },
    update: { status: "paid", amountPaidMinor: 50_000, amountDueMinor: 0 },
    create: {
      code: "BLR-TEST-INSP-DEP",
      propertyId: property.id,
      leaseId: lease.id,
      memberProfileId: member.id,
      status: "paid",
      isDeposit: true,
      issuedAt: new Date(),
      periodStart: new Date(Date.UTC(2026, 7, 1)),
      periodEnd: new Date(Date.UTC(2026, 7, 2)),
      dueDate: new Date(Date.UTC(2026, 7, 1)),
      subtotalMinor: 50_000,
      totalMinor: 50_000,
      amountPaidMinor: 50_000,
      amountDueMinor: 0,
      createdById: actor.id,
      items: { create: { name: "Security deposit", kind: "deposit", qty: 1, unitMinor: 50_000, amountMinor: 50_000 } }
    }
  });
  await prisma.deposit.update({ where: { leaseId: lease.id }, data: { invoiceId: depInvoice.id } });
  // Deposit movements are append-only (Phase 10 trigger) — re-runs top the
  // collected amount back up so exactly 500.00 is always deductible.
  const held = await prisma.deposit.findUniqueOrThrow({ where: { leaseId: lease.id }, include: { transactions: true } });
  const released = held.transactions.reduce((sum, t) => sum + t.amountMinor, 0);
  await prisma.invoice.update({ where: { code: "BLR-TEST-INSP-DEP" }, data: { amountPaidMinor: 50_000 + released } });

  leaseId = lease.id;
  gateLeaseId = gateLease.id;
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M18 inspections + cross-links", () => {
  it("v1.1 hard gate: ending a lease without a completed move-out inspection is blocked", async (ctx) => {
    if (!runnable) ctx.skip();
    const blocked = await endLease(gateLeaseId, "completed", null);
    expect(blocked).toMatchObject({ ok: false, code: "MOVE_OUT_INSPECTION_REQUIRED" });
  });

  let moveInId = "";
  let moveOutId = "";

  it("move-in inspection completes with score, findings and an auto-filed PDF", async (ctx) => {
    if (!runnable) ctx.skip();
    const created = await createInspection({ type: "move_in", leaseId, note: "check-in walk" }, actor, "test");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    moveInId = created.data.id;

    const done = await completeInspection(
      moveInId,
      {
        items: [
          { section: "Door & locks", item: "Door closes and locks", result: "pass" },
          { section: "Walls & ceiling", item: "Walls clean, no holes", result: "fail", severity: "major", note: "scuff near wardrobe" },
          { section: "Electrical", item: "Lights work", result: "pass" },
          { section: "Metering", item: "Electric meter reading recorded", result: "na" }
        ],
        summaryNote: "minor wall scuff"
      },
      actor,
      "test"
    );
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.data.overallScore).toBe(67); // 2 passes / 3 applicable (the NA item doesn't count)
    expect(done.data.findings).toBe(1);

    const row = await prisma.inspection.findUniqueOrThrow({ where: { id: moveInId }, include: { findings: true } });
    expect(row.status).toBe("completed");
    expect(row.reportDocId).not.toBeNull(); // PDF filed to M17
    expect((await prisma.lease.findUniqueOrThrow({ where: { id: moveInId && leaseId } })).moveOutInspectionId).toBeNull(); // move_in never sets the gate link
    expect(row.findings[0]).toBeTruthy();
  });

  it("move-out photo finding → ticket cross-link + deduction proposal", async (ctx) => {
    if (!runnable) ctx.skip();
    const created = await createInspection({ type: "move_out", leaseId }, actor, "test");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    moveOutId = created.data.id;

    // evidence document the finding (and later the M10 deduction) points to
    const doc = await prisma.documentRegistry.create({
      data: {
        docTypeId: "other",
        entity: "INSPECTION",
        entityId: moveOutId,
        fileName: "damage-photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1234,
        storageKey: `test-damage-photo-${Date.now()}`,
        propertyId
      }
    });

    const done = await completeInspection(
      moveOutId,
      {
        items: [
          { section: "Walls & ceiling", item: "Walls clean, no holes", result: "fail", severity: "critical", note: "hole + broken lamp", photoDocId: doc.id },
          { section: "Safety", item: "Smoke detector works", result: "pass" }
        ]
      },
      actor,
      "test"
    );
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.data.findings).toBe(1);

    const lease = await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } });
    expect(lease.moveOutInspectionId).toBe(moveOutId); // v1.1 gate link set

    const findings = await prisma.inspectionFinding.findMany({ where: { inspectionId: moveOutId } });
    const damage = findings[0]!;

    // propose (move_out only) → approve in M10
    const tooEarly = await approveFindingDeduction(damage.id, {}, actor, "test");
    expect(tooEarly).toMatchObject({ ok: false, code: "NO_PROPOSAL" });

    const proposed = await proposeFindingDeduction(damage.id, { amountMinor: 15_000, reason: "damage" }, actor, "test");
    expect(proposed.ok).toBe(true);

    // M10 settles only from move-out (notice/completed/terminated)
    await prisma.lease.update({ where: { id: leaseId }, data: { status: "notice" } });
    const approved = await approveFindingDeduction(damage.id, { reason: "damage" }, actor, "test");
    if (!approved.ok) throw new Error(`approve failed: ${approved.code} — ${approved.message}`);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.data.remainingMinor).toBe(35_000); // 500.00 held − 150.00 deduction

    const after = await prisma.inspectionFinding.findUniqueOrThrow({ where: { id: damage.id } });
    expect(after.deductionStatus).toBe("approved");
    expect(after.deductionTxId).not.toBeNull();
    const ledgerTx = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "deposit_deduction", refId: (await prisma.deposit.findUniqueOrThrow({ where: { leaseId } })).id } });
    const debits = (await prisma.ledgerEntry.findMany({ where: { transactionId: ledgerTx.id } })).reduce((s, e) => s + e.debit, 0);
    const credits = (await prisma.ledgerEntry.findMany({ where: { transactionId: ledgerTx.id } })).reduce((s, e) => s + e.credit, 0);
    expect(debits).toBe(credits);
    expect(debits).toBe(15_000);
  });

  it("finding → M19 ticket (cross-link, matrix row 13)", async (ctx) => {
    if (!runnable) ctx.skip();
    const findings = await prisma.inspectionFinding.findMany({ where: { inspectionId: moveInId } });
    const scuff = findings[0]!;
    const opened = await openFindingTicket(scuff.id, { category: "furniture" }, actor, "test");
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.data.ticketCode).toMatch(/^TK-\d{4}-/);

    const after = await prisma.inspectionFinding.findUniqueOrThrow({ where: { id: scuff.id }, include: { ticket: true } });
    expect(after.ticket?.status).toBe("open");
    expect(after.ticket?.priority).toBe("high"); // severity major → high
    expect(after.ticket?.roomId).toBe((await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } })).roomId);

    const again = await openFindingTicket(scuff.id, {}, actor, "test");
    expect(again).toMatchObject({ ok: false, code: "TICKET_EXISTS" });
  });

  it("deduction proposals dismiss cleanly; non-move-out findings cannot propose", async (ctx) => {
    if (!runnable) ctx.skip();
    const findings = await prisma.inspectionFinding.findMany({ where: { inspectionId: moveInId } });
    const scuff = findings[0]!;
    const reject = await proposeFindingDeduction(scuff.id, { amountMinor: 100 }, actor, "test");
    expect(reject).toMatchObject({ ok: false, code: "MOVE_OUT_ONLY" });

    const moveOutFindings = await prisma.inspectionFinding.findMany({ where: { inspectionId: moveOutId } });
    const damage = moveOutFindings[0]!;
    const dismissed = await dismissFindingDeduction(damage.id, "member repaired before handover", actor, "test");
    // already approved → cannot dismiss
    expect(dismissed).toMatchObject({ ok: false, code: "ALREADY_APPROVED" });
  });

  it("the gate opens: after the completed move-out inspection the lease can end", async (ctx) => {
    if (!runnable) ctx.skip();
    const gateInsp = await createInspection({ type: "move_out", leaseId: gateLeaseId }, actor, "test");
    expect(gateInsp.ok).toBe(true);
    if (!gateInsp.ok) return;
    const gateDone = await completeInspection(
      gateInsp.data.id,
      { items: [{ section: "Door & locks", item: "Door closes and locks", result: "pass" }] },
      actor,
      "test"
    );
    expect(gateDone.ok).toBe(true);
    const ended = await endLease(gateLeaseId, "completed", null);
    expect(ended.ok).toBe(true);
    const lease = await prisma.lease.findUniqueOrThrow({ where: { id: gateLeaseId } });
    expect(lease.status).toBe("completed");
    expect(lease.moveOutInspectionId).not.toBeNull();
  });

  it("audit + events recorded for the inspection lifecycle", async (ctx) => {
    if (!runnable) ctx.skip();
    const audits = await prisma.auditLog.findMany({ where: { module: "M18", entityType: "inspection", entityId: { in: [moveInId, moveOutId] } }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.action)).toEqual(["inspection.created", "inspection.completed", "inspection.created", "inspection.completed"]);
    const events = await prisma.domainEvent.findMany({ where: { type: { in: ["inspection.created", "inspection.completed"] } } });
    expect(events.length).toBeGreaterThanOrEqual(4);
  });
});
