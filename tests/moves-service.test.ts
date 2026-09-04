/**
 * M16 room moves service (§M16 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/moves-service.test.ts
 *
 * Self-contained fixture (earlier suites alphabetically mutate the seed
 * leases): a fresh active lease LSE-MOVTEST for the seeded member Sophea on
 * room A1-06 (started 10 days ago, cycle day 1, calendar basis) moving into
 * vacant A1-05, equal rents (25000) ⇒ the ONE adjustment invoice must net to
 * exactly the move fee (2000) — the pure prorated-delta acceptance.
 *
 * The execute step creates invoices/leases/ledger postings (append-only), so
 * a standalone re-run against an already-used copy skips itself (npm test
 * always starts from a fresh `cp dev.db`).
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
import { previewRoomMove, requestRoomMove, approveRoomMove, cancelRoomMove, executeRoomMove } from "@/lib/rooms/moves-service";
import { computeMoveProration } from "@/lib/rooms/moves-machine";
import { nextCycleBoundary } from "@/lib/billing/proration";
import { generateInvoices } from "@/lib/billing/service";

let actor = { id: "", name: "" };
const eff = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"); // today 00:00 UTC
const RENT = 25_000;
const FEE = 2_000;
const OLD_ROOM = "A1-06";
const NEW_ROOM = "A1-05";
let leaseId = "";
let memberId = "";
let propertyId = "";
let toRoomId = "";
let runnable = false;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };

  if (await prisma.lease.findUnique({ where: { code: "LSE-MOVTEST" } })) {
    return; // prior standalone run already executed on this copy
  }

  const member = await prisma.memberProfile.findFirstOrThrow({ where: { party: { email: "sophea.nuon@example.test" } } });
  const floor = await prisma.floor.findFirstOrThrow({ where: { name: "Floor 1", building: { name: "Building A" } } });
  const oldRoom = await prisma.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor.id, number: OLD_ROOM } } });
  const newRoom = await prisma.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor.id, number: NEW_ROOM } } });
  const property = await prisma.property.findUniqueOrThrow({ where: { code: "BLR" } });

  const start = new Date(eff.getTime() - 10 * 86_400_000);
  const lease = await prisma.lease.create({
    data: {
      code: "LSE-MOVTEST",
      memberProfileId: member.id,
      roomId: oldRoom.id,
      propertyId: property.id,
      status: "active",
      startDate: start,
      rentAmountMinor: RENT,
      billingCycleDay: 1,
      prorationBasis: "calendar",
      depositTotalMinor: 50_000,
      depositInstallments: 1,
      noticeDays: 30,
      nextBillingDate: nextCycleBoundary(start, 1)
    }
  });
  await prisma.room.update({ where: { id: oldRoom.id }, data: { status: "occupied" } });
  await prisma.room.update({ where: { id: newRoom.id }, data: { status: "vacant" } });
  await prisma.deposit.create({
    data: { leaseId: lease.id, memberProfileId: member.id, propertyId: property.id, requiredMinor: 50_000, status: "held" }
  });

  leaseId = lease.id;
  memberId = member.id;
  propertyId = property.id;
  toRoomId = newRoom.id;
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Runtime gate: `describe.skipIf` cannot see flags set in beforeAll (it is
 * evaluated at collection), so each test skips itself when the fixture was
 * not created (already-used DB copy).
 */
function ready(ctx: { skip: () => void }): void {
  if (!runnable) ctx.skip();
}

describe("M16 room move lifecycle", () => {
  let moveId = "";
  let moveCode = "";
  let newLeaseId = "";

  it("rejects a member requesting a move on someone else's lease", async (ctx) => {
    ready(ctx);
    const result = await requestRoomMove(
      { fromLeaseId: leaseId, toRoomId, effectiveAt: eff },
      actor,
      { role: "member", ownMemberId: "someone-else" },
      "test"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects executing before approval (state machine)", async (ctx) => {
    ready(ctx);
    const draft = await requestRoomMove({ fromLeaseId: leaseId, toRoomId, effectiveAt: eff, note: "moves-service.test" }, actor, { role: "staff" }, "test");
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    moveId = draft.data.id;
    moveCode = draft.data.code;

    const early = await executeRoomMove(moveId, actor, {}, "test");
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe("INVALID_TRANSITION");
  });

  it("previews the exact delta: deposit delta 0, held 50000, net = fee (equal rents)", async (ctx) => {
    ready(ctx);
    const preview = await previewRoomMove({ fromLeaseId: leaseId, toRoomId, effectiveAt: eff });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.data.oldRentMinor).toBe(25_000);
    expect(preview.data.newRentMinor).toBe(25_000); // A1-05 base price
    expect(preview.data.depositDeltaMinor).toBe(0);
    expect(preview.data.depositHeldMinor).toBe(50_000);
    const p = preview.data.proration;
    expect(p.netMinor).toBe(p.newRentChargeMinor + p.moveFeeMinor - p.oldRentCreditMinor);
    if (eff.getTime() === Date.UTC(2026, 8, 3)) {
      // canonical golden date 2026-09-03: 28/30 of September, net = the fee
      expect(p.days).toBe(28);
      expect(p.newRentChargeMinor).toBe(23_333);
      expect(p.oldRentCreditMinor).toBe(23_333);
      expect(p.moveFeeMinor).toBe(2_000);
      expect(p.netMinor).toBe(2_000);
    }
  });

  it("approve → execute: ONE adjustment invoice with the exact prorated delta", async (ctx) => {
    ready(ctx);
    const approved = await approveRoomMove(moveId, actor, "test");
    expect(approved.ok).toBe(true);

    const executed = await executeRoomMove(moveId, actor, {}, "test");
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    newLeaseId = executed.data.newLeaseId;

    const expected = computeMoveProration({
      oldRentMinor: RENT,
      newRentMinor: RENT,
      moveFeeMinor: FEE,
      effectiveAt: eff,
      periodEnd: nextCycleBoundary(eff, 1),
      prorationBasis: "calendar",
      billingCycleDay: 1
    });
    expect(executed.data.netMinor).toBe(expected.netMinor);
    expect(executed.data.invoiceCode).toMatch(/^BLR-\d{4}-/);

    // exactly ONE invoice on the new lease, covering [eff, periodEnd)
    const invoices = await prisma.invoice.findMany({ where: { leaseId: newLeaseId }, include: { items: true } });
    expect(invoices).toHaveLength(1);
    const adj = invoices[0]!;
    expect(adj.code).toBe(executed.data.invoiceCode);
    expect(adj.status).toBe("issued");
    expect(adj.periodStart.getTime()).toBe(eff.getTime());
    expect(adj.totalMinor).toBe(expected.netMinor);
    expect(adj.discountMinor).toBe(expected.oldRentCreditMinor);
    const rentLine = adj.items.find((i) => i.kind === "rent");
    const feeLine = adj.items.find((i) => i.kind === "one_time");
    expect(rentLine?.amountMinor).toBe(expected.newRentChargeMinor);
    expect(feeLine?.amountMinor).toBe(FEE);
  }, 120_000);

  it("old lease terminated, new lease active with nextBillingDate at the cycle boundary", async (ctx) => {
    ready(ctx);
    const oldLease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-MOVTEST" } });
    expect(oldLease.status).toBe("terminated");
    expect(oldLease.terminationReason).toContain(moveCode);
    expect(oldLease.nextBillingDate).toBeNull();

    const newLease = await prisma.lease.findUniqueOrThrow({ where: { id: newLeaseId } });
    expect(newLease.status).toBe("active");
    expect(newLease.rentAmountMinor).toBe(25_000);
    expect(newLease.nextBillingDate!.getTime()).toBe(nextCycleBoundary(eff, 1).getTime());
  });

  it("dual room status: old room cleaning, new room occupied", async (ctx) => {
    ready(ctx);
    const oldLease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-MOVTEST" } });
    const from = await prisma.room.findUniqueOrThrow({ where: { id: oldLease.roomId! } });
    const to = await prisma.room.findUniqueOrThrow({ where: { id: toRoomId } });
    expect(from.number).toBe(OLD_ROOM);
    expect(from.status).toBe("cleaning");
    expect(to.number).toBe(NEW_ROOM);
    expect(to.status).toBe("occupied");
  });

  it("deposit followed the member to the new lease, amount untouched", async (ctx) => {
    ready(ctx);
    const deposit = await prisma.deposit.findUniqueOrThrow({ where: { leaseId: newLeaseId } });
    expect(deposit.requiredMinor).toBe(50_000);
    expect(deposit.memberProfileId).toBe(memberId);
    expect(await prisma.deposit.findUnique({ where: { leaseId } })).toBeNull();
  });

  it("ledger balances on the adjustment transaction (debits == credits)", async (ctx) => {
    ready(ctx);
    const adj = await prisma.invoice.findFirstOrThrow({ where: { leaseId: newLeaseId } });
    const tx = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refId: adj.id }, include: { entries: true } });
    const debits = tx.entries.reduce((s, l) => s + l.debit, 0);
    const credits = tx.entries.reduce((s, l) => s + l.credit, 0);
    expect(debits).toBe(credits);
    expect(debits).toBe(adj.totalMinor);
    expect(tx.totalDebit).toBe(tx.totalCredit);
  });

  it("engine never double-bills the covered window", async (ctx) => {
    ready(ctx);
    await generateInvoices(actor, [propertyId]);
    const invoices = await prisma.invoice.findMany({ where: { leaseId: newLeaseId } });
    expect(invoices).toHaveLength(1); // still only the adjustment invoice
    const periodEnd = nextCycleBoundary(eff, 1);
    const overlap = invoices.filter((i) => i.periodStart.getTime() < periodEnd.getTime());
    expect(overlap).toHaveLength(1);
    expect(overlap[0]!.code).toBe(invoices[0]!.code);
  }, 120_000);

  it("audit trail: requested + approved + executed rows on M16", async (ctx) => {
    ready(ctx);
    const audits = await prisma.auditLog.findMany({ where: { entityType: "room_move", entityId: moveId }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.action)).toEqual(["move.requested", "move.approved", "move.executed"]);
    expect(audits.every((a) => a.module === "M16" && a.actorId === actor.id)).toBe(true);
    expect(audits[2]!.summary).toContain(moveCode);
    expect(JSON.stringify(audits[2]!.after)).toContain("invoiceCode");
    expect(JSON.stringify(audits[2]!.after)).toContain("newLeaseCode");
  });

  it("exactly one roommove.executed domain event", async (ctx) => {
    ready(ctx);
    const events = await prisma.domainEvent.findMany({ where: { type: "roommove.executed" } });
    expect(events).toHaveLength(1);
  });

  it("terminal state guards: re-execute and re-approve rejected", async (ctx) => {
    ready(ctx);
    const again = await executeRoomMove(moveId, actor, {}, "test");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("INVALID_TRANSITION");
    const reApprove = await approveRoomMove(moveId, actor, "test");
    expect(reApprove.ok).toBe(false);
  }, 60_000);

  it("cancel path: member-own request → cancel with reason → terminal, not executable", async (ctx) => {
    ready(ctx);
    const newLease = await prisma.lease.findUniqueOrThrow({ where: { id: newLeaseId } });
    const oldLease = await prisma.lease.findUniqueOrThrow({ where: { code: "LSE-MOVTEST" } });
    // positive member-portal path: the lease's own member may request (role member)
    const req = await requestRoomMove(
      { fromLeaseId: newLease.id, toRoomId: oldLease.roomId!, effectiveAt: eff, note: "moves-service.test cancel path" },
      actor,
      { role: "member", ownMemberId: memberId },
      "test"
    );
    expect(req.ok).toBe(true);
    if (!req.ok) return;
    const cancelled = await cancelRoomMove(req.data.id, "changed mind — staying put", actor, { isRequester: true }, "test");
    expect(cancelled.ok).toBe(true);
    const row = await prisma.roomMove.findUniqueOrThrow({ where: { id: req.data.id } });
    expect(row.status).toBe("cancelled");
    expect(row.cancelReason).toBe("changed mind — staying put");
    const ex = await executeRoomMove(req.data.id, actor, {}, "test");
    expect(ex.ok).toBe(false);
  }, 120_000);

  it("member timeline shows both moves; the executed one carries the invoice link", async (ctx) => {
    ready(ctx);
    const member = await prisma.memberProfile.findUniqueOrThrow({ where: { id: memberId }, include: { roomMoves: true } });
    expect(member.roomMoves.length).toBeGreaterThanOrEqual(2);
    const done = member.roomMoves.find((m) => m.status === "executed");
    expect(done?.adjustmentInvoiceId).not.toBeNull();
    expect(done?.newLeaseId).toBe(newLeaseId);
    expect(done?.netMinor).not.toBeNull();
  });
});
