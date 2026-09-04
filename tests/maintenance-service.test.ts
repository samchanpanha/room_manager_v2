/**
 * M19 maintenance service (§M19 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/maintenance-service.test.ts
 *
 * Acceptance flow: member raises a ticket for their own lease → staff assigns
 * a technician → in_progress → costs added (labor + material) → resolved with
 * a note → verified → closed; SLA breach sweep escalates an aged ticket.
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
import { createTicket, transitionTicket, addTicketCost, escalateSlaBreaches } from "@/lib/operations/maintenance-service";

let actor = { id: "", name: "" };
let leaseId = "";
let memberProfileId = "";
let runnable = false;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };

  const member = await prisma.memberProfile.findFirstOrThrow({ where: { party: { email: "sophea.nuon@example.test" } } });
  const property = await prisma.property.findUniqueOrThrow({ where: { code: "BLR" } });
  const floor = await prisma.floor.findFirstOrThrow({ where: { name: "Floor 2", building: { name: "Building A" } } });
  const room = await prisma.room.findUniqueOrThrow({ where: { floorId_number: { floorId: floor.id, number: "A2-02" } } });
  memberProfileId = member.id;

  // clean this suite's prior rows (findings/complaints may reference tickets)
  await prisma.complaintComment.deleteMany({ where: { complaint: { memberProfileId: member.id } } }).catch(() => undefined);
  await prisma.complaint.deleteMany({ where: { memberProfileId: member.id } }).catch(() => undefined);
  await prisma.inspectionFinding.deleteMany({ where: { ticket: { leaseId: room.id } } }).catch(() => undefined);
  const oldTickets = await prisma.maintenanceTicket.findMany({ where: { roomId: room.id }, select: { id: true } });
  await prisma.maintenanceCost.deleteMany({ where: { ticketId: { in: oldTickets.map((t) => t.id) } } }).catch(() => undefined);
  await prisma.maintenanceTicket.deleteMany({ where: { roomId: room.id } }).catch(() => undefined);

  const start = new Date(Date.UTC(2026, 7, 1));
  const lease = await prisma.lease.upsert({
    where: { code: "LSE-MNTTEST" },
    create: {
      code: "LSE-MNTTEST",
      memberProfileId: member.id,
      roomId: room.id,
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
    update: { status: "active", terminatedAt: null, terminationReason: null, roomId: room.id }
  });
  await prisma.room.update({ where: { id: room.id }, data: { status: "occupied" } });
  leaseId = lease.id;
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M19 ticket lifecycle", () => {
  let ticketId = "";

  it("member raises a ticket for their own lease (medium → SLA +72h)", async (ctx) => {
    if (!runnable) ctx.skip();
    const foreign = await createTicket(
      { leaseId, category: "plumbing", priority: "medium", title: "Kitchen tap drips", description: "Constant drip under the sink", source: "portal" },
      actor,
      "test",
      { ownMemberId: "someone-else" }
    );
    expect(foreign).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const created = await createTicket(
      { leaseId, category: "plumbing", priority: "medium", title: "Kitchen tap drips", description: "Constant drip under the sink", source: "portal" },
      actor,
      "test",
      { ownMemberId: memberProfileId, memberId: memberProfileId }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    ticketId = created.data.id;
    expect(created.data.code).toMatch(/^TK-\d{4}-/);
    const due = created.data.slaDueAt.getTime() - Date.now();
    expect(due).toBeGreaterThan(71 * 3_600_000);
    expect(due).toBeLessThanOrEqual(72 * 3_600_000);

    const row = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(row.status).toBe("open");
    expect(row.source).toBe("portal");
    expect(row.memberProfileId).toBe(memberProfileId);
    expect(row.roomId).toBe((await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } })).roomId);
  });

  it("machine guards: cannot start an unassigned ticket or skip to resolved", async (ctx) => {
    if (!runnable) ctx.skip();
    const early = await transitionTicket(ticketId, "resolved", { resolutionNote: "fixed" }, actor, "test");
    expect(early).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    const noAssignee = await transitionTicket(ticketId, "assigned", {}, actor, "test");
    expect(noAssignee).toMatchObject({ ok: false, code: "ASSIGNEE_REQUIRED" });
  });

  it("assign → start → costs (labor + material) → resolve → verify → close", async (ctx) => {
    if (!runnable) ctx.skip();
    expect((await transitionTicket(ticketId, "assigned", { assignedToId: actor.id }, actor, "test")).ok).toBe(true);
    expect((await transitionTicket(ticketId, "in_progress", {}, actor, "test")).ok).toBe(true);

    const cost1 = await addTicketCost(ticketId, { kind: "labor", label: "1.5h technician", amountMinor: 4500, chargeTo: "expense" }, actor, "test");
    expect(cost1).toMatchObject({ ok: true, data: { totalMinor: 4500 } });
    const stockItem = await prisma.stockItem.findFirstOrThrow({ where: { name: "Laundry detergent 1kg" } });
    const cost2 = await addTicketCost(ticketId, { kind: "material", label: "tap cartridge", amountMinor: 2500, stockItemId: stockItem.id, chargeTo: "owner" }, actor, "test");
    expect(cost2).toMatchObject({ ok: true, data: { totalMinor: 7000 } });
    const bogus = await addTicketCost(ticketId, { kind: "material", label: "ghost part", amountMinor: 100, stockItemId: "nonexistent-item", chargeTo: "owner" }, actor, "test");
    expect(bogus).toMatchObject({ ok: false, code: "STOCK_ITEM_NOT_FOUND" });

    const noNote = await transitionTicket(ticketId, "resolved", {}, actor, "test");
    expect(noNote).toMatchObject({ ok: false, code: "RESOLUTION_REQUIRED" });
    expect((await transitionTicket(ticketId, "resolved", { resolutionNote: "cartridge replaced, leak stopped" }, actor, "test")).ok).toBe(true);
    expect((await transitionTicket(ticketId, "verified", {}, actor, "test")).ok).toBe(true);
    expect((await transitionTicket(ticketId, "closed", {}, actor, "test")).ok).toBe(true);

    const row = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(row.status).toBe("closed");
    expect(row.verifiedById).toBe(actor.id);
    const costs = await prisma.maintenanceCost.findMany({ where: { ticketId } });
    expect(costs.reduce((s, c) => s + c.amountMinor, 0)).toBe(7000);
    expect(costs.find((c) => c.chargeTo === "owner")).toBeTruthy();
  });

  it("SLA sweep escalates aged open tickets and never double-flags", async (ctx) => {
    if (!runnable) ctx.skip();
    const aged = await createTicket(
      { leaseId, category: "electrical", priority: "high", title: "Bedroom outlet sparks", description: "Sparking when plugging in", source: "portal" },
      actor,
      "test",
      { ownMemberId: memberProfileId, memberId: memberProfileId }
    );
    expect(aged.ok).toBe(true);
    if (!aged.ok) return;

    const future = new Date(Date.now() + 8 * 86_400_000); // past the 24h high SLA
    const sweep = await escalateSlaBreaches(actor, future);
    expect(sweep.tickets).toBeGreaterThanOrEqual(1);

    const row = await prisma.maintenanceTicket.findUniqueOrThrow({ where: { id: aged.data.id } });
    expect(row.slaBreachedAt).not.toBeNull();
    expect(row.escalatedAt).not.toBeNull();

    const sweep2 = await escalateSlaBreaches(actor, future);
    expect(sweep2.tickets).toBe(0); // already flagged

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "maintenance_ticket", entityId: aged.data.id, action: "ticket.sla_breached" } });
    expect(audit.module).toBe("M19");
  });
});
