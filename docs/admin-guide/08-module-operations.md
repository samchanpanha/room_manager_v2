# 8. Module-by-module admin operations

Daily how-tos are in `manual/03-user-guide.md`; this is the **admin angle**:
what to configure, approve, and watch per module.

## M04 Properties & rooms
- Structure rooms correctly up front (type, floor, rent). Room **status
  machine is enforced** (available → occupied → cleaning → available…);
  staff can't skip states — moves/leases flip statuses automatically.
- Buildings can carry **map coordinates + geofence radius** for kiosk attendance.

## M05 Leases · M16 Room moves
- Lease activation auto-bills the **deposit invoice** (M10).
- **Move-out inspection (M18) is a hard gate** for ending a lease.
- Room move = request → approve → execute: old lease ends, new lease
  starts, deposit follows the member, **one adjustment invoice** nets the
  prorated delta. Never hand-edit two leases to fake a move.

## M06 Rent engine · M07 Invoices
- Monthly `invoice-generation` job (per billing day) + daily `billing-daily`
  catch-up. Mid-month suspends **prorate**; fixed services ride the engine.
- Invoice numbers come from `number_sequences` + Settings prefix — gaps are
  normal (idempotent retries), duplicates are impossible.

## M08 Ledger
- Accountants own this. Every money event posts balanced entries; voids and
  refunds post **reversals**, never edits. P&L and reports read the ledger,
  so "register ↔ ledger" must reconcile exactly — if a report disagrees,
  investigate the postings, not the report.

## M09 Payments · M13 QR
- Methods: cash / bank transfer / QR / card / cheque. Machine:
  `pending → confirmed → refunded | failed`.
- **Allocations are oldest-first** (due date, then period) and immutable;
  overpayments become **member credit** (refundable by Accountant with a
  ledger-reversed payout).
- Webhooks are **signed + idempotent** — duplicate gateway notifications are
  ignored, never double-posted. Receipts (`RCP-…`) auto-file as PDFs.
- Public `/pay` page: exact-due-only, rate-limited, no login.

## M10 Deposits
- Billed at lease activation; deductions are proposed from move-out
  inspection findings and **approved in M10**; payouts reverse through the ledger.

## M11 Utilities · M12 Services
- Meters per room (electric/water/gas), milli-unit precision; estimated =
  avg of last 3; CSV import supported. Tiered tariffs; charges attach to the
  **next cycle automatically**; >2×-average spikes flag as anomalies.
- Services: fixed-monthly (prorate on suspend) vs per-use (one-time lines).
  Parking slots are unique; WiFi accounts follow the lease.

## M14 POS · M15 Stock · M29 Purchase orders
- POS sessions: opening float → expected = float + Σ cash → counted
  variance on close. **Charge-to-room** issues a one-time invoice + AR posting.
- Stock movements are **append-only** (purchase/sale/consumption/
  maintenance_use/adjustment/transfer) with moving-average cost.
  **Stocktakes post variance adjustments** — that's the correction path, not edits.
- Low-stock alerts go to staff (and Telegram if wired).

## M18 Inspections · M19 Maintenance · M22 Complaints
- Checklist templates per room type; move-out inspection gates lease end;
  damage findings → deposit deductions or tickets.
- Tickets: open → assigned → in_progress → resolved → verified/closed, with
  SLA by priority (urgent 4h … low 168h) + daily breach sweep. Costs route to
  expense or owner P&L.
- Complaints: thread + SLA + member-confirmed close with 1–5 rating;
  one-click convert to ticket.

## M20 Expenses & P&L
- Vendor expenses + receipt attachments; **approval above a configurable
  threshold** (auto-approve below; Accountant+ gate); voids reverse.
  Monthly budgets with variance; recurring templates; per-property and
  consolidated P&L from the ledger.

## M23 Attendance
- Kiosk-PIN + mobile clock in/out, optional property geofence, shift
  templates with grace + OT multipliers; exceptions (late/early/missed
  punch/overtime/geofence) with audited resolution; monthly summary + CSV
  payroll export.

## M24 Owner statements
- Monthly generation job (payout day, force bypass, idempotent per
  contract+month). Formula: collected × share | fixed master rent −
  management fee − pass-through − owner maintenance ± audited adjustments.
- `draft → approved → paid`; approval accrues DR 3900 / CR 2200, payout
  DR 2200 / CR cash|bank. PDFs auto-file; owners read them in the portal.
  Generation gated to Accountant+ (GLOBAL M24:update).

## M25 Tenant portal · M21 Telegram
- Portal (`/portal`, mobile PWA): OTP login (hashed single-use codes,
  lockout) materializes the member's User (role MEMBER) — **strictly OWN**
  scope over the same module APIs. No duplicate business logic.
- Telegram: signed webhook (spoofs rejected), one-time link codes, commands
  `/status /dues /pay /help` (own data only), event→template dispatcher with
  per-user toggles. Dev token = mocked sender with full outbox.

## M26 Reports
- 12 reports + dashboard KPI strip (occupancy %, billed vs collected,
  arrears, open tickets, cash position). Every report declares its source
  line; arrears aging must sum to outstanding invoice totals. CSV (RFC-4180)
  + branded PDF export; filter by date + property.

---
