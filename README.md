# RentManager

Rental & co-living property operations platform, built from [`INTENT.md`](./INTENT.md) — the single
source of truth. Current status: **Phases 0–21 complete** (Scaffold → Kernel & RBDC → … → Reports → Settings & Hardening),
running live with seeded demo data.

## Quick start

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # or: npm run db:migrate
npm run db:seed             # idempotent
npm run dev                 # http://localhost:3000
```

### Demo accounts (password `Demo1234!`)

| Email | Role | What to try |
|---|---|---|
| root@demo.test | Super Admin | Everything, incl. destructive + RBDC config |
| admin@demo.test | Admin | Manage org; no delete/config actions |
| pm@demo.test | Property Manager | Assigned to **BLR only** — see scoping in action |
| accountant@demo.test | Accountant | Finance modules (read-mostly) |
| staff@demo.test | Staff | Operational write only; blocked from M04 mutations |
| owner@demo.test | Owner | Owns Building A (BLR) — sees only his property/records |
| owner2@demo.test | Owner | Owns Villa Main (RV) — cross-owner denial demo |
| member@demo.test | Member | Own-scope only (portal lands in Phase 18) |

Demo members: Chan Ling (verified, passport expiring in 20d → reminder badge), Sophea Nuon (prospect,
KYC pending), David Cruz (blacklisted), Maria Lopez (Riverside Villa — use `staff@` to see cross-property
document denial).

## What is implemented (Phases 0–21)

### Phase 0 — Scaffold
- Next.js (App Router) + TypeScript strict + Tailwind + shadcn-style UI kit + TanStack Query + zod
- Vitest runner, ESLint (next/core-web-vitals + next/typescript), GitHub Actions CI
- Env handling via zod (`src/lib/env.ts`), error boundaries, dark mode, toast system

### Phase 1 — Kernel (M00) & RBDC (M01)
- **Prisma schema v1**: parties, users/sessions, roles/permissions/role_permissions/user_roles/
  user_property_assignments, properties→buildings→floors→rooms→beds, audit_logs, domain_events,
  settings, number_sequences. Migrations additive-only.
- **RBDC engine**: `can(user, action, module, resource?)` — one pure resolver used by every API
  endpoint *and* the UI. Permissions = module × action (9) × scope (GLOBAL/PROPERTY/OWN).
  Default roles seeded from the §5 matrix (252 permission rows); dynamic role builder UI at `/roles/[id]`.
- **Auth**: scrypt passwords, DB-backed revocable sessions, httpOnly cookies, rate-limited login.
- **Audit everything**: every mutation writes an attributable `audit_logs` row (before/after JSON, IP).
  Viewer with filters at `/audit`.
- **Tests**: matrix snapshot (locks §5), 12 RBDC positives/negatives (incl. cross-property IDOR),
  room status machine suite.

### Phase 8 — Payments (M09)
- **Collections against invoices**: cash / bank transfer / QR / card / cheque; pending → confirmed →
  refunded | failed machine; partial payments flip invoices to `partial_paid`, full ones to `paid`
- **Allocations are oldest-first by default** (due date, then period) and immutable; overpayments stay
  as **member credit** (§9.5) — refundable by an Accountant with a ledger-reversed payout
- **Numbered receipts** (`RCP-2026-0001`) auto-filed as PDFs to the document registry
- **Signed idempotent webhooks** (`x-webhook-secret` + unique gateway refs): duplicate gateway
  notifications are ignored — never double-posted, never double-receipted
- **QR payments (M13)** — DevMock provider behind a pluggable `generateQR`/`handleWebhook`
  adapter: the invoice "Pay by QR" button mints a pending payment (deterministic idempotency key
  → stable QR), shows the code in the portal, polls as a fallback and is confirmed by the signed
  gateway webhook **exactly once** even on duplicate delivery. HMAC-signed member QRs open the
  public `/pay` page (rate-limited, exact-due-only, no login) and are printed on invoice PDFs.
- **Room moves (M16)** — request (portal or staff) → approve → execute: the old lease terminates,
  a new lease starts, **both room statuses flip** (old → cleaning, new → occupied), the deposit row
  follows the member and the **ONE adjustment invoice nets the exact prorated delta** (prorated new
  rent + move fee − unused old-rent credit as discount); billing catch-up first so credits are real
  billed money; full move history on the member timeline.
- **Inspections (M18)** — checklist templates per room type; move-in/move-out/periodic inspections
  scored with findings and auto-filed PDF reports; a completed move-out inspection is the hard gate
  for ending a lease (§15 v1.1) and its damage findings propose **deposit deductions approved in
  M10** or open maintenance tickets.
- **Maintenance (M19)** — tickets open → assigned → in_progress → resolved → verified/closed with
  SLA targets by priority (urgent 4h … low 168h) and a daily breach sweep; labor/material costs
  routed to expense or owner P&L (M15 stock consumption wires up in Phase 14).
- **Expenses & P&L (M20)** — vendor expenses with receipt attachments (M17), approval above a
  configurable threshold (auto-approve below; Accountant+ gate), ledger postings with
  reversal-based voids, monthly budgets with variance, recurring templates, and a per-property /
  consolidated P&L that reads the ledger and reconciles register↔ledger exactly.
- **Attendance (M23)** — kiosk-PIN and mobile clock in/out with an optional property geofence,
  shift templates with grace windows and simple OT multipliers, derived exceptions (late, early,
  missed punch, overtime, geofence) with audited resolution, reason-stamped corrections, monthly
  per-staff summary and CSV payroll export.
- **Owner Statements (M24)** — monthly payout accounting per owner contract: generation job
  (configurable payout day, force bypass, idempotent per contract+month), formula
  collected × share | fixed master rent − management fee − pass-through − owner maintenance ±
  audited adjustments; `draft → approved → paid` with approval accrual DR 3900 Owner
  Distributions / CR 2200 Owner Payable and payout DR 2200 / CR cash|bank (§15 v1.2) so Owner
  Payable nets back to its prior balance; statement PDFs auto-filed to M17 and readable in the
  owner portal; generation gated to Accountant+ (GLOBAL M24:update).
- **Tenant Portal (M25)** — mobile-first PWA at `/portal`: OTP login (email/phone, hashed
  single-use codes, lockout) that materializes the member's User (role MEMBER) so every
  capability rides the existing module APIs with strictly OWN scoping — dashboard, invoices with
  QR payment (M13), deposits, maintenance/complaint requests, room-move request, move-out notice
  (shared M05 logic), documents + KYC upload (M17), announcements.
- **Telegram Bot (M21)** — signed webhook (spoofed updates rejected), one-time link codes from
  the portals, commands (/status /dues /pay /help — own data only), and an event→template
  dispatcher with per-user toggles: rent receipts, invoice issued, dunning reminders, ticket &
  complaint updates, statement-ready for owners (§15 v1.3 OWNER O(link)), low stock and occupancy
  digests for staff chats. Dev token = mocked sender with a full outbox.
- **Reports (M26)** — 12 reports (occupancy by property/floor/type, rent roll, collections & arrears
  aging, move pipeline, maintenance & complaint KPIs, P&L, expense vs budget, owner statement
  history, POS sales, stock valuation, attendance summary) + a dashboard KPI strip (occupancy %,
  billed vs collected, arrears, open tickets, cash position). Every report declares its ledger/query
  source line so each number traces to its source; all filterable by date range + property with
  RFC-4180 CSV and branded PDF export. GLOBAL = M26:read, OWNER sees own statement history.
- **Settings & Hardening (M27/M28)** — TOTP 2FA (mandatory for Admin+, QR enrollment, signed
  login challenges), sessions & devices with revoke, tamper-evident audit hash chain with PII
  masking and a chain-verify endpoint, CSP/security headers, rate limits on auth + webhooks,
  S3-compatible storage driver (env-selected), nightly backup job + restore runbook, and a
  Settings console: org/locale/billing/late-fee/dunning defaults, sealed provider secrets
  (AES-256-GCM, masked reads), opening balances as balanced `opening` postings, per-module
  feature flags, and data-retention purge (audit trail never purged).
- **POS (M14)** — shift-style sessions (opening float → expected = float + Σ cash →
  counted variance on close), sales by cash / QR / card / **charge-to-room** (auto-issued one-time
  invoice + AR posting), auto-filed receipt PDFs, products linked to stock items.
- **Stock (M15)** — moving-average cost per item, **append-only movements only** (purchase/sale/
  consumption/maintenance_use/adjustment/transfer), low-stock alerts, stocktakes that post variance
  adjustments with a valuation delta, parts consumed onto maintenance tickets with cost, valuation
  report.
- **Complaints (M22)** — new → acknowledged → in_progress → resolved → closed with a comment
  thread, SLA by priority, member-confirmed close with a 1–5 rating, and one-click conversion to a
  maintenance ticket.
- **Utilities (M11)** — meters per room (elec/water/gas) with exact milli-unit readings (manual,
  estimated = avg of last 3, or CSV import); tiered tariffs; charges = consumption × tariff attach
  to the **next invoice cycle automatically**; >2×-average spikes flagged as anomalies; per-meter
  SVG consumption history.
- **Services (M12)** — catalog of add-ons (WiFi / parking / laundry / general): fixed monthly
  services ride the rent engine and **prorate on mid-month suspend**; per-use entries become
  one-time invoice lines; parking slots assign uniquely and WiFi accounts activate/suspend with
  the lease.
- **Deposits (M10)** — billed automatically at lease activation as `deposit`-kind installment invoices,
  held in the **2100 Deposit Liability** account (never revenue): collect via the normal payments flow
  (oldest-first picks the deposit first), deduct at move-out with **mandatory evidence documents** and
  reason codes (damage/cleaning → other income, unpaid rent → clears the receivable), refund the
  remainder with Accountant approval. Movements are append-only and forward-only
  `billed → held → settled`; the liability account must net to 0 for every closed lease.
- Property-scoped for staff, owners see their buildings' payments, members pay and see their own —
  every money move posts balanced entries to the ledger

### Phase 7 — Ledger (M08)
- **Immutable accounting spine**: every invoice issue, late fee, credit note and void posts balanced
  double-entry lines to a fixed system chart (1100 Cash · 1200 Bank · 1300 Rent Receivable · 2100
  Deposit Liability · 2200 Owner Payable · 2300 Tax Payable · 4xxx revenue by kind · 5xxx expenses)
- **Append-only at the database level**: UPDATE/DELETE on posted rows raise ABORT — corrections are
  reversal postings linked back to their originals; unbalanced postings are rejected by trigger,
  service, and CI (Σ debits = Σ credits, always)
- **Trial balance & journal** at `/ledger` (Admin/Accountant), **member account statements** with a
  running receivable balance — members can read only their own
- Money paths (payments, refunds, deposits, expenses, payouts) post here as they land in Phases 8–17

### Phase 6 — Billing: Rent Engine & Invoices (M06, M07)
- **Pure rent engine**: proration on `calendar` (real month length) or `30-day` basis with the exact
  factor shown on the line ("17/31"); Feb-safe cycle-day clamping (1–28); half-up integer math only;
  late fees (fixed or %-of-outstanding with floor, cap, and never exceeding the due); dunning ladder
  (+3/+7/+14, configurable)
- **Invoice composition enforces the core invariant** `total = Σ lines − discount + tax` (asserted in
  the engine, recomputed on every credit/fee, locked in CI); services prorate with rent; per-use and
  metered items arrive with the POS/utility phases
- **Generation job** (button on `/invoices`): bills every active lease with a pending period —
  catch-up-safe (mid-month move-ins get a prorated stub first), **idempotent** (one live invoice per
  lease & period), **gapless numbering** `BLR-2026-0001` per property-year (voided numbers are never
  reused), PDFs auto-filed to the document registry
- **Corrections without rewrites**: issued invoices are immutable — credit notes (≤ due, auto-settles
  at zero) and Super-Admin-only void with a mandatory audited reason
- **Daily billing job**: late fees once per invoice after the grace window; overdue marking through the
  state machine; dunning reminder events per stage (channels light up with Telegram in Phase 19)
- **Scoped visibility**: GLOBAL roles see everything; property managers/staff see their assigned
  properties; owners see their buildings' invoices (and their own member records); members their own —
  enforced identically on list, detail, and PDF endpoints
- **UI**: invoice list with status/dunning badges & totals, invoice detail with items, credit notes,
  timeline and actions, rent-engine rules page (accountant-owned), and the members-list dues badge
  ("$265.00 due")

### Phase 5 — Leases & Owner Contracts (M05)
- Member occupancy leases with snapshotted rent terms (cycle day, proration basis), deposit
  installments, notice/auto-renew/escalation, and per-lease services
- Lifecycle `draft → active → notice → terminated | completed` with full occupancy effects: draft
  reserves the room, activation flips room→occupied + member→active + schedules the first invoice
  (consumed by the Phase 6 job), ending flips room→cleaning + member→moved_out + triggers deposit
  settlement events
- Occupancy rules enforced and unit-tested: one active lease per bed, capacity caps, whole-room vs
  per-bed leases, co-living free-bed move-ins
- Owner contracts (FIXED_RENT | REVENUE_SHARE % + management fee + payout day); activation is the
  authoritative ownership source and syncs `Building.ownerId`; one open contract per building
- Contract PDFs rendered server-side (@react-pdf/renderer) and auto-filed to the document registry

### Phase 4 — Owners (M03)
- Owner profiles on the shared party model; payout methods (bank / mobile money / cash) with primary
  selection and masked account numbers; portal logins (OWNER role, party-bound) with password reset
- Building ownership: every building links to exactly one owner (unique assignment, 409 on conflict);
  owner contracts formalize terms in Phase 5 (M05)
- Owner portal at `/owners/portal`: own buildings, occupancy, payout details, documents
- OWN-scope enforcement verified: owners see only their properties/records/documents — cross-owner
  reads are 403; owner mutations are 403 (read-only role)

### Phase 3 — Members & Documents base (M02 + M17 core)
- Member lifecycle `prospect → verified → active → notice → moved_out` enforced server-side
  (verified needs a complete KYC checklist; active needs an active lease — Phase 5)
- 4-step onboarding wizard: personal → property & emergency contacts → KYC uploads → review
- Blacklist flag (reason mandatory, always audited) blocking all lifecycle moves and future leases
- Document registry (M17 core): polymorphic registry, doc types incl. KYC set, versioned uploads,
  private storage + 120s HMAC-signed download URLs, expiry reminders (30/7-day events), full property scoping

### Phase 2 — Properties & Rooms (M04)
- Property → building → floor → room → bed CRUD via guarded API routes
- Bulk room creation wizard (prefix/start/count/beds/type/price)
- Live room grid per building with status colors; status machine enforced server-side
  (`vacant→reserved→occupied→cleaning→maintenance→vacant` + operational edges), reason required for
  maintenance, invalid transitions → 422, every transition audited + domain event emitted
- Occupancy stats on dashboard / property list / building headers

## Quality gates

```bash
npm run lint        # ESLint clean
npm run typecheck   # tsc --noEmit, strict, no `any`
npm test            # 24 tests: matrix snapshot, RBDC negatives, room machine
npm run db:seed     # idempotent seed
```

## Try the enforcement in 60 seconds

1. Sign in as `pm@demo.test` → Properties → BLR → rooms work.
2. `curl` the API as PM against the other property:
   ```bash
   curl -s -c /tmp/pm.jar -X POST localhost:3000/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"pm@demo.test","password":"Demo1234!"}'
   # floor of Riverside Villa (RV):
   FLOOR=$(curl -s -b /tmp/pm.jar localhost:3000/api/audit-logs >/dev/null; echo)  # see docs/BUILD_LOG.md for a ready-made script
   ```
   → any M04 mutation on RV returns `403 FORBIDDEN` even with a valid session.
3. Check `/audit` — the blocked attempts and every allowed mutation are all recorded.

## Project layout

```
src/lib/billing/            # rent engine (pure), invoice service, PDF, visibility
src/lib/ledger/             # chart, pure postings, append-only ledger service
src/lib/payments/           # payment machine, allocation math, service, receipt PDF
src/lib/deposits/           # deposit billing, settlement math, evidence-backed movements, visibility
src/lib/utilities/          # meters, readings, tariffs, charge computation, spike/estimate rules
src/lib/services/           # add-on catalog, assignments (parking/WiFi), per-use entries
src/lib/qrpay/              # M13 provider adapter (DevMock), QR intents, signed member tokens
src/lib/leases/             # machines, occupancy rules, activation/ending effects, contract PDF
src/lib/owners.ts           # owner portal link, guard targets, list scoping
src/lib/members/            # lifecycle machine + KYC checklist
src/lib/storage/            # storage adapter + signed-URL tokens
prisma/schema.prisma        # data model (v1)
prisma/seed.ts              # matrix + roles + demo org
src/lib/rbac/               # catalog (§5 matrix as code), can(), route guard
src/lib/auth/               # scrypt passwords, revocable sessions
src/lib/audit.ts            # audit helper (every mutation calls it)
src/lib/events.ts           # domain events (outbox seed)
src/lib/rooms/status.ts     # room status machine
src/app/(admin)/            # dashboard, properties, users, roles, audit
src/app/api/                # guarded route handlers
src/components/ui/          # shadcn-style primitives
tests/                      # matrix snapshot, RBDC negatives, room machine
docs/BUILD_LOG.md           # phase tracker & acceptance mapping
```

## Next phases (per INTENT §10)

17 · Owner statements → 18 · Telegram → … → 22 · Golden path.
See `docs/BUILD_LOG.md` for the live tracker.
