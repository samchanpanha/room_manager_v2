# RentManager — INTENT.md
Single source of truth for the AI-driven build. Version: 1.0

## 1. Mission
One system to run rental / co-living properties end to end: owner & building onboarding,
member leases, rent billing & collection (incl. QR), deposits, utilities, add-on services,
daily operations (maintenance, inspections, complaints, room moves), POS & inventory,
staff attendance, finances (expenses, P&L, owner statements), a tenant self-service portal,
Telegram automation, and reports — all governed by Role-Based Dynamic Access Control (RBDC).

## 2. Product Principles
- Multi-property from day one; every record is property-scoped where applicable.
- Money integrity: integer minor units, ledger-backed, idempotent, no deletions of posted records.
- RBDC enforced server-side on every endpoint; UI permissions derived, never authoritative.
- Audit everything; every mutation is attributable.
- Mobile-first for tenant portal and field staff; desktop-first for admin/back office.

## 3. Tech Stack (default; swap only with an entry in §15)
- App: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query + zod
- API: Next.js route handlers; background jobs via cron/queue (invoice generation, reminders, statements)
- DB: PostgreSQL + Prisma (migrations never destructive)
- Auth: sessions (better-auth) + OTP login for members; TOTP 2FA for privileged roles
- Files: S3-compatible storage, signed URLs; PDF via react-pdf
- Payments: provider-agnostic adapter (dev mock first) + dynamic QR (UPI / PromptPay / QRIS / gateway link)
- Bot: grammY (Telegram, webhook mode)
- Tests: Vitest (unit/integration) + Playwright (e2e); CI: GitHub Actions

## 4. Domain Glossary
Owner (property landlord) · Property → Building → Floor → Room → Bed · Member (tenant/resident) ·
Lease (member occupancy contract) · Owner Contract (master lease/management agreement) ·
Rent Plan (billing schedule) · Invoice · Ledger Entry · Deposit · Service (add-on) ·
Utility Charge (meter-based) · Room Move · Statement (owner payout report) · Portal (tenant self-service).

## 5. RBDC Model (implemented in Phase 1; used by every module)
- Permissions = `module × action × scope`. Actions: create, read, update, delete, approve, void, refund, export, config.
- Scopes: GLOBAL / PROPERTY (user limited to assigned properties) / OWN (record-level).
- Roles are **dynamic**: admins create roles and tick a permission grid. Users hold ≥1 role;
  effective permissions = union. Users get property assignments.
- Enforcement: server middleware `can(user, action, module, resource?)`; UI reads the same resolver.
- Default roles: Super Admin (undeletable), Admin, Property Manager, Accountant, Staff, Owner, Member.
- Rules: role in use cannot be deleted; all role/permission changes audited; permission matrix
  snapshot-tested in CI (negative tests included).

### Default Permission Matrix
`F`=full incl. config/delete · `M`=manage (CRU) · `R`=read · `W`=read+operational write · `O`=own records only · `–`=none

| Module | SuperAdmin | Admin | PropMgr | Accountant | Staff | Owner | Member |
|---|---|---|---|---|---|---|---|
| M01 Users/RBDC | F | M | R | R | – | – | – |
| M02 Members | F | M | M | R | W | R | O |
| M03 Owners | F | M | R | R | – | O | – |
| M04 Properties/Rooms | F | M | M | R | R | R(own bldg) | – |
| M05 Leases | F | M | M | R | R | R | O |
| M06 Rent Engine | F | M | R | M | – | – | – |
| M07 Invoices | F | M | M | M | R | R | O |
| M08 Ledger | F | R | – | M | – | – | O(stmt) |
| M09 Payments | F | M | M | M | W | R | O |
| M10 Deposits | F | M | M | M | R | R | O |
| M11 Utilities | F | M | M | R | W | R | O |
| M12 Services | F | M | M | R | W | – | O |
| M13 QR Payments | F | M | R | M | W | – | O |
| M14 POS | F | M | M | R | W | – | – |
| M15 Stock | F | M | M | R | W | – | – |
| M16 Room Moves | F | M | M | R | W | – | O(request) |
| M17 Documents | F | M | M | R | R | O | O |
| M18 Inspections | F | M | M | – | W | R | O |
| M19 Maintenance | F | M | M | – | W | W | O |
| M20 Expenses/P&L | F | M | R | M | W | R(own) | – |
| M21 Telegram | F | M | – | – | – | O(link) | O(link) |
| M22 Complaints | F | M | M | – | W | R | O |
| M23 Attendance | F | M | M | R | O(clock) | – | – |
| M24 Owner Statements | F | M | R | M | – | O | – |
| M25 Tenant Portal | F | M | – | – | – | – | O |
| M26 Reports | F | M | M(ops) | M(fin) | R | R(own) | – |
| M27 Security | F | M(audit) | – | – | – | – | – |
| M28 Settings | F | M | R | R | – | – | – |

## 6. Core Kernel (M00) — foundation everything depends on
- Hierarchy: Property → Building → Floor → Room → Bed. Room has: type, floor, amenities,
  base price, capacity, meter refs. Room status machine: `vacant → reserved → occupied → cleaning → maintenance → vacant`.
- Party model: one `parties` table (person/company) reused for owners, members, vendors, staff contacts.
- Cross-cutting tables: `audit_logs`, `domain_events`, `settings`, `number_sequences`.
- Org settings: single currency (minor units), timezone, locale.

## 7. Module Specifications

### M01 Users & RBDC
- Purpose: users, dynamic roles, permission grid, property scoping, audit viewer.
- Entities: users, roles, permissions, role_permissions, user_roles, user_property_assignments, audit_logs.
- Rules: passwords + optional TOTP; sessions revocable; Super Admin role protected; invite flow for staff.
- Screens: user list/detail, role builder (module×action grid), user-role & property assignment, audit log viewer.
- Acceptance: create role “Cashier” with only payments:W → user with that role cannot open invoices for edit;
  negative test enforced in CI; every action appears in audit log.

### M02 Members
- Purpose: tenant/resident lifecycle & records.
- Entities: member_profiles (party link), emergency_contacts, member_documents (→M17), statuses.
- Lifecycle: prospect → verified → active → notice → moved_out; flag: blacklisted (reason required).
- Rules: active membership requires an active lease; KYC checklist must complete before move-in;
  room occupancy cannot exceed bed capacity.
- Screens: member list (filters: status/property/owing), profile tabs (profile, lease, ledger, documents, activity).
- Acceptance: full onboarding wizard works; member with unpaid invoices shows dues badge; blacklist blocks new lease.

### M03 Owners
- Purpose: landlords whose buildings are managed; payout details.
- Entities: owner_profiles, owner_bank/payout methods, owner_users (portal login for Owner role).
- Rules: owner sees only own properties/units; every building links to exactly one owner contract (M05).
- Acceptance: owner login shows only their properties, statements (M24), and documents.

### M04 Properties & Rooms
- Purpose: physical inventory.
- Entities: properties, buildings, floors, rooms, beds, room_amenities.
- Rules: CRUD with soft delete only if no lease history; bulk room creation wizard; occupancy dashboard per building.
- Acceptance: create property→building→floor→3 rooms; occupancy grid reflects live lease state; room status transitions enforced.

### M05 Leases
- Purpose: contracts — member occupancy leases AND owner contracts.
- Member lease fields: member, room/bed, start/end, rent plan ref, deposit terms, services refs,
  notice_days, auto_renew, escalation rule, status `draft → active → notice → terminated | completed`.
- Owner contract fields: owner, building, model (fixed master rent OR revenue share %), term, payout cycle.
- Rules: one active lease per bed; proration on mid-month start/end; termination requires clearance
  (dues = 0 or written off with approval) + move-out inspection link; PDF generation of contract.
- Acceptance: activate lease → room becomes occupied, member becomes active, first invoice scheduled;
  end lease → room to cleaning, deposit settlement flow triggered.

### M06 Rent Engine
- Purpose: billing rules that produce invoice lines.
- Entities: rent_plans (amount, cycle day, proration basis: calendar/30-day), late_fee_rules
  (grace days, fixed or % with cap), tax_rules, escalation_rules, discounts.
- Rules: engine is pure functions `(lease, period) → line items`; deterministic & unit-tested;
  supports one-time charges and credits.
- Acceptance: mid-month move-in produces exact prorated amount per chosen basis; late fee auto-applies
  after grace period via job; 100% unit coverage of proration/late-fee edge cases.

### M07 Invoices
- Purpose: billing documents composed by the rent engine.
- Entities: invoices, invoice_items (rent/service/utility/one-time/credit), credit_notes, number_sequences.
- States: `draft → issued → partial_paid → paid → overdue → void`.
- Rules: monthly generation job (configurable lead days); numbering `{PROP}-{YEAR}-{SEQ}` gapless;
  issued invoices are immutable — corrections only via credit note; PDF auto-generated & stored in M17;
  delivery via email/Telegram; dunning schedule (+3/+7/+14 days reminders).
- Acceptance: generation job creates correct invoices for all active leases; void requires reason + audit;
  totals = Σitems − discounts + tax, always.

### M08 Ledger
- Purpose: immutable accounting spine (double-entry light).
- Entities: accounts (fixed system codes: 1100 Cash, 1200 Bank, 1300 Rent Receivable, 2100 Deposit
  Liability, 2200 Owner Payable, 4xxx Revenue by category, 5xxx Expenses), ledger_entries
  (ts, account, debit, credit, ref_type, ref_id, property_id, member_id?).
- Rules: append-only; corrections via reversal entries; every invoice issue, payment, refund, deposit
  move, expense, payout posts balanced entries; DB constraint + CI test: Σdebits = Σcredits.
- Screens: trial balance, member account statement, journal browser with filters.
- Acceptance: after golden-path scenario (§12), trial balance nets to zero; no endpoint can mutate a posted entry.

### M09 Payments (Monthly Payments)
- Purpose: collect money against invoices.
- Entities: payments (method: cash/bank_transfer/qr/card/cheque; status `pending → confirmed → refunded | failed`;
  gateway_ref; idempotency_key), payment_allocations (→ invoices, oldest-first default), receipts (numbered).
- Rules: partial payments allowed; allocations must equal payment amount; refunds require Accountant+
  approval and reverse via ledger; bank statement import + matching screen; overdue dunning integration.
- Acceptance: pay 50% of invoice → status partial_paid, receipt issued, ledger balanced; duplicate webhook is ignored.

### M10 Deposits
- Purpose: security deposit lifecycle.
- Entities: deposit_schedules (per lease: total, installments), deposit_transactions (hold/refund/deduct), deduction reasons + evidence refs.
- Rules: deposits sit in liability account; installments billable via invoices; move-out settlement =
  refund − approved deductions (from inspections/maintenance); refunds go through M09 with approval.
- Acceptance: collect deposit in 2 installments; deduct 100 with evidence at move-out; refund remainder; ledger liability reconciles to 0 for closed lease.

### M11 Utilities
- Purpose: meter-based charges.
- Entities: meters (type elec/water/gas, bound to room/building), meter_readings (manual or CSV import),
  tariffs (unit rate, optional tiers), utility_charges.
- Rules: charge = (reading − previous) × tariff; estimated readings allowed (avg last 3, flagged);
  charges attach to next invoice cycle automatically; spike anomaly warning (>2× average).
- Acceptance: enter readings for 3 rooms → charges appear on next generated invoices; history chart per meter.

### M12 Services (General / WiFi / Parking / Laundry)
- Purpose: billable add-ons.
- Entities: service_catalog (name, pricing model: fixed_monthly | per_use | metered), service_assignments (lease or one-time), parking_slots, wifi_accounts.
- Rules: fixed services auto-bill monthly via rent engine; per-use entries (laundry kg, parking visitor)
  create one-time lines; WiFi account activate/suspend on lease start/end; parking assigns slot uniquely.
- Acceptance: assign WiFi + parking to lease → both appear on invoice; suspend service mid-month → prorated stop.

### M13 QR Payments
- Purpose: frictionless pay-by-QR.
- Adapter interface: `generateQR(amount, ref, orgAccount) → {image, qrString, expiresAt}`; `handleWebhook(payload)`.
  Implementations: DevMock first; pluggable real providers (gateway payment link, UPI, PromptPay, QRIS).
- Rules: dynamic QR per invoice shown in portal & printable receipt; confirmation via webhook + polling fallback;
  payment marked confirmed idempotently; static poster QR allows pay-without-login (member/room lookup or member QR scan).
- Acceptance: portal Pay button shows QR; simulated webhook confirms payment exactly once even if delivered twice.

### M14 POS
- Purpose: canteen/store point of sale.
- Entities: products (link to stock item), pos_sessions (open/close, expected vs counted cash), pos_sales, pos_sale_items.
- Rules: sale payment: cash/QR/card or “charge to room” (posts to member invoice as one-time line);
  sale decrements stock (M15); session close variance report; receipt printing.
- Acceptance: open session → 3 sales (one charge-to-room) → close with variance noted; stock decremented; charge appears on member invoice.

### M15 Stock / Inventory
- Purpose: inventory control.
- Entities: stock_items (category, unit, moving-average cost), stock_movements (purchase, sale, consumption,
  maintenance_use, adjustment, transfer), stocktakes, suppliers.
- Rules: movements only (no direct qty edits); low-stock threshold alerts; stocktake variance posts adjustment;
  maintenance can consume parts (cost flows to ticket/M20).
- Acceptance: purchase 10 units → sell 3 via POS → consume 1 in maintenance → on-hand = 6; valuation report correct.

### M16 Room Moves
- Purpose: member moves between rooms.
- Flow: request (member portal or staff) → pick target room + effective date → system computes rent proration
  delta, deposit delta, move fee → approval → execute: old line ends, new line starts, adjustment invoice/credit
  created, both room statuses updated, optional move-out/move-in inspections linked.
- Acceptance: execute mid-month move → both rooms correct status, one adjustment invoice with exact prorated delta, full history on member timeline.

### M17 Documents
- Purpose: all files, uploaded or generated.
- Entities: document_registry (entity polymorphic: member/lease/room/owner/contract), doc_types, versions, expiry_date.
- Rules: private S3 + signed URLs; download permission = module RBDC + property scope; expiry reminders
  (30/7 days) via Telegram/email; generated PDFs (invoices, leases, statements, inspection reports) auto-filed here.
- Acceptance: upload KYC with expiry → reminder fires; staff of another property cannot fetch the URL.

### M18 Inspections
- Purpose: structured room condition checks.
- Entities: inspection_templates (sections/items per room type), inspections (type: move_in | move_out | periodic;
  per item: pass/fail/NA + photo + note; score), findings.
- Rules: mobile-friendly capture; move_out findings can (a) open maintenance ticket, (b) propose deposit deduction;
  PDF report auto-saved to M17.
- Acceptance: complete move-in and move-out inspection; move-out damage → deposit deduction suggestion → approved in M10.

### M19 Maintenance
- Purpose: repair workflow.
- Entities: tickets (category, priority, SLA target, room/building, reported_by), assignments (technician/vendor),
  status `open → assigned → in_progress → resolved → verified/closed`, costs (labor + materials from M15).
- Rules: members raise via portal/Telegram; SLA breach escalation; recurring/preventive schedules;
  costs can be charged to owner (flows to M24) or expense (M20).
- Acceptance: member raises ticket → assigned → resolved with 1 stock part consumed → verified closed; SLA timer and notifications worked.

### M20 Expenses & P&L
- Purpose: cost tracking and profitability.
- Entities: expense_categories (mapped to ledger expense accounts), expenses (attachment, property, paid_via M09),
  budgets (per property/category/month), recurring expense templates.
- Rules: approval required above configurable threshold; P&L per property & consolidated:
  revenue (rent+services+utilities+POS) − operating expenses − owner payouts (or per contract model) = net.
- Acceptance: record expense with receipt → ledger posts; P&L matches ledger totals exactly; budget vs actual variance shown.

### M21 Telegram Bot
- Purpose: notifications + commands.
- Linking: user sees one-time link code in app → bot `/link <code>` binds telegram_id (RBDC-checked).
- Events → templates: invoice issued, payment received, overdue reminder (member); ticket assigned, low stock,
  occupancy digest (staff/admin); statement ready (owner). Per-user preference toggles.
- Commands: `/status` `/dues` `/pay` (returns QR via M13) `/help`. Webhook signature verified; member commands return own data only.
- Acceptance: pay → member gets receipt message; `/dues` returns only that member's dues; spoofed webhook rejected.

### M22 Complaints
- Purpose: grievance handling.
- Entities: complaints (category, priority, source: portal/telegram/staff), status `new → acknowledged → in_progress → resolved → closed`, comments, photos, rating.
- Rules: SLA by priority; optional one-click conversion to maintenance ticket; member confirms resolution and rates.
- Acceptance: member files complaint in portal → acknowledged within SLA → resolved → member rates; full thread visible.

### M23 Attendance
- Purpose: staff time tracking.
- Entities: shifts, attendance_records (clock in/out via kiosk PIN or mobile + optional geofence), exceptions, overtime rules (simple multipliers).
- Rules: no edit without audit; monthly summary per staff; CSV export for payroll.
- Acceptance: staff clocks in/out via kiosk; exception report flags missed punches; monthly export matches records.

### M24 Owner Statements
- Purpose: monthly payout accounting to owners.
- Formula (per contract model): collected rent for owner's units × revenue share OR fixed master rent
  − management fee − pass-through expenses − owner-borne maintenance ± adjustments = net payout.
- Flow: generation job (configurable day) → `draft → approved → paid` (paid via M09, posts to Owner Payable ledger) → PDF to M17 → visible in owner portal.
- Acceptance: generate statement for a month with mixed collections → amounts reconcile to ledger; payout marks statement paid and reduces Owner Payable to 0.

### M25 Tenant Portal
- Purpose: member self-service (mobile-first web/PWA), OTP login.
- Features: dashboard (room, lease, balance), invoices + pay (QR/gateway), deposit status, raise
  maintenance/complaint, documents, announcements, notice/move-out request, room-move request, profile & KYC upload.
- Rules: strictly OWN scope; every capability maps to existing module APIs — no duplicate business logic.
- Acceptance: member completes the full journey (view invoice → pay by QR → raise complaint → track ticket) without staff help.

### M26 Reports
- Purpose: analytics & exports (all filterable by date range + property; CSV/PDF export).
- Reports: occupancy (by property/floor/type), rent roll, collections & arrears aging (30/60/90+),
  move-in/out pipeline, maintenance KPIs (SLA %, open aging), complaint KPIs, P&L, expense vs budget,
  owner statement history, POS sales, stock valuation, attendance summary.
- Dashboard: KPIs — occupancy %, collected vs billed, arrears total, open tickets, cash position.
- Acceptance: every report number traces to a ledger/query source; arrears aging sums equal outstanding invoice totals.

### M27 Security
- Sessions & devices list with revoke; TOTP 2FA mandatory for Admin+; rate limiting on auth & webhooks;
- audit log viewer (M01) with tamper-evident append-only storage; PII masked in logs; CSP + security headers;
  secrets in env only; S3 signed URLs with short TTL; nightly backup job + documented restore runbook;
  permission matrix snapshot tests + negative tests in CI.
- Acceptance: penetration checklist pass (IDOR across properties, privilege escalation, webhook spoofing, URL guessing).

### M28 Settings
- Org profile & branding; currency/timezone/locale; invoice numbering; tax rates; late-fee defaults;
  grace periods; dunning schedule; notification templates; payment provider credentials; Telegram bot token;
  opening balances (seed ledger); per-module feature flags; data retention.
- Rules: all changes audited; financial-affecting settings require Admin+; changes apply forward-only (never rewrite posted history).

## 8. Data Model Skeleton (generated to full Prisma schema in Phase 1)
users, roles, permissions, role_permissions, user_roles, user_property_assignments ·
properties, buildings, floors, rooms, beds · parties, member_profiles, owner_profiles ·
owner_contracts, leases, lease_services · rent_plans, late_fee_rules, tax_rules ·
invoices, invoice_items, credit_notes · payments, payment_allocations, receipts ·
accounts, ledger_entries · deposit_schedules, deposit_transactions ·
meters, meter_readings, tariffs, utility_charges · service_catalog, service_assignments, parking_slots, wifi_accounts ·
products, pos_sessions, pos_sales, pos_sale_items · stock_items, stock_movements, stocktakes ·
room_moves · document_registry · inspection_templates, inspections, inspection_findings ·
maintenance_tickets, maintenance_costs, preventive_schedules · expenses, budgets, expense_categories ·
owner_statements, payouts · complaints · shifts, attendance_records ·
telegram_links, notification_preferences, outbox (notifications) · audit_logs, domain_events, number_sequences, settings.

## 9. Money & Ledger Invariants (enforced by code + DB + tests)
1. All amounts integer minor units; single currency per org in v1.
2. Σ debits = Σ credits, always (constraint + CI test).
3. No DELETE on invoices/payments/ledger — void & reversal only.
4. Invoice total = Σ items − discounts + tax.
5. Payment allocations Σ = payment amount; unallocated remainder = member credit.
6. Idempotency keys on all webhooks; retries safe.
7. Financial settings apply forward-only.

## 10. Build Sequence (Prompt Sequence)
Execute strictly in order. One phase = one focused agent session using the §A prompt template.

| # | Phase | Modules | Definition of Done (beyond module acceptance) |
|---|---|---|---|
| 0 | Scaffold | – | Repo, CI, lint/format, test runners, env handling, shadcn base, error boundary |
| 1 | Kernel & RBDC | M00, M01 | Prisma schema v1, migrations, auth, permission guard + matrix snapshot test |
| 2 | Physical inventory | M04 | Room grid UI; status machine tests |
| 3 | Members & docs base | M02, M17(core) | Onboarding wizard; upload + signed URL |
| 4 | Owners | M03 | Owner records + portal login scoping test |
| 5 | Leases | M05 | Both lease types; PDF contract; occupancy effects |
| 6 | Billing | M06, M07 | Generation job; proration/late-fee unit tests 100% |
| 7 | Ledger | M08 | Balanced-posting tests; trial balance UI |
| 8 | Payments | M09 | Receipts, allocations, refund approval, idempotent webhooks |
| 9 | Deposits | M10 | Settlement flow incl. deductions |
| 10 | Utilities & services | M11, M12 | Charges flow into generated invoices |
| 11 | QR payments | M13 | DevMock adapter + portal pay flow |
| 12 | Room moves | M16 | Proration delta + dual status update |
| 13 | Operations | M18, M19, M22 | Cross-links (complaint→ticket, finding→deduction) |
| 14 | POS & stock | M14, M15 | Charge-to-room; stock movement integrity |
| 15 | Attendance | M23 | Kiosk + export |
| 16 | Expenses & P&L | M20 | P&L reconciles with ledger |
| 17 | Owner statements | M24 | Statement → payout → ledger cycle |
| 18 | Tenant portal | M25 | Full member journey on mobile viewport |
| 19 | Telegram bot | M21 | Link, events, commands, signature check |
| 20 | Reports | M26 | All reports + dashboard |
| 21 | Settings & hardening | M27, M28 | Security checklist + 2FA + backups |
| 22 | Golden path & release | all | §12 scenario green; seed data; docs; deploy |

## 11. Global Quality Gates (every phase)
`pnpm lint && pnpm typecheck && pnpm test && pnpm db:seed` · RBDC negative tests pass ·
ledger balance test passes · no `any` types · no secrets in code · audit log fires for new mutations.

## 12. Golden End-to-End Scenario (final acceptance — Phase 22)
1. Super Admin creates org (currency, timezone), property + building + 3 rooms; creates roles/users (PM, Accountant, Staff).
2. Onboard Owner with revenue-share contract (60%) for the building.
3. Onboard Member: KYC docs → lease on Room A (mid-month start), rent 300/mo, deposit 600 in 2 installments, WiFi 15/mo.
4. Job generates Invoice #1: prorated rent + WiFi + electricity charge (from meter reading) → issued → PDF filed → Telegram/email sent.
5. Member pays 50% via QR in portal (webhook confirmed once, duplicate ignored), rest in cash by Staff. Receipts issued. Ledger balanced.
6. Member requests room move → approved with +10 proration → adjustment invoice auto-created.
7. Member raises complaint → converted to maintenance ticket → resolved consuming 1 stock item → closed → member rates.
8. Month end: utilities recorded, expenses booked, P&L generated; owner statement drafted → approved → payout paid → owner sees PDF in portal.
9. Verify: trial balance = 0; arrears report consistent; audit trail complete; Staff user blocked from voiding an invoice (negative test).

## 13. UX Standards
shadcn/ui components; standard table pattern (filter/sort/paginate/export); zod-validated forms;
confirm dialogs on destructive/financial actions; toasts; empty & loading states; dark mode;
responsive; all strings externalized for i18n.

## 14. Out of Scope v1
Multi-currency, native mobile apps, WhatsApp channel, e-signature, payroll computation,
full statutory accounting (tax filings), owner self-billing, marketplace.

## 15. Change Protocol
Any change request is appended here as: `vX.Y — date — description — affected modules`,
then specs/matrix/build order are updated in place before code changes begin.
(Log starts below this line.)

v1.4 — 2026-09-04 — Phase 21 (M27/M28) decisions, taken before code:
**(a) better-auth swap rejected; the hand-rolled auth kernel stays.** §10 row
21 and v1.1 deferred better-auth to this phase, but the v1 kernel already
delivers everything the swap would (scrypt hashing, httpOnly SameSite cookie,
DB-backed revocable sessions, rate-limited login) — swapping would force a
rewrite of every login/session touchpoint (member OTP materialization,
Telegram chat binding, ~40 suites) for zero security gain. TOTP 2FA lands
directly on the existing kernel instead: RFC-6238 (HMAC-SHA1, 30 s, 6 digits,
±1 window), secret sealed with the settings key, enrollment mandatory for
SUPER_ADMIN/ADMIN (module APIs refuse mutations until enrolled; the login of a
* enrolled* admin demands a current code via a 5-minute signed challenge).
Supersedes the §10 row 21 note and v1.1's deferral. — affected §10, §15 v1.1, M27.
**(b) Secret-typed M28 settings are stored encrypted at rest, not env-only.**
Payment provider credentials and the Telegram bot token live in `Setting`
sealed with AES-256-GCM under env `SETTINGS_ENC_KEY` (iv-per-record, masked
reads — the API only ever returns `configured` + last 4, never the value),
env vars remain the fallback when no DB value is set, and writes are audited
without the secret. M27's "secrets in env only" is interpreted as "no secrets
in code, logs, or plaintext storage". — affected M27, M28.
**(c) ADMIN's §5 M27 `M(audit)` is a scope qualifier, not full M:** ADMIN may
view the audit trail, verify its hash chain, and revoke sessions (incl.
others'); security-configuration mutations beyond that stay SUPER_ADMIN F.
No matrix letter changes. — affected §5, M27.

v1.3 — 2026-09-04 — §M21 internal inconsistency: the events→templates list names **statement ready (owner)** as a Telegram notification, but the §5 matrix row gave OWNER `–` on M21 — an owner could never link a chat, so that event had no possible recipient. The OWNER cell becomes **O(link)** (self-service chat link/unlink + preference toggles for their own chat, exactly mirroring the MEMBER O(link) semantics). No other M21 cells change; staff chats are bound by Admin (M21:M) via the admin link endpoint since STAFF stays `–`. — affected §5, M21.

v1.2 — 2026-09-03 — M24 statement accruals need a balance-sheet-only home for owner distributions: the §M20 P&L formula lists owner payouts as a term SEPARATE from operating expenses, so accruing them to an expense account (5xxx) would double-count them in the P&L and break the M20 register↔ledger reconciliation (Δ≠0). The §M08 chart gains **3900 Owner Distributions (EQUITY)** — debit balance in practice, seeded with the system accounts, no CRUD until M28. Statement approval posts the accrual DR 3900 / CR 2200 Owner Payable; the payout (statement paid, §M24 "paid via M09") posts DR 2200 / CR 1100|1200 with refType `payout` — Owner Payable nets to 0 and the P&L payout term equals the cash distributed. Owner payouts post straight through the ledger rather than as M09 Payment rows (payments are member-AR; a payout has no invoice). — affected M08, M20, M24.


v1.1 — 2026-09-02 — Dev/test database uses the SQLite Prisma provider (file DB) for sandbox portability; production target remains PostgreSQL per §3. Schema avoids Prisma enums (string columns + app-level zod/state-machine validation) so the schema is provider-portable. Swap back is a datasource block + migration change. — affected §3, §6, M00+.
v1.1 — 2026-09-02 — Package manager is npm (sandbox has no pnpm); quality gates run as `npm run lint && npm run typecheck && npm test && npm run db:seed`. — affected §11.
v1.1 — 2026-09-02 — Phase 0 ships shadcn-style UI primitives vendored in `src/components/ui` (Tailwind + identical class conventions, no Radix dependency yet). Call-sites stay shadcn-compatible so a later swap to the shadcn CLI is mechanical. — affected §3, §13.
v1.1 — 2026-09-02 — Auth v1 is a hand-rolled session implementation (scrypt password hashing, httpOnly SameSite cookie, DB-backed revocable sessions, rate-limited login). better-auth adoption is deferred to the M27 hardening phase (Phase 21) where TOTP 2FA lands. — affected §3, M01, M27.
v1.1 — 2026-09-02 — i18n: a dictionary module (`src/lib/i18n.ts`, locale `en`) externalizes shared chrome strings now; full string externalization completes alongside the tenant portal phase. — affected §13.

v1.1 — 2026-09-02 — M17 storage ships as a StorageAdapter interface with a local dev-disk implementation (private objects + 120s HMAC-signed URLs, short-TTL semantics identical to S3 presigned GET). S3-compatible driver + env credentials land with the deploy/hardening phase; signed-URL issuance flow does not change. — affected §3, M17, M27.
v1.1 — 2026-09-02 — Building.ownerId added as the current-ownership pointer (M03/M04). It is the pre-contract ownership link used for owner portal scoping; when M05 owner contracts land (Phase 5) the contract becomes the authoritative source and the pointer is kept in sync (set on contract activation, cleared on termination). — affected M03, M04, M05.
v1.1 — 2026-09-02 — Member lifecycle amendment: `active → moved_out` is now a valid transition (direct termination/eviction path without a tracked notice period); lease lifecycle service uses it when a lease ends without the member passing through `notice`. — affected M02, M05.
v1.1 — 2026-09-02 — Member lease rent terms are snapshotted on the lease at signing (amount, cycle day, proration basis); M06 rent plans become the catalog layer in Phase 6 without re-pricing existing leases. Lease services store a billing snapshot until the M12 catalog lands (Phase 10) and then link to it. — affected M05, M06, M12.
v1.1 — 2026-09-02 — Lease termination clearance (dues = 0 / written-off approval) and the move-out inspection link switch from audited-acknowledgment to hard gates as Payments (Phase 8) and Inspections (Phase 13) land. Owner-contract PDFs are deferred to the Phase 17 statement pipeline (same @react-pdf/renderer renderer). — affected M05, M08–M10, M18, M24.
v1.1 — 2026-09-02 — M08 chart gains **2300 Tax Payable** (liability) alongside the named 21xx/22xx codes so invoice tax has a posting home (M07 tax would otherwise be unreconciled); all other system account codes follow §M08 verbatim. Seed-only change — no CRUD for accounts until M28. — affected M08.
v1.1 — 2026-09-02 — M09 refunds in v1 return **unallocated member credit only** (Accountant+ approval, ledger-reversed); refunds of allocated amounts are deferred because the invoice machine treats `paid` as terminal — releasing allocations would require a paid → partial_paid amendment (revisit with §12 hardening or on first real need). — affected M09.
