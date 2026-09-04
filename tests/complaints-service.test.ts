/**
 * M22 complaints service (§M22 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/complaints-service.test.ts
 *
 * Acceptance flow: member files a complaint in the portal → acknowledged
 * within SLA → in_progress (comment thread) → resolved by staff → member
 * confirms and rates 5 → closed with the full thread; second complaint
 * converts one-click to a maintenance ticket (matrix row 13 cross-link).
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
import { createComplaint, transitionComplaint, addComplaintComment, convertComplaintToTicket } from "@/lib/operations/complaints-service";
import { escalateSlaBreaches } from "@/lib/operations/maintenance-service";

let actor = { id: "", name: "" };
let memberProfileId = "";
let runnable = false;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  const member = await prisma.memberProfile.findFirstOrThrow({ where: { party: { email: "sophea.nuon@example.test" } } });
  memberProfileId = member.id;

  // clean this suite's prior rows (complaints may carry ticket links)
  await prisma.complaintComment.deleteMany({ where: { complaint: { memberProfileId: member.id } } }).catch(() => undefined);
  const old = await prisma.complaint.findMany({ where: { memberProfileId: member.id }, select: { id: true, ticketId: true } });
  const ticketIds = old.map((c) => c.ticketId).filter((v): v is string => !!v);
  await prisma.complaint.deleteMany({ where: { memberProfileId: member.id } }).catch(() => undefined);
  const tickets = await prisma.maintenanceTicket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, leaseId: true } });
  await prisma.inspectionFinding.deleteMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } }).catch(() => undefined);
  await prisma.maintenanceCost.deleteMany({ where: { ticketId: { in: tickets.map((t) => t.id) } } }).catch(() => undefined);
  await prisma.maintenanceTicket.deleteMany({ where: { id: { in: tickets.map((t) => t.id) } } }).catch(() => undefined);
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M22 complaint lifecycle", () => {
  let complaintId = "";

  it("member files own complaint (portal, medium → SLA +72h)", async (ctx) => {
    if (!runnable) ctx.skip();
    const foreign = await createComplaint(
      { memberProfileId, category: "noise", priority: "medium", subject: "Loud renovations at 7am", description: "Next-door unit drills every morning", source: "portal" },
      actor,
      "test",
      { ownMemberId: "someone-else" }
    );
    expect(foreign).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const created = await createComplaint(
      { memberProfileId, category: "noise", priority: "medium", subject: "Loud renovations at 7am", description: "Next-door unit drills every morning", source: "portal" },
      actor,
      "test",
      { ownMemberId: memberProfileId }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    complaintId = created.data.id;
    expect(created.data.code).toMatch(/^CMP-\d{4}-/);
    const row = await prisma.complaint.findUniqueOrThrow({ where: { id: complaintId } });
    expect(row.status).toBe("new");
    expect(row.source).toBe("portal");
    const due = row.slaDueAt.getTime() - Date.now();
    expect(due).toBeGreaterThan(71 * 3_600_000);
    expect(due).toBeLessThanOrEqual(72 * 3_600_000);
  });

  it("machine guards: cannot resolve a brand-new complaint", async (ctx) => {
    if (!runnable) ctx.skip();
    const early = await transitionComplaint(complaintId, "resolved", { resolutionNote: "talked to them" }, actor, "test");
    expect(early).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("acknowledged within SLA → in_progress with comment thread → resolved", async (ctx) => {
    if (!runnable) ctx.skip();
    expect((await transitionComplaint(complaintId, "acknowledged", {}, actor, "test")).ok).toBe(true);
    const ack = await prisma.complaint.findUniqueOrThrow({ where: { id: complaintId } });
    expect(ack.status).toBe("acknowledged");
    expect(ack.assignedToId).toBe(actor.id);
    expect(ack.slaBreachedAt).toBeNull(); // acknowledged inside the window

    const c1 = await addComplaintComment(complaintId, { body: "Renovation hours confirmed 8:00–17:00, we spoke with the unit owner" }, actor, "test");
    expect(c1.ok).toBe(true);
    const c2 = await addComplaintComment(complaintId, { body: "Thank you — it continued after 17:00 yesterday", byMember: true }, actor, "test", { ownMemberId: memberProfileId });
    expect(c2.ok).toBe(true);

    const memberForeignComment = await addComplaintComment(complaintId, { body: "not my complaint" }, actor, "test", { ownMemberId: "someone-else" });
    expect(memberForeignComment).toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect((await transitionComplaint(complaintId, "in_progress", {}, actor, "test")).ok).toBe(true);
    const noNote = await transitionComplaint(complaintId, "resolved", {}, actor, "test");
    expect(noNote).toMatchObject({ ok: false, code: "RESOLUTION_REQUIRED" });
    expect((await transitionComplaint(complaintId, "resolved", { resolutionNote: "quiet hours agreed and posted" }, actor, "test")).ok).toBe(true);
  });

  it("only the member can close; rating 1–5 required; full thread visible", async (ctx) => {
    if (!runnable) ctx.skip();
    const staffClose = await transitionComplaint(complaintId, "closed", { rating: 5 }, actor, "test");
    expect(staffClose).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const noRating = await transitionComplaint(complaintId, "closed", {}, actor, "test", { ownMemberId: memberProfileId });
    expect(noRating).toMatchObject({ ok: false, code: "RATING_REQUIRED" });

    const badRating = await transitionComplaint(complaintId, "closed", { rating: 6 }, actor, "test", { ownMemberId: memberProfileId });
    expect(badRating).toMatchObject({ ok: false, code: "RATING_REQUIRED" });

    const closed = await transitionComplaint(complaintId, "closed", { rating: 5, ratingNote: "sorted quickly" }, actor, "test", { ownMemberId: memberProfileId });
    expect(closed.ok).toBe(true);

    const row = await prisma.complaint.findUniqueOrThrow({ where: { id: complaintId }, include: { comments: { orderBy: { createdAt: "asc" } } } });
    expect(row.status).toBe("closed");
    expect(row.rating).toBe(5);
    expect(row.ratingNote).toBe("sorted quickly");
    expect(row.comments).toHaveLength(2); // staff + member
    expect(row.comments.map((c) => c.byMember)).toEqual([false, true]);
  });

  it("one-click conversion to a maintenance ticket (matrix row 13)", async (ctx) => {
    if (!runnable) ctx.skip();
    const created = await createComplaint(
      { memberProfileId, category: "facility", priority: "high", subject: "Corridor light flickering", description: "Floor 2 corridor light strobes at night", source: "portal" },
      actor,
      "test",
      { ownMemberId: memberProfileId }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const cid = created.data.id;

    const converted = await convertComplaintToTicket(cid, { category: "electrical" }, actor, "test");
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.data.ticketCode).toMatch(/^TK-\d{4}-/);

    const row = await prisma.complaint.findUniqueOrThrow({ where: { id: cid }, include: { ticket: true, comments: true } });
    expect(row.ticket?.category).toBe("electrical");
    expect(row.ticket?.priority).toBe("high");
    expect(row.comments.some((c) => c.body.includes(converted.data.ticketCode))).toBe(true);

    const again = await convertComplaintToTicket(cid, {}, actor, "test");
    expect(again).toMatchObject({ ok: false, code: "TICKET_EXISTS" });

    const sla = new Date(Date.now() + 8 * 86_400_000);
    const sweep = await escalateSlaBreaches(actor, sla);
    expect(sweep.complaints).toBeGreaterThanOrEqual(1); // this new complaint is still "new" and aged past due
    const breached = await prisma.complaint.findUniqueOrThrow({ where: { id: cid } });
    expect(breached.slaBreachedAt).not.toBeNull();
  });
});
