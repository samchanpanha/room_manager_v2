/// M26 report builders — every number comes from an existing table or ledger
/// account (sources declared in the registry). Rows are flat records so the
/// table UI, CSV and PDF exports share one shape.
import { prisma } from "@/lib/db";
import { ACC } from "@/lib/ledger/accounts";
import { profitAndLoss } from "@/lib/operations/expenses-service";
import { REPORT_BY_KEY } from "./registry";

export interface ReportRow {
  [key: string]: string | number | null;
}

export interface ReportResult {
  key: string;
  title: string;
  source: string;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: ReportRow[];
  summary: ReportRow;
  asOf: string;
  from?: string;
  to?: string;
}

export interface ReportFilters {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD (inclusive)
  propertyId?: string | null;
  month?: string; // YYYY-MM (P&L)
}

const DAY = 24 * 60 * 60 * 1000;

function parseDate(v: string | undefined, endOfDay = false): Date | undefined {
  if (!v) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return endOfDay ? new Date(d.getTime() + DAY - 1) : d;
}

const money = (minor: number) => minor / 100; // rows carry minor units; exports format

export async function runReport(key: string, filters: ReportFilters, scope: { global: boolean; propertyIds: string[]; ownerProfileId?: string }): Promise<ReportResult | null> {
  const def = REPORT_BY_KEY.get(key);
  if (!def) return null;
  // GLOBAL callers may pass an empty list — resolve to all active properties
  // so ledger-based reports (P&L, collections) see the whole portfolio.
  const effectiveIds =
    scope.propertyIds.length > 0
      ? scope.propertyIds
      : scope.global
        ? (await prisma.property.findMany({ where: { status: "active" }, select: { id: true } })).map((p) => p.id)
        : [];
  const propertyIds = filters.propertyId ? (effectiveIds.includes(filters.propertyId) ? [filters.propertyId] : ["__out_of_scope__"]) : effectiveIds;
  const from = parseDate(filters.from);
  const to = parseDate(filters.to, true);

  let rows: ReportRow[] = [];
  const summary: ReportRow = {};

  switch (key) {
    case "occupancy": {
      const rooms = await prisma.room.findMany({
        where: propertyIds.length > 0 ? { floor: { building: { propertyId: { in: propertyIds } } } } : { id: { in: [] } },
        select: { type: true, status: true, floor: { select: { name: true, building: { select: { name: true, property: { select: { name: true } } } } } } }
      });
      type GroupKey = string;
      const groups = new Map<GroupKey, { property: string; floor: string; type: string; rooms: number; occupied: number; vacant: number; other: number }>();
      for (const r of rooms) {
        const k = `${r.floor.building.property.name}|${r.floor.building.name} · ${r.floor.name}|${r.type}`;
        const g = groups.get(k) ?? { property: r.floor.building.property.name, floor: `${r.floor.building.name} · ${r.floor.name}`, type: r.type, rooms: 0, occupied: 0, vacant: 0, other: 0 };
        g.rooms += 1;
        if (r.status === "occupied") g.occupied += 1;
        else if (r.status === "vacant") g.vacant += 1;
        else g.other += 1;
        groups.set(k, g);
      }
      rows = [...groups.values()]
        .sort((a, b) => a.property.localeCompare(b.property) || a.floor.localeCompare(b.floor) || a.type.localeCompare(b.type))
        .map((g) => ({
          property: g.property,
          floor: g.floor,
          type: g.type,
          rooms: g.rooms,
          occupied: g.occupied,
          vacant: g.vacant,
          other: g.other,
          occupancyPct: g.rooms === 0 ? 0 : Math.round((g.occupied / g.rooms) * 100)
        }));
      const totalRooms = rows.reduce((s, r) => s + Number(r.rooms), 0);
      const totalOccupied = rows.reduce((s, r) => s + Number(r.occupied), 0);
      summary.totalRooms = totalRooms;
      summary.totalOccupied = totalOccupied;
      summary.occupancyPct = totalRooms === 0 ? 0 : Math.round((totalOccupied / totalRooms) * 100);
      break;
    }

    case "rent-roll": {
      const leases = await prisma.lease.findMany({
        where: { status: { in: ["active", "notice"] }, propertyId: { in: propertyIds } },
        orderBy: { code: "asc" },
        select: {
          code: true,
          status: true,
          rentAmountMinor: true,
          billingCycleDay: true,
          nextBillingDate: true,
          member: { include: { party: { select: { name: true } } } },
          property: { select: { name: true } },
          room: { select: { number: true } }
        }
      });
      rows = leases.map((l) => ({
        lease: l.code,
        member: l.member.party.name,
        property: l.property.name,
        room: l.room.number,
        status: l.status,
        rentMinor: money(l.rentAmountMinor),
        cycleDay: l.billingCycleDay,
        nextBilling: l.nextBillingDate?.toISOString().slice(0, 10) ?? "—"
      }));
      summary.leases = rows.length;
      summary.monthlyRentMinor = money(leases.reduce((s, l) => s + l.rentAmountMinor, 0));
      break;
    }

    case "collections-arrears": {
      // Collections (period) — traceable to the ledger: Σ confirmed payment
      // allocations in the window == Σ credits to 1300 from refType "payment".
      const collWhere = {
        payment: {
          status: "confirmed",
          confirmedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 1) } : {}) },
          propertyId: { in: propertyIds }
        }
      };
      const coll = await prisma.paymentAllocation.aggregate({ where: collWhere, _sum: { amountMinor: true } });
      const collectionsMinor = coll._sum.amountMinor ?? 0;

      const recv = await prisma.ledgerAccount.findUnique({ where: { code: ACC.RENT_RECEIVABLE }, select: { id: true } });
      let ledgerCredits = 0;
      if (recv) {
        // Pair each payment transaction with its Payment (refId) and count only
        // credits for payments that are still confirmed — refund reversals and
        // payments removed during reconciliation cleanup drop out of both sides.
        const confirmedIds = new Set(
          (await prisma.payment.findMany({ where: { status: "confirmed", propertyId: { in: propertyIds } }, select: { id: true } })).map((p) => p.id)
        );
        const entries = await prisma.ledgerEntry.findMany({
          where: {
            accountId: recv.id,
            transaction: {
              refType: "payment",
              reversalOfId: null,
              postedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 1) } : {}) },
              propertyId: { in: propertyIds }
            }
          },
          select: { credit: true, transaction: { select: { refId: true } } }
        });
        ledgerCredits = entries.reduce(
          (s, e) => s + (e.transaction.refId && confirmedIds.has(e.transaction.refId) ? e.credit : 0),
          0
        );
      }

      // Arrears aging (as-of now) — buckets MUST sum to Σ open dues.
      const open = await prisma.invoice.findMany({
        where: {
          status: { in: ["issued", "partial_paid", "overdue"] },
          amountDueMinor: { gt: 0 },
          propertyId: { in: propertyIds }
        },
        select: { amountDueMinor: true, dueDate: true }
      });
      const now = Date.now();
      const buckets: Array<{ bucket: string; invoices: number; amountMinor: number }> = [
        { bucket: "current (not due)", invoices: 0, amountMinor: 0 },
        { bucket: "1–30 days", invoices: 0, amountMinor: 0 },
        { bucket: "31–60 days", invoices: 0, amountMinor: 0 },
        { bucket: "61–90 days", invoices: 0, amountMinor: 0 },
        { bucket: "90+ days", invoices: 0, amountMinor: 0 }
      ];
      for (const inv of open) {
        const ageDays = inv.dueDate ? Math.floor((now - inv.dueDate.getTime()) / DAY) : -1;
        const idx = ageDays <= 0 ? 0 : ageDays <= 30 ? 1 : ageDays <= 60 ? 2 : ageDays <= 90 ? 3 : 4;
        buckets[idx]!.invoices += 1;
        buckets[idx]!.amountMinor += inv.amountDueMinor;
      }
      rows = buckets.map((b) => ({ bucket: b.bucket, invoices: b.invoices, amountMinor: money(b.amountMinor) }));
      summary.collectionsMinor = money(collectionsMinor);
      summary.ledgerCollectionsMinor = money(ledgerCredits);
      summary.arrearsMinor = money(open.reduce((s, i) => s + i.amountDueMinor, 0));
      summary.bucketsSumMinor = money(buckets.reduce((s, b) => s + b.amountMinor, 0));
      summary.reconciles = summary.arrearsMinor === summary.bucketsSumMinor ? "yes" : "NO";
      break;
    }

    case "overdue-not-paid": {
      // Rent invoices overdue & unpaid (as-of now). Only invoices carrying a
      // rent line item count — deposits and one-off charges are excluded.
      const now = Date.now();
      const invs = await prisma.invoice.findMany({
        where: {
          status: { in: ["issued", "partial_paid", "overdue"] },
          amountDueMinor: { gt: 0 },
          dueDate: { lt: new Date(now) },
          propertyId: { in: propertyIds },
          isDeposit: false
        },
        include: {
          member: { include: { party: true, leases: { where: { status: { in: ["active", "notice"] } }, select: { code: true }, take: 1 } } },
          property: true,
          items: { where: { kind: "rent" }, select: { kind: true }, take: 1 }
        },
        orderBy: { dueDate: "asc" }
      });
      rows = invs
        .filter((i) => i.items.length > 0 && i.dueDate)
        .map((i) => ({
          invoice: i.code,
          member: i.member.party.name,
          property: i.property.name,
          lease: i.member.leases[0]?.code ?? "—",
          rentMinor: money(i.amountDueMinor),
          dueDate: i.dueDate!.toISOString().slice(0, 10),
          daysLate: Math.floor((now - i.dueDate!.getTime()) / DAY),
          dunningStage: i.dunningStage,
          status: i.status
        }));
      summary.invoices = rows.length;
      summary.overdueMinor = money(invs.filter((i) => i.items.length > 0 && i.dueDate).reduce((s, i) => s + i.amountDueMinor, 0));
      const maxLate = rows.reduce((m, r) => Math.max(m, Number(r.daysLate)), 0);
      summary.oldestInvoiceDaysLate = rows.length === 0 ? null : maxLate;
      break;
    }

    case "move-pipeline": {
      const propFilter = { propertyId: { in: propertyIds } };
      const [drafts, notice, prospects, roomMoves] = await Promise.all([
        prisma.lease.count({ where: { ...propFilter, status: "draft" } }),
        prisma.lease.findMany({
          where: { ...propFilter, status: "notice" },
          select: { endDate: true },
          orderBy: { endDate: "asc" },
          take: 50
        }),
        prisma.memberProfile.count({ where: { status: { in: ["prospect", "verified"] }, homePropertyId: { in: propertyIds } } }),
        prisma.roomMove.count({ where: { status: "requested", fromLease: propFilter } })
      ]);
      rows = [
        { stage: "Draft leases (pending move-in)", count: drafts, detail: "activate when the member moves in" },
        { stage: "Prospect / verified members (no lease yet)", count: prospects, detail: "onboarding pipeline" },
        { stage: "Leases in notice (upcoming move-outs)", count: notice.length, detail: notice.slice(0, 5).map((l) => l.endDate?.toISOString().slice(0, 10)).filter(Boolean).join(", ") || "—" },
        { stage: "Requested room moves", count: roomMoves, detail: "awaiting approval" }
      ];
      summary.total = rows.reduce((s, r) => s + Number(r.count), 0);
      break;
    }

    case "maintenance-kpis": {
      const tickets = await prisma.maintenanceTicket.findMany({
        where: {
          propertyId: { in: propertyIds },
          ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 1) } : {}) } } : {})
        },
        select: { status: true, slaDueAt: true, createdAt: true, resolvedAt: true }
      });
      const now = Date.now();
      type G = { tickets: number; breached: number; ageSum: number };
      const groups = new Map<string, G>();
      let resolvedTotal = 0;
      let resolvedInSla = 0;
      for (const t of tickets) {
        const g = groups.get(t.status) ?? { tickets: 0, breached: 0, ageSum: 0 };
        g.tickets += 1;
        const resolvedAt: Date | null = t.resolvedAt ?? null;
        const end = resolvedAt ?? new Date();
        g.ageSum += Math.max(0, (end.getTime() - t.createdAt.getTime()) / DAY);
        const resolved = resolvedAt != null;
        const breached = (resolvedAt ?? new Date(now)).getTime() > t.slaDueAt.getTime();
        if (breached) g.breached += 1;
        if (resolved) {
          resolvedTotal += 1;
          if (!breached) resolvedInSla += 1;
        }
        groups.set(t.status, g);
      }
      rows = [...groups.entries()].map(([status, g]) => ({
        status,
        tickets: g.tickets,
        slaBreached: g.breached,
        avgAgeDays: Math.round((g.ageSum / g.tickets) * 10) / 10
      }));
      summary.slaPct = resolvedTotal === 0 ? null : Math.round((resolvedInSla / resolvedTotal) * 100);
      summary.resolved = resolvedTotal;
      summary.open = tickets.filter((t) => !t.resolvedAt).length;
      break;
    }

    case "complaint-kpis": {
      const complaints = await prisma.complaint.findMany({
        where: {
          propertyId: { in: propertyIds },
          ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 1) } : {}) } } : {})
        },
        select: { status: true, slaDueAt: true, resolvedAt: true, rating: true, createdAt: true }
      });
      const now = Date.now();
      type G = { complaints: number; breached: number; ratingSum: number; rated: number };
      const groups = new Map<string, G>();
      for (const c of complaints) {
        const g = groups.get(c.status) ?? { complaints: 0, breached: 0, ratingSum: 0, rated: 0 };
        g.complaints += 1;
        const resolvedAt: Date | null = c.resolvedAt ?? null;
        const breached = (resolvedAt ?? new Date(now)).getTime() > c.slaDueAt.getTime();
        if (breached) g.breached += 1;
        if (c.rating != null) {
          g.ratingSum += c.rating;
          g.rated += 1;
        }
        groups.set(c.status, g);
      }
      rows = [...groups.entries()].map(([status, g]) => ({
        status,
        complaints: g.complaints,
        slaBreached: g.breached,
        avgRating: g.rated === 0 ? null : Math.round((g.ratingSum / g.rated) * 10) / 10
      }));
      summary.total = complaints.length;
      const rated = complaints.filter((c) => c.rating != null);
      summary.avgRating = rated.length === 0 ? null : Math.round((rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length) * 10) / 10;
      break;
    }

    case "pnl": {
      const month = filters.month ?? new Date().toISOString().slice(0, 7);
      const propertyId = filters.propertyId && scope.propertyIds.includes(filters.propertyId) ? filters.propertyId : null;
      const pl = await profitAndLoss({ month, propertyId, scopePropertyIds: propertyIds });
      if (!pl.ok || !pl.data) throw new Error(pl.ok ? "empty P&L" : pl.message);
      const plData = pl.data;
      rows = [
        ...plData.revenue.map((r) => ({ line: `revenue · ${r.label}`, amountMinor: money(r.amountMinor) })),
        ...plData.expenses.map((e) => ({ line: `expense · ${e.label}`, amountMinor: money(e.amountMinor) })),
        { line: "owner payouts (3900 debits)", amountMinor: money(plData.payoutTotalMinor) },
        { line: "NET", amountMinor: money(plData.netMinor) }
      ];
      summary.month = month;
      summary.netIncomeMinor = money(plData.netMinor);
      summary.payoutTotalMinor = money(plData.payoutTotalMinor);
      break;
    }

    case "expense-vs-budget": {
      const month = filters.month ?? new Date().toISOString().slice(0, 7);
      const fromM = new Date(`${month}-01T00:00:00.000Z`);
      const toM = new Date(Date.UTC(fromM.getUTCFullYear(), fromM.getUTCMonth() + 1, 1));
      // budgets are per category+month (no property dimension — §M20)
      const budgets = await prisma.expenseBudget.findMany({
        where: { month },
        include: { category: { select: { name: true, propertyId: true } } }
      });
      const scopedBudgets = budgets.filter((b) => propertyIds.includes(b.category.propertyId));
      const actuals = await prisma.expense.groupBy({
        by: ["categoryId"],
        where: {
          status: "approved",
          expenseDate: { gte: fromM, lt: toM },
          propertyId: { in: propertyIds }
        },
        _sum: { amountMinor: true }
      });
      const actualByCat = new Map(actuals.map((a) => [a.categoryId, a._sum.amountMinor ?? 0]));
      const catNames = new Map(budgets.map((b) => [b.categoryId, b.category.name]));
      rows = scopedBudgets.map((b) => {
        const actual = actualByCat.get(b.categoryId) ?? 0;
        return { category: b.category.name, budgetMinor: money(b.amountMinor), actualMinor: money(actual), varianceMinor: money(b.amountMinor - actual) };
      });
      for (const [catId, amount] of actualByCat) {
        if (!catNames.has(catId)) {
          const cat = await prisma.expenseCategory.findUnique({ where: { id: catId }, select: { name: true } });
          rows.push({ category: `${cat?.name ?? catId} (no budget)`, budgetMinor: 0, actualMinor: money(amount), varianceMinor: money(-amount) });
        }
      }
      summary.month = month;
      summary.budgetMinor = money(scopedBudgets.reduce((s, b) => s + b.amountMinor, 0));
      summary.actualMinor = money([...actualByCat.values()].reduce((s, v) => s + v, 0));
      break;
    }

    case "owner-statement-history": {
      const statements = await prisma.ownerStatement.findMany({
        where: {
          ...(scope.ownerProfileId ? { ownerProfileId: scope.ownerProfileId } : {}),
          propertyId: { in: propertyIds }
        },
        orderBy: [{ month: "desc" }, { code: "asc" }],
        include: { ownerProfile: { include: { party: { select: { name: true } } } } }
      });
      rows = statements.map((s) => ({
        code: s.code,
        owner: s.ownerProfile.party.name,
        month: s.month,
        status: s.status,
        netMinor: money(s.netMinor),
        paidVia: s.paidVia ?? "—"
      }));
      summary.statements = rows.length;
      summary.netMinor = money(statements.reduce((s, x) => s + x.netMinor, 0));
      break;
    }

    case "pos-sales": {
      const sales = await prisma.posSale.findMany({
        where: {
          propertyId: { in: propertyIds },
          ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 1) } : {}) } } : {})
        },
        select: { createdAt: true, totalMinor: true, method: true, property: { select: { name: true } } },
        orderBy: { createdAt: "asc" }
      });
      const groups = new Map<string, { day: string; property: string; sales: number; totalMinor: number; roomChargeMinor: number }>();
      for (const s of sales) {
        const day = s.createdAt.toISOString().slice(0, 10);
        const k = `${day}|${s.property.name}`;
        const g = groups.get(k) ?? { day, property: s.property.name, sales: 0, totalMinor: 0, roomChargeMinor: 0 };
        g.sales += 1;
        g.totalMinor += s.totalMinor;
        if (s.method === "room_charge") g.roomChargeMinor += s.totalMinor;
        groups.set(k, g);
      }
      rows = [...groups.values()].map((g) => ({ day: g.day, property: g.property, sales: g.sales, totalMinor: money(g.totalMinor), roomChargeMinor: money(g.roomChargeMinor) }));
      summary.sales = sales.length;
      summary.totalMinor = money(sales.reduce((s, x) => s + x.totalMinor, 0));
      break;
    }

    case "stock-valuation": {
      const items = await prisma.stockItem.findMany({
        where: { isActive: true, propertyId: { in: propertyIds } },
        include: { property: { select: { name: true } } },
        orderBy: [{ propertyId: "asc" }, { name: "asc" }]
      });
      rows = items.map((i) => ({
        property: i.property.name,
        item: i.name,
        qty: i.qtyMilli / 1000,
        unit: i.unit,
        avgCostMinor: i.avgCostMilli / 1000,
        valueMinor: Math.round((i.qtyMilli * i.avgCostMilli) / 1_000_000)
      }));
      summary.items = rows.length;
      summary.valueMinor = money(items.reduce((s, i) => s + Math.round((i.qtyMilli * i.avgCostMilli) / 1_000_000), 0));
      break;
    }

    case "attendance-summary": {
      const records = await prisma.attendanceRecord.findMany({
        where: {
          propertyId: { in: propertyIds },
          ...(from || to ? { workDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 1) } : {}) } } : {})
        },
        select: { minutesWorked: true, overtimeMinutes: true, user: { select: { name: true } } }
      });
      const groups = new Map<string, { staff: string; days: number; minutes: number; overtimeMinutes: number }>();
      for (const r of records) {
        const g = groups.get(r.user.name) ?? { staff: r.user.name, days: 0, minutes: 0, overtimeMinutes: 0 };
        g.days += 1;
        g.minutes += r.minutesWorked ?? 0;
        g.overtimeMinutes += r.overtimeMinutes ?? 0;
        groups.set(r.user.name, g);
      }
      rows = [...groups.values()].sort((a, b) => b.minutes - a.minutes);
      summary.staff = rows.length;
      summary.minutes = rows.reduce((s, r) => s + Number(r.minutes), 0);
      break;
    }

    default:
      return null;
  }

  return {
    key: def.key,
    title: def.title,
    source: def.source,
    columns: def.columns,
    rows,
    summary,
    asOf: new Date().toISOString(),
    ...(def.dateFiltered ? { from: filters.from, to: filters.to } : {})
  };
}

export interface DashboardKpis {
  occupancyPct: number;
  billedMinor: number;
  collectedMinor: number;
  arrearsMinor: number;
  openTickets: number;
  cashPositionMinor: number;
  month: string;
}

/// §M26 dashboard KPIs — occupancy %, collected vs billed, arrears total,
/// open tickets, cash position. Sources: Room table; invoices issued this
/// month; confirmed allocations (ledger-traceable, see collections-arrears);
/// open invoice dues; open MaintenanceTickets; 1100+1200 ledger balances.
export async function getDashboardKpis(scope: { global: boolean; propertyIds: string[] }, month?: string): Promise<DashboardKpis> {
  const m = month ?? new Date().toISOString().slice(0, 7);
  const from = new Date(`${m}-01T00:00:00.000Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const propWhere = scope.global ? {} : { propertyId: { in: scope.propertyIds } };

  const [rooms, billed, collected, arrears, openTickets, cash] = await Promise.all([
    prisma.room.groupBy({ by: ["status"], _count: true, where: scope.global ? {} : { floor: { building: propWhere } } }),
    prisma.invoice.aggregate({ where: { ...propWhere, issuedAt: { gte: from, lt: to }, status: { notIn: ["draft", "void"] } }, _sum: { totalMinor: true } }),
    prisma.paymentAllocation.aggregate({ where: { payment: { status: "confirmed", confirmedAt: { gte: from, lt: to }, ...(scope.global ? {} : propWhere) } }, _sum: { amountMinor: true } }),
    prisma.invoice.aggregate({ where: { ...propWhere, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } }, _sum: { amountDueMinor: true } }),
    prisma.maintenanceTicket.count({ where: { ...propWhere, status: { in: ["open", "assigned", "in_progress"] } } }),
    prisma.ledgerEntry.groupBy({ by: ["accountId"], where: { account: { code: { in: [ACC.CASH, ACC.BANK] } } }, _sum: { debit: true, credit: true } })
  ]);

  const totalRooms = rooms.reduce((s, r) => s + r._count, 0);
  const occupied = rooms.find((r) => r.status === "occupied")?._count ?? 0;
  const cashMinor = cash.reduce((s, c) => s + (c._sum.debit ?? 0) - (c._sum.credit ?? 0), 0);

  return {
    occupancyPct: totalRooms === 0 ? 0 : Math.round((occupied / totalRooms) * 100),
    billedMinor: (billed._sum.totalMinor ?? 0) / 100,
    collectedMinor: (collected._sum.amountMinor ?? 0) / 100,
    arrearsMinor: (arrears._sum.amountDueMinor ?? 0) / 100,
    openTickets,
    cashPositionMinor: cashMinor / 100,
    month: m
  };
}
