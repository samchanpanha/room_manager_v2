# Part 6 — Reports Guide

**Where:** **Insights → Reports [M26]**. Every report is filterable by **date
range** and **property**, and exports to **CSV** (RFC-4180) and branded **PDF**.

**Access:** reports require `M26` permission. GLOBAL roles (Admin/Accountant)
see everything; property managers see operational reports for their assigned
properties (financial reports per the matrix); **owners see their own statement
history**; members do not get reports (they have their portal statement).

Every report number **traces to a ledger entry or a live query** — the data is
never hand-editable. Reports configuration (which reports are enabled, who they
are assigned to, column design) lives in **Settings → Reports** but never
changes the underlying numbers.

---

## Report catalog (13 reports)

| # | Report | Purpose | Key filters/columns | Recommended use |
|---|---|---|---|---|
| 1 | **Occupancy** | Fill rate by property / floor / room type | Rooms, occupied, vacant, other | Daily/weekly occupancy health |
| 2 | **Rent roll** | Who is leasing what, at what rent | Lease, member, property, room, status, rent | The master "who lives where & pays what" list |
| 3 | **Collections & arrears aging** | Money collected vs owed, aged | Bucket (current / 30 / 60 / 90+ days) | Chase overdue debt; cash forecasting |
| 4 | **Overdue & not paid (rent)** | Rent invoices overdue and unpaid | Invoice, member, property, lease, days late | Daily collection follow-up (linked from dashboard) |
| 5 | **Move-in / move-out pipeline** | People arriving and leaving | Stage, count, detail | Plan cleaning, inspections, resales |
| 6 | **Maintenance KPIs** | Repair performance | Status, tickets, SLA, open aging | Manage team workload & SLA breaches |
| 7 | **Complaint KPIs** | Grievance performance | Complaints by status/age/rating | Service quality tracking |
| 8 | **Profit & Loss** | Revenue − expenses = net | Month, property; revenue & expense lines | Monthly/period profitability (ledger-backed) |
| 9 | **Expense vs budget** | Actual spend against budgets | Category, budget vs actual, variance | Cost control; catch overspend |
| 10 | **Owner statement history** | Past owner payouts | Owner, month, amount, status | Reconcile what owners were paid |
| 11 | **POS sales** | Counter sales | Sale, item, qty, day, method | Canteen/store revenue & end-of-day |
| 12 | **Stock valuation** | Inventory on hand & value | Item, category, unit, qty, moving-avg cost | Balance-sheet inventory value; low stock |
| 13 | **Attendance summary** | Staff hours/punctuality | Staff, days, minutes, late/OT | Payroll prep (with CSV export) |

---

## Report-by-report detail

### 1. Occupancy
- **Answers:** "How full are we?" as occupied rooms ÷ total rooms, split by
  property, floor and room type (STANDARD/DELUXE/STUDIO/SUITE).
- **Source:** live room statuses (same source as the dashboard occupancy KPI).
- **Use it:** spot vacant rooms to sell; check a floor/type that's under-performing.

### 2. Rent roll
- **Answers:** "Who is in each room, on what lease, paying how much?"
- **Columns:** lease, member, property, room, status, rent.
- **Use it:** the authoritative occupancy+rent list for managers and owners.

### 3. Collections & arrears aging
- **Answers:** "How much did we collect, and how much is owed and for how long?"
- Buckets outstanding invoices by age (current, 30, 60, 90+).
- The aging sums **reconcile to outstanding invoice totals** (checked by tests).
- **Use it:** prioritise collections; estimate cash at risk.

### 4. Overdue & not paid (rent)
- Lists rent invoices that are **overdue and still not paid**, with days late.
- Linked directly from the dashboard **Rent dues** card.
- **Use it:** drive the daily dunning/chase workflow.

### 5. Move-in / move-out pipeline
- **Answers:** "Who's arriving/leaving and when?"
- **Use it:** schedule cleaning, move-in/out inspections, deposits, and re-sales.

### 6. Maintenance KPIs
- Tickets by status (open/assigned/in_progress/resolved/closed), SLA %, open aging.
- **Use it:** hold the maintenance team to SLA (urgent 4h … low 168h).

### 7. Complaint KPIs
- Complaints by status/age plus member ratings (1–5).
- **Use it:** monitor service quality and slow responses.

### 8. Profit & Loss
- Revenue (rent + services + utilities + late fees + other/POS) − operating
  expenses − owner payouts = **net**, per property or consolidated.
- **Reads the ledger** and reconciles register↔ledger exactly.
- **Use it:** monthly management review; see Part 5.5 for a worked example.

### 9. Expense vs budget
- Compares actual expense (by category/property/month) against **budgets**.
- **Use it:** catch overspend early; plan next month's budgets.

### 10. Owner statement history
- Past owner statements (owner, month, amount, status draft/approved/paid).
- **Use it:** answer owner questions about what was paid and why.

### 11. POS sales
- POS sale lines by day, item, qty and payment method (cash/QR/card/room charge).
- **Use it:** reconcile the till session; store revenue analysis.

### 12. Stock valuation
- On-hand quantity and value per item using **moving-average cost**.
- **Use it:** inventory value for the balance sheet; identify slow/low stock.

### 13. Attendance summary
- Per-staff worked days/minutes, late instances, overtime; ties to shifts/OT rules.
- **Use it:** payroll preparation — use **CSV export** for payroll.

---

## Dashboard KPI strip (always-on)

| KPI | Meaning |
|---|---|
| **Occupancy %** | Occupied ÷ total rooms |
| **Collected vs billed (month)** | Confirmed payments vs invoices issued this month |
| **Arrears** | Total open invoice dues |
| **Cash position** | Ledger 1100 Cash + 1200 Bank balance |
| **Open tickets** | Unresolved maintenance tickets |

Plus the portfolio counts (properties, buildings, rooms/beds, users, members,
book value) and the **Rent dues (M33)** upcoming/overdue lists.

---

## Using reports well
- **Filter by property** for a property manager review; clear filters for company-wide.
- **Export CSV** when you need to share/spreadsheet; **PDF** for a branded record.
- Reports are **point-in-time reads** — if a number surprises you, drill into the
  source module (invoices, ledger, tickets) and the **audit log**, don't edit the report.
- Financial reports (P&L, owner history) are restricted to finance/admin per the permission matrix.

> 🚫 **Not confirmed in the current system:** a dedicated **Balance Sheet**
> report or a separate **General Ledger / Trial balance export** beyond the
> on-screen Ledger journal & trial balance (see Part 5.6). Use **Finance →
> Ledger → Trial balance** for the balance-sheet view.
