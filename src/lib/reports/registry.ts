/// M26 Reports — registry. Every report declares the ledger/query source its
/// numbers trace to (§M26 acceptance: "every report number traces to a
/// ledger/query source") — the UI renders the source line under each report.

export type ReportCategory = "ops" | "finance";

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ReportDef {
  key: string;
  title: string;
  category: ReportCategory;
  /// What the numbers trace to (shown in UI + PDF footer).
  source: string;
  /// Accepts from/to date filters (else as-of now).
  dateFiltered: boolean;
  columns: ReportColumn[];
}

export const REPORTS: ReportDef[] = [
  {
    key: "occupancy",
    title: "Occupancy",
    category: "ops",
    source: "Room table — counts by property / floor / type and status (room state machine)",
    dateFiltered: false,
    columns: [
      { key: "property", label: "Property" },
      { key: "floor", label: "Floor" },
      { key: "type", label: "Type" },
      { key: "rooms", label: "Rooms", numeric: true },
      { key: "occupied", label: "Occupied", numeric: true },
      { key: "vacant", label: "Vacant", numeric: true },
      { key: "other", label: "Res/Clean/Maint", numeric: true },
      { key: "occupancyPct", label: "Occupancy %", numeric: true }
    ]
  },
  {
    key: "rent-roll",
    title: "Rent roll",
    category: "ops",
    source: "Lease table — active/notice leases, rentAmountMinor and nextBillingDate",
    dateFiltered: false,
    columns: [
      { key: "lease", label: "Lease" },
      { key: "member", label: "Member" },
      { key: "property", label: "Property" },
      { key: "room", label: "Room" },
      { key: "status", label: "Status" },
      { key: "rentMinor", label: "Monthly rent", numeric: true },
      { key: "cycleDay", label: "Cycle day", numeric: true },
      { key: "nextBilling", label: "Next billing" }
    ]
  },
  {
    key: "collections-arrears",
    title: "Collections & arrears aging",
    category: "finance",
    source: "Collections = confirmed PaymentAllocations in the period = Σ ledger credits to 1300 Rent Receivable (refType payment). Arrears = open invoices bucketed by due-date age; Σ buckets = Σ open amountDueMinor",
    dateFiltered: true,
    columns: [
      { key: "bucket", label: "Aging bucket" },
      { key: "invoices", label: "Invoices", numeric: true },
      { key: "amountMinor", label: "Outstanding", numeric: true }
    ]
  },
  {
    key: "overdue-not-paid",
    title: "Overdue & not paid (rent)",
    category: "finance",
    source: "Invoice — open rent line items (issued/partial_paid/overdue) with amountDueMinor > 0; dueDate < today = overdue. Σ rows = Σ open rent dues (traceable to the 1300 Rent Receivable ledger balance)",
    dateFiltered: false,
    columns: [
      { key: "invoice", label: "Invoice" },
      { key: "member", label: "Member" },
      { key: "property", label: "Property" },
      { key: "lease", label: "Lease" },
      { key: "rentMinor", label: "Rent due", numeric: true },
      { key: "dueDate", label: "Due date" },
      { key: "daysLate", label: "Days late", numeric: true },
      { key: "dunningStage", label: "Dunning", numeric: true },
      { key: "status", label: "Status" }
    ]
  },
  {
    key: "move-pipeline",
    title: "Move-in / move-out pipeline",
    category: "ops",
    source: "Lease (draft/notice), MemberProfile (prospect/verified), RoomMove (requested) counts",
    dateFiltered: false,
    columns: [
      { key: "stage", label: "Pipeline stage" },
      { key: "count", label: "Count", numeric: true },
      { key: "detail", label: "Detail" }
    ]
  },
  {
    key: "maintenance-kpis",
    title: "Maintenance KPIs",
    category: "ops",
    source: "MaintenanceTicket — SLA % = tickets resolved by slaDueAt ÷ resolved; open aging by created date",
    dateFiltered: true,
    columns: [
      { key: "status", label: "Status" },
      { key: "tickets", label: "Tickets", numeric: true },
      { key: "slaBreached", label: "SLA breached", numeric: true },
      { key: "avgAgeDays", label: "Avg age (d)", numeric: true }
    ]
  },
  {
    key: "complaint-kpis",
    title: "Complaint KPIs",
    category: "ops",
    source: "Complaint — status counts, SLA breaches, average member rating",
    dateFiltered: true,
    columns: [
      { key: "status", label: "Status" },
      { key: "complaints", label: "Complaints", numeric: true },
      { key: "slaBreached", label: "SLA breached", numeric: true },
      { key: "avgRating", label: "Avg rating", numeric: true }
    ]
  },
  {
    key: "pnl",
    title: "Profit & Loss",
    category: "finance",
    source: "Ledger — Σ 4xxx credits (revenue), 5xxx debits (expenses) and 3900 debits (owner payouts), refType payout reversed excluded; identical to the M20 P&L",
    dateFiltered: true,
    columns: [
      { key: "line", label: "Line" },
      { key: "amountMinor", label: "Amount", numeric: true }
    ]
  },
  {
    key: "expense-vs-budget",
    title: "Expense vs budget",
    category: "finance",
    source: "ExpenseBudget vs approved Expense register amounts per category/month",
    dateFiltered: true,
    columns: [
      { key: "category", label: "Category" },
      { key: "budgetMinor", label: "Budget", numeric: true },
      { key: "actualMinor", label: "Actual", numeric: true },
      { key: "varianceMinor", label: "Variance", numeric: true }
    ]
  },
  {
    key: "owner-statement-history",
    title: "Owner statement history",
    category: "finance",
    source: "OwnerStatement table (§M24) — owners see their own contracts only (R(own))",
    dateFiltered: false,
    columns: [
      { key: "code", label: "Statement" },
      { key: "owner", label: "Owner" },
      { key: "month", label: "Month" },
      { key: "status", label: "Status" },
      { key: "netMinor", label: "Net payout", numeric: true },
      { key: "paidVia", label: "Paid via" }
    ]
  },
  {
    key: "pos-sales",
    title: "POS sales",
    category: "finance",
    source: "PosSale table per day and property (all settle methods incl. room_charge)",
    dateFiltered: true,
    columns: [
      { key: "day", label: "Day" },
      { key: "property", label: "Property" },
      { key: "sales", label: "Sales", numeric: true },
      { key: "totalMinor", label: "Total", numeric: true },
      { key: "roomChargeMinor", label: "of room charge", numeric: true }
    ]
  },
  {
    key: "stock-valuation",
    title: "Stock valuation",
    category: "finance",
    source: "StockItem — Σ qtyMilli × avgCostMilli ÷ 10⁹ = value (moving average, M15)",
    dateFiltered: false,
    columns: [
      { key: "property", label: "Property" },
      { key: "item", label: "Item" },
      { key: "qty", label: "Qty", numeric: true },
      { key: "unit", label: "Unit" },
      { key: "avgCostMinor", label: "Avg cost/unit", numeric: true },
      { key: "valueMinor", label: "Value", numeric: true }
    ]
  },
  {
    key: "attendance-summary",
    title: "Attendance summary",
    category: "ops",
    source: "AttendanceRecord — days worked, minutes and overtime per staff in the period",
    dateFiltered: true,
    columns: [
      { key: "staff", label: "Staff" },
      { key: "days", label: "Days worked", numeric: true },
      { key: "minutes", label: "Minutes", numeric: true },
      { key: "overtimeMinutes", label: "Overtime min", numeric: true }
    ]
  }
];

export const REPORT_BY_KEY = new Map(REPORTS.map((r) => [r.key, r]));
