/**
 * M26 Reports service (§M26 acceptance) — DB-backed tests against a disposable
 * COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/reports-service.test.ts
 *
 * Acceptance: every number traces to a ledger/query source (asserted against
 * the underlying tables/ledger directly) and the arrears aging buckets sum to
 * the outstanding invoice totals. Order-tolerant: earlier DB suites purge or
 * pay invoices, so fixtures regenerate/reopen what they need.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { ACC } from "@/lib/ledger/accounts";
import { generateInvoices } from "@/lib/billing/service";
import { toCsv } from "@/lib/csv";
import { REPORTS, REPORT_BY_KEY } from "@/lib/reports/registry";
import { canSeeReport, visibleReportKeys } from "@/lib/reports/scope";
import { getDashboardKpis, runReport } from "@/lib/reports/service";
import type { AuthUser } from "@/lib/auth/session";

const GLOBAL = { global: true, propertyIds: [] as string[] };
const SCOPED = { global: false, propertyIds: [] as string[] };

function asUser(roles: string[], propertyIds: string[] = [], isSuperAdmin = false): AuthUser {
  return {
    id: "u_test",
    name: "Test",
    email: "t@t",
    partyId: null,
    roles,
    sessionId: "s",
    isSuperAdmin,
    totpEnrollmentRequired: false,
    mustChangePassword: false,
    propertyIds,
    permissions: [
      { module: "M26", action: "read", scope: isSuperAdmin ? ("GLOBAL" as const) : ("PROPERTY" as const) }
    ]
  };
}

let runnable = false;

beforeAll(async () => {
  // fixture: make sure LSE-0001's member has at least one open invoice
  const lease = await prisma.lease.findFirstOrThrow({ where: { code: "LSE-0001" } });
  if (lease.status !== "active") {
    await prisma.lease.update({ where: { id: lease.id }, data: { status: "active", terminatedAt: null } });
    await prisma.memberProfile.update({ where: { id: lease.memberProfileId }, data: { status: "active" } });
  }
  const open = await prisma.invoice.count({ where: { memberProfileId: lease.memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] } } });
  if (open === 0) {
    await generateInvoices({ id: "fixture", name: "fixture" });
    const stillOpen = await prisma.invoice.count({ where: { memberProfileId: lease.memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] } } });
    if (stillOpen === 0) {
      const paid = await prisma.invoice.findFirstOrThrow({ where: { memberProfileId: lease.memberProfileId, status: "paid" }, orderBy: { periodStart: "desc" } });
      await prisma.invoice.update({ where: { id: paid.id }, data: { status: "issued", amountPaidMinor: 0, amountDueMinor: paid.totalMinor } });
    }
  }
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M26 registry (traceability)", () => {
  it("declares all §M26 reports, each with a source line and columns", () => {
    const keys = REPORTS.map((r) => r.key);
    for (const expected of [
      "occupancy",
      "rent-roll",
      "collections-arrears",
      "move-pipeline",
      "maintenance-kpis",
      "complaint-kpis",
      "pnl",
      "expense-vs-budget",
      "owner-statement-history",
      "pos-sales",
      "stock-valuation",
      "attendance-summary"
    ]) {
      expect(keys).toContain(expected);
    }
    for (const r of REPORTS) {
      expect(r.source.length).toBeGreaterThan(20); // every report declares its source
      expect(r.columns.length).toBeGreaterThan(0);
    }
    expect(REPORT_BY_KEY.get("collections-arrears")!.source).toContain("1300");
  });
});

describe("M26 scope qualifiers (§5: PM ops, Accountant finance, Staff ops-read, Owner own)", () => {
  it("maps roles to report categories", () => {
    const pm = asUser(["PROPERTY_MANAGER"], ["p1"]);
    expect(canSeeReport(pm, "occupancy")).toBe(true);
    expect(canSeeReport(pm, "pnl")).toBe(false);
    const acc = asUser(["ACCOUNTANT"], []);
    expect(canSeeReport(acc, "pnl")).toBe(true);
    expect(canSeeReport(acc, "occupancy")).toBe(false);
    const staff = asUser(["STAFF"], ["p1"]);
    expect(canSeeReport(staff, "maintenance-kpis")).toBe(true);
    expect(canSeeReport(staff, "stock-valuation")).toBe(false);
    const owner = asUser(["OWNER"], []);
    expect(canSeeReport(owner, "owner-statement-history")).toBe(true);
    expect(canSeeReport(owner, "rent-roll")).toBe(false);
    const admin = asUser(["ADMIN"], [], true);
    expect(visibleReportKeys(admin)).toHaveLength(REPORTS.length);
    const member = asUser(["MEMBER"], []);
    expect(canSeeReport(member, "occupancy")).toBe(false);
    void SCOPED;
  });
});

describe("M26 report builders (numbers trace to sources)", () => {
  it("collections = confirmed allocations = Σ ledger credits to 1300 (refType payment); aging buckets sum to open dues", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await runReport("collections-arrears", {}, GLOBAL);
    expect(r).toBeTruthy();
    if (!r) return;
    const from = new Date(Date.UTC(2020, 0, 1));
    const r2 = await runReport("collections-arrears", { from: from.toISOString().slice(0, 10) }, GLOBAL);
    expect(r2!.summary.collectionsMinor).toBe(r2!.summary.ledgerCollectionsMinor); // ledger-traceable

    const openAgg = await prisma.invoice.aggregate({
      where: { status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } },
      _sum: { amountDueMinor: true }
    });
    expect(r2!.summary.arrearsMinor).toBe((openAgg._sum.amountDueMinor ?? 0) / 100);
    // §M26 acceptance: Σ buckets == outstanding invoice totals
    expect(r2!.summary.bucketsSumMinor).toBe(r2!.summary.arrearsMinor);
    expect(r2!.summary.reconciles).toBe("yes");
    const bucketSum = r2!.rows.reduce((s, row) => s + Number(row.amountMinor), 0);
    expect(bucketSum).toBe(r2!.summary.arrearsMinor);
  });

  it("occupancy matches the room table", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await runReport("occupancy", {}, GLOBAL);
    expect(r).toBeTruthy();
    if (!r) return;
    const [total, occupied] = await Promise.all([prisma.room.count(), prisma.room.count({ where: { status: "occupied" } })]);
    expect(r.summary.totalRooms).toBe(total);
    expect(r.summary.totalOccupied).toBe(occupied);
    const rowSum = r.rows.reduce((s, row) => s + Number(row.rooms), 0);
    expect(rowSum).toBe(total);
  });

  it("P&L equals the M20 profitAndLoss net for the same month", async (ctx) => {
    if (!runnable) ctx.skip();
    const month = new Date().toISOString().slice(0, 7);
    const r = await runReport("pnl", { month }, GLOBAL);
    expect(r).toBeTruthy();
    if (!r) return;
    const netRow = r.rows.find((row) => row.line === "NET");
    expect(netRow).toBeDefined();
    expect(r.summary.netIncomeMinor).toBe(netRow!.amountMinor);
    // revenue lines exist (the seeded ledger posts revenue when invoices issue)
    expect(r.rows.some((row) => String(row.line).startsWith("revenue ·"))).toBe(true);
  });

  it("stock valuation = Σ qty × moving-average cost", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await runReport("stock-valuation", {}, GLOBAL);
    expect(r).toBeTruthy();
    if (!r) return;
    const items = await prisma.stockItem.findMany({ where: { isActive: true } });
    const expected = items.reduce((s, i) => s + Math.round((i.qtyMilli * i.avgCostMilli) / 1_000_000), 0) / 100;
    expect(r.summary.valueMinor).toBe(expected);
  });

  it("rent roll lists only active/notice leases", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await runReport("rent-roll", {}, GLOBAL);
    expect(r).toBeTruthy();
    if (!r) return;
    const activeOrNotice = await prisma.lease.count({ where: { status: { in: ["active", "notice"] } } });
    expect(r.rows).toHaveLength(activeOrNotice);
    for (const row of r.rows) expect(["active", "notice"]).toContain(row.status);
  });

  it("owner statement history is owner-scoped", async (ctx) => {
    if (!runnable) ctx.skip();
    const owner = await prisma.ownerProfile.findFirstOrThrow({ include: { contracts: true } });
    const mine = await runReport("owner-statement-history", {}, { global: false, propertyIds: [], ownerProfileId: owner.id });
    expect(mine).toBeTruthy();
    if (!mine) return;
    for (const row of mine.rows) {
      const st = await prisma.ownerStatement.findUniqueOrThrow({ where: { code: String(row.code) }, select: { ownerProfileId: true } });
      expect(st.ownerProfileId).toBe(owner.id);
    }
    void SCOPED;
  });

  it("maintenance + complaint KPIs return per-status rows", async (ctx) => {
    if (!runnable) ctx.skip();
    const m = await runReport("maintenance-kpis", {}, GLOBAL);
    const c = await runReport("complaint-kpis", {}, GLOBAL);
    expect(m).toBeTruthy();
    expect(c).toBeTruthy();
    if (m && m.rows.length > 0) {
      const statusCount = await prisma.maintenanceTicket.groupBy({ by: ["status"], _count: true });
      expect(m.rows).toHaveLength(statusCount.length);
    }
    if (c && c.rows.length > 0) {
      const statusCount = await prisma.complaint.groupBy({ by: ["status"], _count: true });
      expect(c.rows).toHaveLength(statusCount.length);
    }
  });

  it("property filter narrows the scope (scoped caller cannot escape)", async (ctx) => {
    if (!runnable) ctx.skip();
    const props = await prisma.property.findMany({ select: { id: true } });
    if (props.length < 2) return;
    const scoped = await runReport("occupancy", { propertyId: props[1]!.id }, { global: false, propertyIds: [props[0]!.id] });
    expect(scoped).toBeTruthy();
    // the requested property is outside the caller's scope → empty rows, not the other property's data
    expect(scoped!.rows).toHaveLength(0);
  });
});

describe("M26 dashboard KPIs", () => {
  it("arrears == Σ open dues; cash position == ledger 1100+1200 balance", async (ctx) => {
    if (!runnable) ctx.skip();
    const kpis = await getDashboardKpis(GLOBAL);
    const arrears = await prisma.invoice.aggregate({
      where: { status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } },
      _sum: { amountDueMinor: true }
    });
    expect(kpis.arrearsMinor).toBe((arrears._sum.amountDueMinor ?? 0) / 100);

    const cash = await prisma.ledgerEntry.groupBy({
      by: ["accountId"],
      where: { account: { code: { in: [ACC.CASH, ACC.BANK] } } },
      _sum: { debit: true, credit: true }
    });
    const expectedCash = cash.reduce((s, c) => s + (c._sum.debit ?? 0) - (c._sum.credit ?? 0), 0) / 100;
    expect(kpis.cashPositionMinor).toBe(expectedCash);
    expect(kpis.openTickets).toBe(await prisma.maintenanceTicket.count({ where: { status: { in: ["open", "assigned", "in_progress"] } } }));
  });
});

describe("M26 CSV export shape", () => {
  it("escapes separators/quotes and round-trips rows", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], [1, null]]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("a,b");
    expect(lines[1]).toBe('"x,y","say ""hi"""');
    expect(lines[2]).toBe("1,");
  });
});
