# RentManager — Build Log

Tracks execution of INTENT.md §10 (build sequence). One phase = one focused session.
Date format: YYYY-MM-DD. All dates 2026.

| # | Phase | Modules | Status | Done | Notes |
|---|---|---|---|---|---|
| 0 | Scaffold | – | ✅ done | 2026-09-02 | Next 15 + TS strict + Tailwind + UI kit + Vitest + CI; env via zod; error boundaries; dark mode |
| 1 | Kernel & RBDC | M00, M01 | ✅ done | 2026-09-02 | Schema v1 + migration; scrypt/cookie auth with revocable sessions; `can()` resolver; matrix snapshot test; 12 RBDC negative tests; audit viewer |
| 2 | Physical inventory | M04 | ✅ done | 2026-09-02 | Full hierarchy CRUD; bulk room wizard; room grid UI; status machine enforced + tested; occupancy stats |
| 3 | Members & docs base | M02, M17(core) | ✅ done | 2026-09-02 | Lifecycle machine + KYC gate + blacklist; 4-step onboarding wizard; document registry with signed URLs; property-scoped doc access |
| 4 | Owners | M03 | ✅ done | 2026-09-02 | Owner profiles + payout methods + portal logins; building ownership pointer; owner portal; OWN-scope enforcement verified live |
| 5 | Leases | M05 | ✅ done | 2026-09-02 | Member leases + owner contracts; state machines; activation effects (room/member/invoice scheduling); deposit settlement trigger; contract PDF via @react-pdf/renderer; owner-ownership sync |
| 6 | Billing | M06, M07 | ✅ done | 2026-09-02 | Rent engine (pure proration calendar/30-day, late fees, dunning) + invoice generation job (idempotent, gapless numbering, PDFs auto-filed) + credit notes + void-with-reason + dunning ladder; members dues badge |
| 7 | Ledger | M08 | ✅ done | 2026-09-02 | Append-only double-entry-light spine: 13 system accounts, balanced postings (DB trigger + service + CI), reversal-only corrections, invoice issue/late-fee/credit-note/void postings wired into M07, trial balance + journal + member statement screens |
| 8 | Payments | M09 | ✅ done | 2026-09-02 | Payment lifecycle pending→confirmed→refunded|failed; oldest-first allocations (§9.5 remainder = member credit); numbered receipts auto-filed as PDFs; signed idempotent webhooks; Accountant-approved refunds; ledger-backed |
| 9 | Deposits | M10 | ✅ done | 2026-09-02 | Deposit billed as installment invoice on activation (isDeposit, DR 1300/CR 2100); status billed→held→settled forward-only; append-only deduction/refund movements with mandatory evidence; refunds Accountant-approved; OPEN_DUES move-out gate; 2100 nets 0 on settled leases |
| 10 | Utilities & services | M11, M12 | ✅ done | 2026-09-03 | Meters/readings/tariffs (milli-unit exact math, tiered pricing, estimates avg-3, >2× spike anomalies); charges auto-attach to the next invoice cycle; service catalog + assignments with WiFi/parking binding, per-use one-time lines and prorated mid-month suspend; SVG meter history |
| 11 | QR payments | M13 | ✅ done | 2026-09-03 | DevMock provider adapter (generateQR/parseWebhook); Pay-by-QR = pending M09 payment with deterministic idempotency key → portal QR + 3 s polling + exactly-once webhook confirmation; HMAC member tokens → public /pay page (rate-limited, exact-due only); QR embedded in invoice PDFs |
| 12 | Room moves | M16 | ✅ done | 2026-09-03 | request → approve → execute; proration delta + dual status update: old lease terminated / new lease active, ONE adjustment invoice (prorated new rent + move fee − unused old-rent credit as discount = exact delta), old room → cleaning / new room → occupied, deposit row follows the member, billing catch-up keeps the credit gapless; history on member timeline |
| 13 | Operations | M18, M19, M22 | ✅ done | 2026-09-05 | Cross-links (complaint→ticket, finding→deduction): checklist templates per room type, scored inspections with auto-filed PDF reports; move-out inspection is the v1.1 hard gate for lease end and its findings propose deposit deductions approved in M10 or open M19 tickets; ticket SLA by priority with daily breach sweep; complaints thread, member-rated close, one-click ticket conversion |
| 14 | POS & stock | M14, M15 | ✅ done | 2026-09-03 | POS sessions (float → expected = float + Σ cash → counted variance), sales cash/QR/card/**charge-to-room** (auto-issued one-time invoice, DR 1300/CR 4900) with auto-filed receipt PDFs (entity SALE); stock items with **moving-average cost**, append-only movements (purchase/sale/consumption/maintenance_use/adjustment/transfer — no direct qty edits), low-stock `stock.low` events, stocktakes posting variance adjustments with value delta, part consumption flowing cost onto M19 tickets, valuation report |
| 15 | Attendance | M23 | ✅ done | 2026-09-03 | Kiosk-PIN + mobile clock in/out with optional geofence, shift templates with grace, simple OT multipliers (basis points), derived exceptions (late/early/missed/overtime/geofence) with audited resolution, manual entries/corrections always reason-stamped, daily missed-punch sweep (>16h open), monthly per-staff summary, CSV payroll export |
| 16 | Expenses & P&L | M20 | ✅ done | 2026-09-03 | Expense categories mapped to ledger accounts (5000/5100); expenses with M17 receipt attachment and approval above the configurable threshold (auto-approve below; Accountant+ = GLOBAL M20:update); approval posts DR category/CR cash|bank, void = ledger reversal; budgets per category/month with variance; recurring templates materialize monthly (idempotent); P&L per property & consolidated reads the ledger and reconciles register↔ledger with Δ=0 |
| 17 | Owner statements | M24 | ✅ done | 2026-09-04 | §15 v1.2: account 3900 Owner Distributions (EQUITY). Monthly generation per active contract (configurable payout day, `force` bypass, idempotent per contract+month); formula collected×share | fixed rent − management fee − pass-through − owner maintenance ± audited adjustments; `draft → approved → paid` with approval accrual DR 3900/CR 2200 (`statement_accrual`) and payout DR 2200/CR cash|bank (`payout`) — Owner Payable nets back to its prior balance; PDF auto-filed to M17 (entity STATEMENT) and visible in the owner portal; generation gate = GLOBAL M24:update (Accountant+), owners read their own; acceptance: mixed-collections month reconciles to confirmed ledger allocations to the minor unit (41033 live) |
| 18 | Tenant portal | M25 | ✅ done | 2026-09-04 | OTP login (email/phone, hashed single-use codes, 5-attempt lockout, dev echo — no provider until M21/M28) that materializes the member's User (role MEMBER, unusable password) so every capability rides the existing module APIs with OWN scoping; mobile-first PWA portal (dashboard, invoices + QR pay, deposits, maintenance/complaint requests, room-move request, move-out notice via shared M05 giveNotice, documents + KYC upload, announcements, profile); member-own paths fixed (documents OWN scope, M07 list OR-arms bug); acceptance: view invoice → pay by QR → raise complaint → track ticket live without staff help |
| 19 | Telegram bot | M21 | ✅ done | 2026-09-04 | §15 v1.3: OWNER M21 – → O(link). Signed webhook (`X-Telegram-Bot-Api-Secret-Token`, timing-safe; spoofed → 401); one-time 8-char link codes issued from the member/owner portals bind the chat (replay/expiry-proof, superseded on re-issue); commands /status /dues /pay (QR via M13) /link /unlink /help — member chats return own data only; event→template dispatcher over the DomainEvent log with a persisted cursor (invoice issued, payment receipt, dunning reminder, ticket/complaint transitions, statement ready → owner, low stock + occupancy digest → staff chats) and per-user toggles; every send recorded in a TelegramOutbox; dev token = mock sender. Acceptance live: pay → receipt message, /dues own-only, spoof rejected |
| 20 | Reports | M26 | ✅ done | 2026-09-04 | 12 reports (occupancy by property/floor/type, rent roll, collections & arrears 30/60/90+ aging, move pipeline, maintenance KPIs, complaint KPIs, P&L, expense vs budget, owner statement history, POS sales, stock valuation, attendance summary) + dashboard KPI strip (occupancy %, billed vs collected, arrears, open tickets, cash position); every report declares its ledger/query **source line** (shown in UI + PDF) so each number traces to its source; GLOBAL = M26:read → whole portfolio, OWNER sees own statement history only; RFC-4180 CSV + branded PDF export per report, all filterable by date range + property. Acceptance live: collections = confirmed allocations = Σ ledger credits to 1300 (100.00), Σ aging buckets = Σ open dues (310.33), P&L NET = issued invoices (410.33) |
| 21 | Settings & hardening | M27, M28 | ✅ done | 2026-09-04 | §15 v1.4 (before code): better-auth swap rejected (hand-rolled kernel already scrypt+httpOnly cookie+revocable DB sessions+rate-limited login; TOTP landed directly — RFC-6238, sealed secret, mandatory for Admin+ with a full capability lock until enrolled, 5-min signed challenge at login); secret-typed M28 settings stored AES-256-GCM-sealed (masked reads, env fallback). Sessions & devices list + revoke; tamper-evident audit hash chain (mutation → brokenAtId, deletion → gaps) + PII masking; CSP/security headers; rate limits on auth+webhooks; S3 storage driver (aws4fetch presign, env-selected); nightly `VACUUM INTO` backup + runbook; M28 settings console (org/locale/billing/late-fee/dunning/providers/features/retention, audited, Admin-only writes, forward-only) + opening balances as balanced `opening` postings. Pentest pass: IDOR, escalation, webhook spoof, URL guessing |
| 22 | Golden path & release | all | – | – | |

## Acceptance evidence — Phases 0–2

### M01 acceptance (role builder + negative enforcement + audit)
- Dynamic roles: create role via `/roles` → grid builder at `/roles/[id]` (module × 9 actions × scope).
- Role in use cannot be deleted (`409 IN_USE`), Super Admin protected (`409 PROTECTED`).
- CI negative tests: `tests/rbac.test.ts` (staff ✗ M01; PM cross-property ✗; member ✗ others' invoices;
  fail-closed without resource context).
- Matrix snapshot: `tests/matrix.test.ts` (`__snapshots__/matrix.test.ts.snap`).
- Every mutation → `audit_logs` row (verified live: logins, room transitions, bulk creates).

### M04 acceptance (property→building→floor→rooms; grid reflects state; transitions enforced)
- Seed creates BLR (Building A: 4 floors / 19 rooms / beds) + RV (2 rooms).
- Room grid at `/properties/[id]` shows live statuses with color coding.
- Transitions: invalid → `422 INVALID_TRANSITION`; →maintenance without reason → `400 REASON_REQUIRED`;
  valid → `200` + audit + domain event. Verified via live API smoke test 2026-09-02:
  - PM(room create, assigned BLR) → `201`; PM(room create, unassigned RV) → `403`;
  - staff(transition) → `403`; root(cleaning→occupied) → `422`; root(→maintenance, reason) → `200`.

### Global gates (§11)
- `npm run lint` ✅ · `npm run typecheck` ✅ (strict, zero `any`) · `npm test` ✅ 24/24 · `npm run db:seed` ✅ (idempotent, re-run verified).
- RBDC negative tests ✅ · audit-on-mutation ✅ · no secrets in code ✅ (`.env` holds only local dev DB path).
- Ledger balance test: N/A until Phase 7.

## Smoke test transcript (2026-09-02, against live dev server)

```
1  GET  /api/health                                  → 200 {status:ok}
2  POST /api/auth/login (pm@demo.test)               → 200 + session cookie
3  POST /api/rooms/bulk  (BLR floor, PM assigned)    → 201
4  POST /api/rooms/bulk  (RV floor, PM NOT assigned) → 403 FORBIDDEN
5  POST /api/users       (PM, M01:create ✗)          → 403 FORBIDDEN
6  POST /api/rooms/:id/status (staff, M04:update ✗)  → 403 FORBIDDEN
7  POST status cleaning→occupied                     → 422 INVALID_TRANSITION
8  POST status →maintenance without reason           → 400 REASON_REQUIRED
9  POST status →maintenance with reason              → 200 (+audit +domain event)
10 audit trail shows all of the above, attributable
11 pages /login /dashboard /properties /users /roles /audit → 200; unauth → 307 login
```

## Acceptance evidence — Phase 3 (2026-09-02)

### M02 acceptance
- **Onboarding wizard works**: 4-step wizard (personal → property & contacts → KYC docs → review) creates
  party + profile + contacts atomically, then uploads staged files (server enforces M17 per file).
- **Lifecycle enforced live**: `prospect→verified` w/o KYC → `422 KYC_INCOMPLETE` (names missing types);
  complete docs → auto `kycCompletedAt` + `200`; `verified→active` → `422 LEASE_REQUIRED` (arrives Phase 5).
- **Blacklist**: no reason → `400`; with reason → `200`; every lifecycle move while blacklisted → `423`.
- **Dues badge**: column wired, populated from Phase 6 invoices (marked in UI).
- Property scoping: staff created member in assigned BLR `201`; unassigned RV `403`.

### M17(core) acceptance
- Upload → private object store (dev disk adapter) + registry row with version + audit + domain events.
- **Signed URLs**: issue (audited) → download returns bytes; tampered token `403`; TTL 120s.
- **Cross-property denial**: staff fetching RV member docs → `403` (M17 read is PROPERTY-scoped).
- **Expiry reminders**: upload with expiry ≤45d emits `document.expiry_upcoming` (30/7-day classification);
  delivery channels (Telegram/email) land in Phase 19. Seeded member "Chan Ling" has a 20-day-expiry passport
  demonstrating the reminder badge.

### Smoke transcript (Phase 3, live)
```
1  POST /api/members (staff, BLR)          → 201
2  POST /api/members (staff, RV)           → 403 FORBIDDEN
3  POST /api/documents (staff upload)      → 403 (staff M17 = read)
4  POST /api/documents (PM, near-expiry)   → 201 + version 1
5  GET  /api/documents (staff, RV member)  → 403
6  POST sign → GET /api/files/<token>      → 200 (bytes) · tampered → 403
7  status prospect→verified (KYC missing)  → 422 KYC_INCOMPLETE
8  +docs → kycCompleted:true → verified    → 200
9  status verified→active                  → 422 LEASE_REQUIRED (Phase 5)
10 blacklist {} → 400 · {reason} → 200 · then status → 423 BLACKLISTED
11 pages /members /members/new /members/[id] → 200
```

### Global gates (§11) — Phase 3
lint ✅ · typecheck ✅ (strict, no `any`) · tests ✅ 44/44 (added: lifecycle 7, KYC 9, signing 5, RBDC M02/M17 scope cases) · seed ✅ idempotent re-run (members + docs + storage objects included) · audit-on-mutation ✅ · ledger: N/A (Phase 7).

## Acceptance evidence — Phase 4 (2026-09-02)

### M03 acceptance
- **Owner login scoping**: Lim (owner@) sees only Bassac Lane Residence (BLR); Chaya (owner2@) sees only
  Riverside Villa — verified on /properties and /owners/portal; cross-owner doc access → 403.
- Owner users created via owner_users flow (party-bound User + OWNER role); new login verified by signing in.
- Owner is read-only on own record (O) — profile PATCH & payout-method POST → 403.
- Building↔owner uniqueness: assigning an owned building → 409 BUILDING_OWNED; unassign then reassign works.
- Staff (M03 –) → 403 on create; PM sees owners of assigned properties only (property-scoped list).
- Documents entity=OWNER: upload/list/sign resolve OWN scope via linked portal user; audited.

### Also fixed (scope-aware page gates)
- Page-level gates now use `hasModuleAccess` (any-scope existence) with data scoped separately —
  Property Manager now correctly sees members/properties of assigned properties (was rendering
  "No access" despite having PROPERTY-scope read).

### Smoke transcript (Phase 4, live)
```
1  POST /api/owners (root: payout+login+buildings) → 201
2  POST /api/owners (staff)                        → 403
3  GET  /owners/[own] (owner)                      → 200 (own record)
4  GET  /api/documents?entity=OWNER (other owner)  → 403
5  PATCH /api/owners/[own] (owner, O=read-only)    → 403
6  POST /api/owners/[own]/payout-methods (owner)   → 403
7  upload entity=OWNER (root) → sign (owner)       → 200 bytes · other owner sign → 403
8  POST /api/auth/login (new owner portal user)    → 200 (OWNER role)
9  /properties owner scoping: Lim↔BLR only · Chaya↔RV only (verified in HTML)
10 audit trail records all M03 mutations
```

### Global gates (§11) — Phase 4
lint ✅ · typecheck ✅ · tests ✅ 47/47 (added: 3 owner-scope RBAC negatives) · seed ✅ (idempotent, owners + payouts + building ownership included) · audit-on-mutation ✅.

## Acceptance evidence — Phase 5 (2026-09-02)

### M05 acceptance
- **Both lease types**: member leases (`LSE-*`: rent terms snapshot, cycle day, proration basis, deposit
  installments, notice, auto-renew, escalation %, services) and owner contracts (`OWC-*`: FIXED_RENT |
  REVENUE_SHARE %, management fee, term, payout day).
- **PDF contract**: GET /api/leases/:id/contract renders via @react-pdf/renderer (4.4 KB A4, verified
  `%PDF`), auto-files v1 to M17 (`lease-LSE-0002.pdf`), re-GET streams fresh bytes, `?refile=1` versions.
- **Occupancy effects, verified live**:
  - draft holds the room (`vacant → reserved`), draft delete releases it;
  - activate → lease active · room `→ occupied` · member `verified → active` · `nextBillingDate`
    computed (2026-10-01 for the Oct 1 start) · `lease.first_invoice_scheduled` event · deposit terms
    noted for M10;
  - notice → member `active → notice`; complete → room `→ cleaning` (last lease in room), member
    `→ moved_out`, `deposit.settlement_due` event fired.
- **Gates enforced live**: activation with prospect member → `422 MEMBER_NOT_READY`; KYC incomplete →
  `422 KYC_INCOMPLETE`; verified→active without lease → `422 LEASE_REQUIRED` (real lease check now);
  staff activate/create → `403` (staff M05 = read).
- **Owner contracts**: duplicate contract on Building A → `409 CONTRACT_EXISTS`; activation syncs
  `Building.ownerId` (verified YES), termination clears it (verified CLEARED) — per §15 v1.1.
- **Rules unit-tested**: one active lease per bed, capacity, whole-room conflicts, co-living free-bed
  move-ins, cleaning/maintenance refusal, billing-date math incl. Feb-safe cycle clamping.

### Fixed during this phase
- **Transaction deadlock**: `emitDomainEvent` called with the root Prisma client from inside an
  interactive transaction self-deadlocked on SQLite (P2028/P1008). Events now accept the `tx` client;
  heavier lease transactions got explicit timeouts (20s). Root-client-in-transaction is now a
  documented no-no (enforced by review; PostgreSQL Phase 22 will add a lock-timeout regression test).
- Member machine amendment: `active → moved_out` allowed (termination/eviction without a tracked
  notice period) — tested.

### Deferred gates (switch on as modules land)
- Termination clearance (dues = 0 / written-off approval) — strict when Ledger/Payments live (Phase 7–8).
- Move-out inspection link requirement — strict from Phase 13 (M18). Both still audited + reasoned.
- Lease services reference the M12 catalog + prorated mid-term stops from Phase 10; member lease PDF
  done, owner-contract PDF deferred to Phase 17 statement pipeline (same renderer).

### Smoke transcript (Phase 5, live)
```
1  activate LSE-0002 (member=prospect)         → 422 MEMBER_NOT_READY
2  prospect→verified (KYC missing)             → 422 KYC_INCOMPLETE
3  upload passport+contract → verified         → 200 (kycCompleted:true)
4  verified→active (no lease)                  → 422 LEASE_REQUIRED
5  staff activate                              → 403
6  root activate                               → 200 (room occupied, member active, bill 2026-10-01)
7  GET contract PDF                            → %PDF, filed lease-LSE-0002.pdf v1
8  notice → complete                           → room cleaning · member moved_out · settlement fired
9  duplicate owner contract                    → 409 CONTRACT_EXISTS
10 Building B contract activate/terminate      → ownerId synced → cleared
11 staff lease create                          → 403
12 pages /leases /leases/new /owner-contracts/new /leases/[id] → 200
```

### Global gates (§11) — Phase 5
lint ✅ · typecheck ✅ · tests ✅ 66/66 (lease machine 6, rules+billing 11, member machine +1, RBDC +1) · seed ✅ (leases + contracts in demo data; `db:reset` verified) · audit-on-mutation ✅ · ledger: N/A (Phase 7).

### Ops note (SQLite dev DB)
`prisma migrate reset` must run with the app server stopped — replacing the DB file under a live
Prisma engine corrupts the handle ("database disk image is malformed"). Recovery: stop app →
`rm prisma/dev.db*` → `migrate reset --force` → `seed` → verify `PRAGMA integrity_check` → start app.
This constraint disappears on PostgreSQL (Phase 22).

---

## Phase 6 — Billing (M06 Rent Engine + M07 Invoices) — 2026-09-02

**Shipped**
- **M06 rent engine, pure & deterministic** (`src/lib/billing/`):
  - `proration.ts` — `nextCycleBoundary` clamps cycle day to 1–28 (Feb-safe, leap years included);
    `prorate` measures cycle length from the cycle ANCHOR (boundary on/before period start), so a
    mid-month stub (Aug 15 → Sep 1 on a day-1 cycle) correctly prorates 17/31 instead of reading as a
    full cycle; `calendar` (real month length) and `thirty_day` bases; full-cycle short-circuit;
    half-up rounding on positive integers only; exact factor string ("17/31") surfaced on invoice lines.
  - `engine.ts` — `composeInvoice` builds rent + fixed-monthly service lines (services prorate with the
    rent factor; per_use/metered excluded until M12/M14) + one-time lines, invoice-level discount
    (clamped ≤ subtotal), tax on (subtotal − discount); **asserts the §9.4 invariant
    total = Σitems − discount + tax** and throws on violation; `evalLateFee` (FIXED | PERCENT bps,
    1-minor floor, cap, never > outstanding); `dunningStage` maps days-past-due onto the schedule.
  - `machines.ts` — invoice status machine: draft → issued → partial_paid → paid; issued/partial_paid →
    overdue; any live → void (reason mandatory); **paid & void terminal**; transitions table tested.
- **M07 invoice service** (`service.tsx`): `generateInvoices` (catch-up chaining from the last invoice,
  ≤24 periods; idempotent — one LIVE invoice per (lease, periodStart); gapless numbering via
  NumberSequence `INV:{PROP}:{YEAR}` → `BLR-2026-0001`; dueDate = period start, or today when catching
  up); `applyLateFees` (once per invoice, grace-window aware); `runDunning` (overdue marking via the
  machine + one reminder event per stage bump on the `billing.dunning` [+3,+7,+14] schedule);
  `issueInvoice` (drafts only), `voidInvoice` (reason 3..500, number stays consumed, due zeroed),
  `createCreditNote` (≤ due else `422 EXCEEDS_DUE`; credits reduce `amountCreditedMinor` — items are
  never rewritten per §9.3; auto → paid at due 0); `fileInvoicePdf` → M17 docTypeId "invoice"
  (v1 on first GET, versions on refile).
- **API** (RBDC on every endpoint, audited on every mutation):
  - POST `/api/jobs/invoice-generation` (M07:create; GLOBAL = all properties, PROPERTY = assigned
    only; owners can't run it), POST `/api/jobs/billing-daily` (M06:update = late fees + dunning).
  - GET `/api/invoices` + GET `/api/invoices/:id` (M07:read, scope-resolved: GLOBAL → all ·
    PROPERTY → assigned properties · OWN → owned buildings' properties + own member records;
    outside scope → 403 even for valid ids).
  - POST `…/{issue(M07:update), void(M07:void = Super Admin, reason enforced), credit-notes(M07:update)}`,
    GET `…/pdf` (M07:read).
  - GET/PUT `/api/rent-engine/rules` (read M06:any, update M06 — per INTENT matrix the **Accountant**
    owns billing rules; verified live 200/403s).
- **UI**: `/invoices` (filters, totals, status/dunning badges, job buttons), `/invoices/[id]`
  (items, totals ladder, credit notes, timeline, issue/credit/void dialogs, PDF link), `/rent-engine`
  (rules form, plan catalog, explainer), nav entries, **members list dues badge** (Σ amountDue over
  live invoices — Chan Ling showed "$265.00 due").
- **Seed**: 4 rent plans (catalog reference), late-fee rule ($5 fixed, 3d grace, $50 cap), default tax
  rule 0%, `billing.dunning` + `billing.generation` settings; LSE-0001 linked to the Deluxe plan.

### Phase 6 acceptance (evidence)
- **Tests**: 37 new (engine 22: Feb clamp incl. leap year, boundary math, 17/31 & 4/28 & 9/30 proration,
  half-up rounding, discount clamp, invariant, per_use exclusion, late-fee floors/caps/outsourcing caps,
  dunning ladder, full transition matrix; service 15: catch-up chaining, stub + full month composition
  (25000×17/31 + WiFi prorate = 14533), gapless BLR-2026-0001/0002/0003 across void→re-bill,
  generation idempotency (0 duplicates), late fee once-only + invariant after fee, dunning stage 2 on
  day 13 + no repeat reminders, EXCEEDS_DUE, full-credit settle → paid with items untouched, void
  terminal + re-generation with the NEXT number, PDF filing row per invoice). **103/103 total.**
- **Live smoke** (server, HTTP):
  1. generation → BLR-2026-0001 (145.33, prorated 17/31) + BLR-2026-0002 (265.00); LSE-0002 draft skipped
  2. re-run → generated 0 (idempotent)
  3. dueDate aged to 2026-08-20 → billing-daily → late fee $5 applied · overdue marked · dunning stage 2
  4. re-run → 0 fees / 0 reminders (once-only)
  5. credit 200.00 > due 150.33 → 422 EXCEEDS_DUE; credit 150.33 → CN-0001, invoice → **paid**, items byte-identical
  6. GET pdf → `%PDF-1.3`, 3.4 KB, auto-filed v1
  7. void BLR-2026-0002 (reason) → 200; re-generate → **BLR-2026-0003** (next gapless number); void
     without reason → 400; void voided → 422 INVALID_TRANSITION
  8. scoping: root/admin/accountant 3 invoices · pm/staff (assigned property) 3 · owner (own building) 3 ·
     **owner2 (other building) 0**; owner2 detail/pdf → 403; staff generation/void/credit → 403;
     accountant rules PUT → 200 (audited); owner rules PUT → 403
  9. members page dues badge: Chan Ling "$265.00 due"
- **Ledger untouched** (§ sequence): `amountPaidMinor` stays 0; settlement writes arrive Phase 7–8.

### Fixed during this phase
- **Proration anchor bug (caught by tests before ever shipping)**: cycle length was measured from
  periodStart, making a 17-day mid-month stub look like a "full cycle" (full month charged). Cycle
  length now measured from the cycle anchor (the boundary on/before periodStart). Regression-tested.
- **@react-pdf/renderer CJS breakage**: 4.9.0's textkit 6.4+ imports `@react-pdf/hyphenate/*` — an
  ESM-only package with no `require` condition → `ERR_PACKAGE_PATH_NOT_EXPORTED` under tsx/vitest.
  Pinned renderer 4.5.1 + overrides (layout 4.6.1, textkit 6.3.0, render 4.5.1 — the last
  CJS-safe `hyphen`-based chain; React 19 compatible). PDF pipeline verified under both vitest and Next.
- **Collection-route authorization pattern**: `authorize(action, module)` without a resource can never
  match PROPERTY/OWN-scoped grants — list/detail/pdf/rules-GET now authenticate + check module access
  at any scope, then enforce data-level scoping (`visibleInvoicePropertyIds` / `canSeeInvoice` in
  `src/lib/billing/visibility.ts`). Resource-scoped `authorize` stays for point-mutations (issue,
  void, credit, rules PUT).
- **Next route files may only export handlers**: shared helpers moved out of route.ts (tsc gate caught it).
- JSX in `service.tsx` needs `import * as React` for the classic runtime (tsx/vitest) — Next's automatic
  runtime masked it.
- dev.db pollution incident: bare `npx vitest` fell back to `.env` DATABASE_URL and ran service tests
  against the demo DB. Fixed with `tests/setup.ts` (pins DATABASE_URL to the disposable copy),
  self-cleaning `beforeAll`, and `npm run test:billing` (fresh copy + reset). `db:reset` restored
  pristine state; ops note (server stopped during reset) honored.

### Global gates (§11) — Phase 6
lint ✅ · typecheck ✅ · tests ✅ 103/103 (37 billing) · seed ✅ (billing rules + plans; `db:reset` verified
pristine: 0 invoices, 4 plans, rules + settings present) · audit-on-mutation ✅ (generation, late fees,
dunning, issue, void, credit notes, rules PUT all logged) · ledger: N/A (Phase 7) · RBDC negatives ✅ (live).

---

## Phase 7 — Ledger (M08) — 2026-09-02

**Shipped**
- **Data model**: `LedgerAccount` (fixed system chart: 1100 Cash · 1200 Bank · 1300 Rent Receivable ·
  2100 Deposit Liability · 2200 Owner Payable · **2300 Tax Payable** (§15 v1.1) · 4000–4900 revenue by
  kind · 5000/5100 expenses), `LedgerTransaction` (balanced posting with ref linkage + `reversalOf`
  back-link) and `LedgerEntry` (single-sided movement). Migration `phase7_ledger` +
  `phase7_ledger_constraints`.
- **DB-level enforcement** (SQLite triggers, replay-safe via migrations):
  - a posting with `totalDebit != totalCredit` (or ≤ 0) is rejected at INSERT (§9.2);
  - entry lines must be single-sided (exactly one of debit/credit > 0);
  - **UPDATE/DELETE on transactions or entries raise ABORT** — the ledger is append-only (§9.3);
    verified live (raw `updateMany` blocked).
- **Pure posting library** (`src/lib/ledger/`): `accounts.ts` (chart + kind→revenue mapping),
  `postings.ts` (`invoiceIssueLines` — DR 1300 / CR revenue by item kind with the invoice-level
  discount **prorated across kinds** (largest-remainder allocator), tax → 2300; `lateFeeLines`;
  `creditNoteLines` pro-rata across the invoice's live revenue; `reversalLines`; `assertBalanced`),
  `service.ts` (`postTransaction` inside the caller's tx, `reverseTransaction` with double-reversal
  guard, `trialBalance`, `journal` filters, `memberStatement` with running receivable, `ledgerIntegrity`).
- **Domain hooks (M07 → M08, all inside the existing transactions)**: invoice issue posts the accrual
  entry; late fees post incrementally; credit notes reverse the invoice's full live composition
  (issue + late-fee revenue, pro-rata); voids reverse every live posting of the invoice with
  `invoice_void` transactions pointing back at their originals. No money path skips the books.
- **Read-only API** (no mutation endpoints exist — nothing can mutate a posted entry by design):
  GET `/api/ledger/trial-balance`, `/api/ledger/journal` (account/ref/date/member filters),
  `/api/ledger/accounts` (GLOBAL `M08:read` only — PM/staff/owners have no M08 cell), and
  GET `/api/members/[id]/statement` (GLOBAL readers + the member's OWN scope, matrix `O(stmt)`).
- **UI**: `/ledger` — trial balance with totals + "nets 0" badge and the journal browser with filters
  and per-posting entry lines; `/members/[id]/statement` — member account statement (open invoices +
  postings with running 1300 balance, reversals marked); nav entry live; link from the member profile.

### Phase 7 acceptance (evidence)
- **Tests**: +19 (postings 14: allocator exact/fix-up/zero-weight, issue lines with discount proration
  & tax booking, kind mapping, late fee, credit-note pro-rata + fallback, reversal mirrors,
  assertBalanced rejects; DB 5: 6 postings from the billing flow with ΣDR=ΣCR, chart balances exactly
  (AR 26500 = the one live invoice; revenue 25000/1500/0 after credit+void), member statement running
  balance consistent, unbalanced/unknown-account/double-reversal rejection, trigger-blocked
  UPDATE/DELETE). **122/122 total.**
- **Live smoke** (HTTP): generation → balanced trial balance (ΣDR=ΣCR=41033; 1300 41033 = both
  invoices); + late fee & dunning → 1300 41533 / 4300 500; partial credit 100.00 → pro-rata
  [9120/547/333] across rent/service/late-fee revenue (largest-remainder fix-up verified in the
  balances); void 0002 → mirror `invoice_void` (CR 1300 26500 / DR 4000 25000 / DR 4100 1500);
  final balance Σ=78033 nets 0; member statement running AR 14533→41033→41533→31533.
- **RBDC live**: member (OWN) reads own statement 200 · other member's statement 403 · trial balance
  403; staff trial balance/journal 403; `/ledger` page shows the No-access state for members.
- **Append-only live**: `prisma.ledgerEntry.updateMany` rejected by trigger; no endpoint mutates ledger
  rows (read-only routes + domain-hook writes only).

### Fixed during this phase
- **Credit-note allocation gap (caught by tests)**: credits originally allocated pro-rata across the
  ISSUE posting only, leaving late-fee revenue standing and over-reversing rent. Now allocates across
  the invoice's **live postings** (issue + late fees) so a full credit reverses the exact outstanding
  composition.
- **Allocator**: residual rounding distributed one minor unit at a time, largest weights first
  (deterministic, keeps big categories whole).
- Ops repeat: a raw-check against the DEFAULT Prisma client wrote a test row into dev.db (trigger
  experiments). `db:reset` with the server stopped restored pristine state — reminder recorded: any
  ad-hoc DB experiment must target the `test-billing.db` copy explicitly.

### Global gates (§11) — Phase 7
lint ✅ · typecheck ✅ · tests ✅ 122/122 (19 ledger) · seed ✅ (13 system accounts; `db:reset` verified:
0 invoices, 0 ledger txs) · audit-on-mutation ✅ (ledger writes ride audited domain mutations; ledger
itself has no mutation endpoints) · ledger ✅ balanced by construction + trigger + CI · RBDC negatives ✅.

---

## Phase 21 — Settings & Hardening (M27, M28) — 2026-09-04

**§15 v1.4 (logged before code)**
- **(a) better-auth swap rejected.** The v1 kernel already delivers scrypt
  hashing, httpOnly SameSite cookie, DB-backed revocable sessions and
  rate-limited login; swapping would rewrite every login/session touchpoint
  (member OTP materialization, Telegram chat binding, ~40 suites) for zero
  security gain. TOTP lands directly on the kernel. Supersedes the §10 row 21
  note and v1.1's deferral.
- **(b) Secret-typed M28 settings are sealed, not env-only**: payment
  credentials and the Telegram bot token live in `Setting` under AES-256-GCM
  (env `SETTINGS_ENC_KEY`), read-masked (`configured` + last 4), env as
  fallback, audited without the value.
- **(c) ADMIN's §5 M27 `M(audit)` is a scope qualifier**: audit view + chain
  verify + session revoke; other security mutations stay SUPER_ADMIN. No
  matrix letters changed (snapshot untouched).

**Shipped**
- **M27 TOTP 2FA**: RFC-6238 HMAC-SHA1/30 s/6-digit with ±1 window
  (`src/lib/auth/totp.ts`, RFC-vector-tested), secret sealed with the settings
  key, enrollment `/api/auth/2fa/setup` (QR data URL via `qrcode`) →
  `/enable` (code verified) → TOTP-enabled logins require a current code
  against a 5-minute signed challenge (`/api/auth/login` → `totpRequired` +
  challenge, `/api/auth/login/verify`). **Mandatory for Admin+**: until
  enrolled, `can()`/`hasModuleAccess()` refuse every module except M27; Admin
  disable is refused (`TWO_FACTOR_MANDATORY`); SUPER_ADMIN admin-reset clears
  enrollment + sessions.
- **Sessions & devices**: `GET /api/auth/sessions` (own; Admin+ any user),
  `DELETE /api/auth/sessions/[id]` (own or Admin+, audited) — revoked sessions
  die at the next `getAuthUser()`. UI on `/settings/security`.
- **Tamper-evident audit**: `logAudit()` now chains rows in a tiny standalone
  transaction — `hash = SHA-256(prevHash | row fields)`; existing rows
  backfilled (`scripts/backfill-audit-chain.ts`). `GET /api/audit/verify`
  recomputes the trail: a **mutation** breaks at `brokenAtId` (ok:false); a
  **deletion** surfaces as a linkage `gap` (counted, not fatal — shipped test
  fixtures prune their own audit rows; production retention never purges
  audit). PII (emails/phones/id numbers/password-like keys) is masked in
  `before`/`after` payloads before storage.
- **Rate limiting**: login (existing) + login/verify, 2FA endpoints, portal
  OTP request/verify, and both webhooks (payments, telegram) 60/min/IP.
- **Security headers**: CSP (frame-ancestors admits `*.e2b.app` for the
  sandbox preview — production tightens to `'self'` + HSTS), nosniff,
  Referrer-Policy, Permissions-Policy, COOP (`next.config.ts`).
- **Storage §15 v1.1**: S3-compatible driver (`aws4fetch`, header-signed
  server PUT/GET/DELETE + query-presigned GET, same 120 s TTL semantics),
  selected purely by `S3_*` env; dev-disk remains the default.
- **Backup**: `POST /api/jobs/backup` → consistent SQLite `VACUUM INTO`
  snapshot (live-DB safe), newest 7 kept, audited; restore runbook in
  `docs/BACKUP.md`.
- **M28 settings** (`src/lib/settings.ts`, `/settings`, `/api/settings`):
  groups org/locale/billing/lateFee/retention/features + sealed providers;
  every change audited; writes are `M28:update` (Admin) — PM/ACCOUNTANT hold
  read; feature flags hide optional modules org-wide via the admin layout;
  opening balances post as one balanced `refType "opening"` ledger
  transaction (unbalanced → 400, unknown account → 400); retention purge
  (`/api/jobs/retention`, `src/lib/retention.ts`) clears stale outbox/events/
  OTPs/sessions — audit rows are never purged; runtime secrets (Telegram
  token, payment webhook secret) read through `getProviderSecret` (DB sealed
  value > env fallback).

**Acceptance (live smoke, dev server)** — root login →
`totpEnrollmentRequired:true` and `GET /api/reports` **403** (mandatory gate
live) → enroll via setup QR → code verified → gate opens; logout → password
step returns `totpRequired` + challenge → wrong code **401 TOTP_INVALID** →
current code → session + audit `TOTP second factor verified`; cross-session
revoke kills the target session; audit chain verify `{ok:true, gaps:0}`;
tampering a live row → `{ok:false, brokenAtId:<id>}`, restore → ok;
PM/ACCOUNTANT: settings GET 200 / PATCH **403**; MEMBER: `/settings` 307,
API 403; spoofed webhooks 401; secret rotation shows `configured (••7654)`
while the stored value stays sealed; unbalanced opening balance 400, balanced
posting → ledger tx; backup job → 1.4 MB snapshot; retention job green;
CSP/nosniff/Referrer/Permissions headers on every response; feature flag
M21:false removes Telegram from the nav, true restores it.

**Tests**: `tests/security-settings.test.ts` (15) — RFC-6238 vectors +
window, challenge binding/expiry, seal/tamper/mask, enrollment gate, PII
masking, chain verification (mutation + gaps), settings defaults/audit/flags,
secret rotation with env fallback + no-plaintext-at-rest, opening-balance
posting (balanced + unbalanced), backup snapshot + prune, retention purge,
rate limiter, S3 presign shape. Full gates: **40 files / 371 tests green
(×2 + post-fix rerun)**, tsc 0, eslint 0, `: any` 0, matrix snapshot
unchanged.

**Re-verification (follow-up Phase-21 session, 2026-09-04)**: after an
environment reset (`npm ci`), all gates re-run green (40/371 ×2, tsc/eslint/
`: any` 0, matrix 7) and the full acceptance smoke re-executed end-to-end —
sealed-secret recovery → challenge login (no cookie at password step, wrong
code 401, valid code in) → audit chain ok → live tamper → `brokenAtId` →
restore → ok → member/PM negatives → spoofed webhook 401 → backup snapshot.
No code changes; dev.db backfilled chain intact (25/25 rows).

**M28 settings wiring audit (fourth Phase-21 session, 2026-09-04)**: found
and fixed the split-brain config surface — the M28 Settings UI wrote `m28.*`
keys that **no engine consumed**, while the seed's legacy keys
(`org.profile`, `billing.dunning`, `billing.lateFee`) silently fed the
engines. Unified on `getSettings()` as the single source: the dunning sweep
now reads `m28.billing.dunningDays` and only marks invoices overdue **after
the configured `graceDays`**; `applyLateFees` falls back to the M28
late-fee defaults (mode flat/percent/none) when no active M06 rule exists;
`allocateInvoiceNumber` prepends `m28.billing.invoicePrefix` (live: job
generated `BP-BLR-2026-0001/2`); invoice PDFs read org name + currency from
`m28.org`/`m28.locale` (legacy `org.profile` retired, seed unified);
`formatMinor` picks up the org-wide display currency via the admin layout;
new `m28.templates` group overrides member notification bodies with `{var}`
substitution (live: outbox rendered "Merci! Receipt RCP-2026-0001 for
$100.00." while non-overridden events kept defaults) + templates card in the
settings UI. 5 new wiring tests (20 in the suite): prefix end-to-end through
`generateInvoices`, grace gating both sides, M06-rule-wins/M28-fallback +
mode-none, template substitution, legacy-key independence. One cross-suite
lesson re-learned: a fixture late-fee posting leaked into the billing
suite's exact chart-mapping deltas (vitest size-desc order flipped) — fixed
by reversing the fixture posting (append-only net-zero). Gates: 40 files /
**376 tests** green ×2, tsc 0, eslint 0, matrix 7.

**Penetration sweep (third Phase-21 session, 2026-09-04)**: the §M27
acceptance checklist executed at full breadth — 480 API probes (81 routes ×
6 roles vs §5 matrix: **0 leaks**), 174 page probes (29 pages × 6 personas:
307/EmptyState, no data), IDOR (out-of-scope property → empty set, own-scope
lists), escalation (all cross-role writes 403), webhook spoof/replay (401 /
ignored), rate limit (429 on the 11th login), TOTP gate on an un-enrolled
ADMIN. **One real bug found & fixed**: seed called `seedUsers()` before
`seedProperties()`, so fresh DBs silently left PM/STAFF without property
assignments (PM/STAFF `/api/reports` → 403 "No reporting scope"). Order
swapped, verified on a fresh `migrate reset + seed`. Sweep details in
`docs/SECURITY.md` §0. Gates re-run after the seed fix: 40 files / 371 tests
green, tsc/eslint 0.

## Phase 20 — Reports (M26) — 2026-09-04

**Shipped**
- **Registry** (`src/lib/reports/registry.ts`): all 12 §M26 reports with key,
  title, category (`ops` / `finance` — drives role visibility), the **source
  line** (the traceability surface: e.g. collections = confirmed
  PaymentAllocations = Σ ledger credits to 1300 refType payment), columns and
  dateFiltered flag. Source lines render on the reports page and in the PDF.
- **Scope qualifiers** (`scope.ts`): GLOBAL (`M26:read`) → all active
  properties; OWNER → own buildings' properties and only
  `owner-statement-history`; PROPERTY_MANAGER/STAFF `ops` reports on their
  properties; ACCOUNTANT `finance`; MEMBER none. Out-of-scope property filter
  degrades to an empty result set (no sentinel hacks).
- **Service** (`service.ts`): `runReport(key, filters, scope)` → rows/summary/
  columns/source/asOf for all 12 + `getDashboardKpis` (occupancy % from Room
  statuses, billed vs collected for the month, arrears total, open tickets,
  cash position = Σ(debit−credit) on 1100+1200 **org-wide** — accepted v1
  simplification, noted here per traceability). Global callers may pass an
  empty propertyIds list; runReport normalizes it to all active properties so
  ledger-based reports (P&L) see the portfolio. Expense-vs-budget: budgets
  have no property dimension (§M20) → budget rows scoped via
  category.propertyId. Collections ledger side **pairs each refType-"payment"
  transaction with its still-confirmed Payment via refId** (and skips
  reversals) so refund reversals and removed payments drop out of both sides
  of the reconciliation.
- **Export**: RFC-4180 CSV (`toCsv`, CRLF, quoted; summary appended as k/v
  rows) and branded PDF (`report-pdf.tsx`, @react-pdf with textkit ≤6.3 kept
  CJS-safe per the External-Sources note) via
  `GET /api/reports/[key]/export?format=csv|pdf`. `parseQuery` added to
  `lib/api.ts` for the zod query schemas.
- **UI**: `/reports` page — server-rendered table per report with the source
  line and summary, plus a client picker (date range / month / property) and
  CSV/PDF links; dashboard KPI strip added after the main grid.

**Acceptance (live smoke, dev server)** — every report number traces to its
declared source: invoice-generation job → 2 invoices issued (BLR-2026-0001/2,
$145.33 + $265.00) → cash payment PMT-2026-0001 $100.00 confirmed →
collections-arrears returns **collections = ledger = 100.00**,
**Σ buckets = arrears = $310.33** with `reconciles: "yes"`; P&L (2026-09)
rent 387.10 + service 23.23 = **NET 410.33** = both issued invoices;
occupancy 1/21 rooms = 5%. CSV export (CRLF, buckets) + PDF export (valid
1-page `application/pdf`) both 200; `/reports` renders all 12 titles;
dashboard renders the KPI strip. MEMBER: `/reports` → 307 → `/dashboard`,
API → `FORBIDDEN Missing permission M26:read`.

**RBAC** (§5 pre-existing grants — matrix snapshot unchanged): ADMIN M ·
ACCOUNTANT M · PROPERTY_MANAGER M · STAFF R · OWNER R · MEMBER –; qualifier
split (category × property) lives in `canSeeReport`.

**Tests**: `tests/reports-service.test.ts` (12) — registry completeness +
source-line traceability, role→category mapping, report builders against a
real DB copy (collections reconciliation incl. ledger pairing, aging sum
invariant, occupancy rollup, rent roll vs leases, P&L == M20 net for the same
month, expense-vs-budget, stock valuation math, dashboard KPIs). Full gates:
39 files / 356 tests green (×2), tsc 0, eslint 0, `: any` 0, matrix snapshot
unchanged. Suite runs on a disposable copy (`npm test`); the reports suite
skips when its fixture preconditions are absent.

## Phase 19 — Telegram Bot (M21) — 2026-09-04

**Shipped**
- **§15 v1.3 (spec amendment before code)**: the §M21 event list names
  *statement ready (owner)* but the §5 matrix gave OWNER `–` on M21 — owners
  could never link a chat, leaving that event without a possible recipient.
  OWNER M21 → **O(link)** (self-service link/unlink + toggles, mirroring the
  MEMBER O(link) semantics); STAFF stays `–`, so staff chats are bound by an
  Admin (M21:update) via `/api/telegram/admin-link`.
- **Schema** (migration `20260911090000_phase19_telegram_bot`): `TelegramLinkCode`
  (8-char A-Z2-9 one-time code, member/owner-bound, 15-min TTL, superseded on
  re-issue), `TelegramLink` (unique chatId → principal member|owner|user,
  `prefs` JSON toggles), `TelegramOutbox` (every send attempt: sent | mocked |
  failed — the acceptance evidence table).
- **Webhook** `POST /api/telegram/webhook`: signature FIRST — Telegram echoes
  the setWebhook secret in `X-Telegram-Bot-Api-Secret-Token`; timing-safe
  compare, mismatch → 401 (§M21 acceptance). Commands: `/link <code>` (also
  accepts the `?start=` deep-link payload), `/status`, `/dues`, `/pay` (QR via
  the existing M13 `createInvoiceQr` — amount always the invoice's due),
  `/unlink`, `/help`; unknown commands get help; unlinked chats get linking
  instructions. Member chats resolve the bound profile only — own data by
  construction. Per-chat command throttle.
- **Dispatcher** (cron shape `POST /api/jobs/telegram-dispatch`, wiring Phase
  21): drains the DomainEvent log with a persisted cursor (Setting
  `telegram.dispatchCursor`), maps events → templates per §M21 — invoice
  issued, payment confirmed (**receipt message**), dunning reminder, ticket &
  complaint transitions (reporting member), statement ready (owner), low stock
  and the occupancy digest (staff chats) — gated by per-user toggles; bogus
  payloads never stall the cursor; idempotent re-runs send nothing.
- **Portal + admin UI**: TelegramCard on the tenant portal (Me) and owner
  portal — generate code + t.me deep link, linked state, 8 toggles, unlink;
  `/telegram` admin console — linked chats, outbox (last 20), staff-chat
  binding, dispatch/digest triggers. Nav stub wired to `/telegram`.
- **RBAC** (§5 + §15 v1.3): F SUPER_ADMIN · M ADMIN · – everyone else ·
  O(link) MEMBER and OWNER. `matrix.test.ts` snapshot updated intentionally;
  live negatives: spoofed webhook 401, no-portal-session API → 401.
- **Delivery**: `TELEGRAM_BOT_TOKEN=dev-*` → mock sender (outbox `mocked` +
  console); a real token POSTs to api.telegram.org and records sent/failed.
  Env: TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET / TELEGRAM_BOT_USERNAME.

**Acceptance (live smoke, dev server)** — Chan Ling links chat 900100 via a
portal-generated code → `/dues` lists only her invoices ($145.33 + $265.00) →
`/pay` starts QR `PMT-2026-0001` (M13) → signed gateway webhook confirms
(`RCP-2026-0001`) → dispatch job → **`✅ Payment received — RCP-2026-0001 for
$145.33. Thank you!`** lands in chat 900100, plus the two `invoice_issued`
notices. Spoofed webhook → **401**. Owner (Lim Hout, §15 v1.3) links chat
900300 via `/start <code>` → September statement approved → dispatch →
`📊 Owner statement STM-2026-0001 (2026-09) is ready — net payout $78.48`.
Admin-bound staff chat 900200 receives the occupancy digest.

**Tests**: `tests/telegram-service.test.ts` (12) — signature, link lifecycle
(replay/expiry/supersede), command scoping (own dues totals vs another
member's chat), /pay QR intent, prefs gating, dispatcher (receipt message via
a real QR payment + webhook, statement_ready, low stock, cursor idempotency,
digest on/off). Order-tolerant fixtures (portal suite leaves LSE-0001 in
notice; earlier suites purge/pay invoices — the suite re-activates and reopens
an invoice on the disposable copy). Full gates: 38 files / 344 tests green
(3×), tsc 0, eslint 0, `: any` 0, pristine probe (telegram tables 0, OWNER
M21 OWN grants seeded).

## Phase 18 — Tenant Portal (M25) — 2026-09-04

**Shipped**
- **OTP login (§M25)**: `MemberOtp` migration `20260910090000_phase18_tenant_portal`
  (+ `Announcement` for the §M25 dashboard feed). `POST /api/portal/otp/request`
  accepts a party email or phone (normalized, case-insensitive, digits-only phone
  compare); unknown identifiers answer the same generic shape (no enumeration).
  Codes: 6 digits, sha256 at rest, 10-min TTL, single-use, max 5 attempts →
  LOCKED; superseded on re-request; per-IP rate limits. Delivery v1 = **dev
  echo** (response `devCode` + console line when NODE_ENV !== production) — a
  real mail/SMS provider lands with M21/M28. `verify` materializes the member's
  **User (role MEMBER)** — party-linked, random unusable password, synthetic
  `@portal.internal` email on conflicts — and opens a normal M01 session, so
  the whole RBAC/OWN-visibility stack applies unchanged.
- **Portal API layer** (thin, strictly OWN): `/api/portal/me` (dashboard
  aggregation: room/lease, balance = Σ open invoice dues, deposit, open
  tickets/complaints, announcements, pending room move), `/api/portal/
  announcements`, `/api/portal/notices` (move-out notice on the member's OWN
  lease via **shared `giveNotice`** — extracted from the M05 staff route, no
  duplicate business logic), `/api/portal/vacant-rooms` (room-move targets).
  Everything else maps onto the existing module APIs (§M25 rule): invoices
  M07, QR pay M13 (`/api/invoices/[id]/qr` + webhook), payments M09,
  maintenance M19 (`source: "portal"`), complaints M22, room moves M16
  (`requestedByRole "member"`), deposits M10, documents M17.
- **Mobile-first PWA** (`/portal`, route group `(portal)`): manifest +
  viewport/theme; bottom-tab shell (Home/Rent/Requests/Docs/Me); OTP login
  screen with inline demo-code chip; dashboard; invoice list → detail with
  line items + QR pay panel (creates the intent, polls the payment until the
  gateway webhook settles); requests hub (maintenance ticket, complaint,
  room-move request from live vacant rooms, move-out notice); documents
  (upload → M17, KYC chip auto-refreshes); profile + deposit + sign out.
- **Member-own path fixes** (gaps the phase exposed): `DocumentRegistry`
  MEMBER uploads/reads now resolve `ownerUserId` from the member's portal user
  (OWN-scope M17 worked only for owners before); **M07 invoice list** built a
  contradictory where for OWN-only callers (`propertyId: { in: [] }` AND the
  member arm) — replaced with a plain OR of the non-empty scope arms.
- **RBAC** (§5 row unchanged): F SUPER_ADMIN · M ADMIN · all staff – · MEMBER O.
  Live negatives: staff `/api/portal/me` → 403; anonymous `/portal` → 307
  (login); member OTP login → full journey works.

**Acceptance (live smoke, dev server)** — Chan Ling (OTP `chan.ling@…`, dev
echo): dashboard (room A1-01, balance $410.33, announcements) → invoice list
(2 open) → QR intent for BLR-2026-0001 ($145.33, devmock 3166-byte data-URL
QR) → signed gateway webhook → `PMT-2026-0001/RCP-2026-0001` confirmed,
balance **$265.00** → complaint `CMP-2026-0001` (source portal) + ticket
`TK-2026-0001` → both tracked in the member's own lists → room-move request
`MOV-2026-0001` (requestedByRole member, 15 vacant-room options). No staff
step anywhere in the journey.

**Tests**: `tests/portal-service.test.ts` (6) — OTP lifecycle (no
enumeration, lockout, expiry, replay, hashed at rest), member-User
materialization (MEMBER role, idempotent, email-conflict fallback), shared
giveNotice (M05 semantics, member-status follow, INVALID_TRANSITION), scoped
queries. Full gates: 37 files / 332 tests green (2×), tsc 0, eslint 0,
`: any` 0, pristine probe (memberOtp 0, announcements 2 — seed guarded:
`db:reset` seeds twice).

## Phase 17 — Owner Statements (M24) — 2026-09-04

**Shipped**
- **§15 v1.2 (spec amendment before code)**: added ledger account **3900 Owner
  Distributions (EQUITY)** — §M20's P&L lists payouts separately from operating
  expenses, so accruals need an equity home. Approval posts **DR 3900 / CR 2200**
  (refType `statement_accrual`); payout posts **DR 2200 / CR 1100|1200**
  (refType `payout`). Payouts are NOT M09 Payment rows (a P&L payout term read
  as Σ debits of `payout` must equal cash distributed without double-counting
  an expense account). 3900 is seeded with the system chart; no CRUD until M28.
- **Schema** (migration `20260909090000_phase17_owner_statements`): `OwnerStatement`
  (unique `STM-YYYY-NNNN`, owner/contract/building/property links, `month`
  unique per contract, status `draft|approved|paid`, the six amount columns
  `collected/grossShare/managementFee/passthrough/ownerMaintenance/adjustments/net`
  in minor units, `lineSnapshot`, `ledgerTxId` unique, `paidVia|paidAt|paidById`,
  `statementDocId` unique → M17 PDF, who/when stamps for generate/approve/pay);
  `ExpenseCategory.chargeTo` (`company|passthrough|owner_maintenance`, default
  `company`); settings key `statements.generationDay` (default 5).
- **Generation** (`POST /api/statements/generate`, job shape at
  `/api/jobs/statement-generation` — cron wiring is Phase 21): month defaults to
  the previous UTC month; active contracts with `startDate < month end`; due when
  UTC today ≥ `payoutCycleDay` (`force` bypasses); **idempotent per contract+month**;
  collections = confirmed `PaymentAllocation`s in the month routed through
  `invoice.lease.room.floor.buildingId`; pass-through/owner-maintenance expenses =
  approved expenses in the month with `category.chargeTo` set, attributed
  property → contracted building (v1: one contract per property).
- **Math** (`statements-math.ts`, pure): `FIXED_RENT` → gross = master rent;
  `REVENUE_SHARE` → gross = round(collected × share%); fee = round(gross × fee%);
  net = gross − fee − passthrough − ownerMaintenance + adjustments (negatives
  kept exact; share/fee clamped 0..100).
- **Lifecycle**: ± adjustments on drafts only (reason mandatory, audited);
  approval (Accountant+ = GLOBAL M24:update, mirrors the M10/M20 precedent)
  posts the accrual and auto-files the PDF to M17 (entity `STATEMENT`,
  docType `statement`); payout records `paidVia cash|bank_transfer`, posts
  **DR 2200 / CR cash|bank** and returns `ownerPayableBalanceMinor` — the
  acceptance proof that Owner Payable is back to its pre-statement balance.
  Non-positive nets cannot be approved (`NOTHING_TO_ACCRUE`).
- **UI**: `/statements` admin page (status badges, month filter, Owner Payable
  balance from the 2200 ledger aggregate, generate/adjust/approve/pay dialogs,
  render only for managers); owner portal card with per-statement PDF links
  (own statements only — OWN scope, server-enforced).
- **RBAC**: F SUPER_ADMIN · M ADMIN/ACCOUNTANT · R PM · – STAFF · O(owner, own) ·
  – MEMBER. Live negatives: staff generate/list → 403, PM approve → 403,
  owner2 sees only `STM-2026-0002`.

**Acceptance (live smoke, dev server)**
- Mixed-collections month: billed LSE-0001 (prorated Aug 145.33 + Sept 265.00),
  confirmed one payment (PMT-2026-0001, `RCP-2026-0001`) with two allocations →
  `generate month=2026-09 force` → `STM-2026-0001` collectedMinor **41033**
  = Σ confirmed ledger allocations for Building A (41033, Δ=0); gross 24620
  (60%), fee 2462 (10%), passthrough 4500 → net 17658.
- Adjust −10.00 (reason audited) → net 16658 → approve → `statement_accrual`
  3900 DR / 2200 CR 16658, PDF filed (`STATEMENT`/`statement`, 3132 bytes,
  served on first request from M17) → pay `bank_transfer` → `payout` 2200 DR /
  1200 CR 16658, **ownerPayableBalanceMinor 0**; double-pay → 422;
  no-reason adjust → 400.

**Tests**: `tests/statements-math.test.ts` (6) + `tests/statements-service.test.ts`
(7, self-driving DB copy: bills, pays, backdates into August, dedicated
passthrough fixture category; idempotency, reconciliation, accrual/payout
posting, P&L payout term, guarded negative net). Full gates: 36 files /
326 tests green (2×), tsc 0, eslint 0 (legacy unused-var leftovers cleaned),
`: any` 0, pristine probe (ownerStatement 0, account 3900 EQUITY, chargeTo
flags, generationDay 5).

## Phase 16 — Expenses & P&L (M20) — 2026-09-03

**Shipped**
- **Schema** (migration `20260908090000_phase20_expenses`, append-only): `ExpenseCategory`
  (unique per property+name, `accountCode` app-validated to the ledger expense accounts
  **5000 Operating / 5100 Bank fees**), `Expense` (unique `EXP-YYYY-NNNN`, vendor, business date,
  `amountMinor`, `paidVia` cash|bank_transfer — the §M20 "paid_via M09", status machine
  `pending → approved | rejected`, `approved → voided`, `autoApproved` flag, who/when stamps for
  submit/approve/void, `receiptDocId` unique → the M17 attachment, `ledgerTxId` unique), 
  `ExpenseBudget` (unique category+month — §M20 "budgets per property/category/month"),
  `RecurringExpense` (template with run day 1–28, `lastRunMonth` idempotency). 
  `DocumentRegistry` gained the expense back-link; **DOC_ENTITIES += EXPENSE**.
- **Approval rule (§M20 "approval required above configurable threshold")**: threshold lives in
  settings (`expenses.approvalThresholdMinor`, default $500). At/below → **auto-approve on
  create** (ledger posts immediately); above → `pending` until an Accountant approves. The
  approval gate mirrors the §M10 deposit-refund precedent: **GLOBAL M20:update = Accountant+**
  (Staff W records but cannot approve; PM R is read-only — the matrix action sets can't separate
  them, scope can). Category/budget/recurring management is also Accountant+.
- **Ledger integration (§M20 acceptance: "record expense with receipt → ledger posts")**:
  approval posts `DR category.accountCode / CR 1100|1200` (refType `expense`, propertyId on
  transaction + entries); **void posts a ledger reversal** (refType `expense_void`) — the
  append-only ledger is never touched by edits, so register and ledger can never drift apart by
  construction. Rejected expenses never post.
- **P&L** (`pl-math.ts` pure + `profitAndLoss`): built **from the ledger** — revenue = Σcredit−Σdebit
  on 4xxx, expenses = Σdebit−Σcredit on 5xxx, owner payouts = balanced totals of `payout`
  transactions (the §M20 formula's third term; 0 until M24 lands), `net = revenue − expenses −
  payouts`, per property or consolidated. The **register↔ledger reconciliation** section compares
  the approved-expense register per account against the ledger (Δ must be 0 — the report carries
  `reconcilesExactly`). Budget-vs-actual variance per category (business-date month).
- **Receipt attachment (M17)**: the upload route now resolves `entity=EXPENSE` (property-scoped,
  audit named by expense code) and **auto-links itself as the expense's receipt** — create the
  expense, upload against it, done.
- **Recurring templates**: `POST /api/expenses/recurring` + `/[id]/run` materializes the month's
  expense through the normal create path (threshold rules apply), idempotent per month
  (`lastRunMonth`), `NOT_DUE` before the run day.
- **Routes** (9): `/api/expenses` (list scoped, create), `/[id]/{approve,reject,void}`,
  `/categories`, `/budgets`, `/pl`, `/recurring` (+`/[id]/run`). Read scope: GLOBAL → all
  properties, Manager → assigned, **Owner R(own) → owned buildings' properties** (same
  visibility as invoices), Member — none.
- **UI**: `/expenses` — month stat badges (revenue/expenses/net + reconciles-✓ + pending count)
  and month switcher; manager toolbar (record, approve/reject/void, new category, budget,
  recurring create/run — permission-aware); two-column P&L (statement + reconciliation &
  budget-variance cards); expenses table with status/receipt. Nav entry live.
- **Seed**: `seedExpenses()` — 5 BLR categories (4× 5000, Bank fees 5100), September budgets for
  Internet (300.00) and Repairs (1,000.00), recurring "Orange Fibre" 220.00/day-5, threshold
  setting 50000.

**Acceptance (§M20, live)** —
- *Expense with receipt → ledger posts*: `EXP-2026-0001` CleanCo 180.00 cash (receipt PDF
  uploaded + auto-attached) — **auto-approved ≤ threshold**, ledger DR 5000/CR 1100;
  `EXP-2026-0002` ACME HVAC 1,200.00 bank → **pending**; staff approve → **403**
  (FORBIDDEN, "requires Accountant+"); Accountant approves → DR 5000/CR 1200; staff records
  `EXP-2026-0003` 14.50 → later voided → **ledger reversed** (net zero).
- *P&L matches ledger totals exactly*: after the September billing job (2 invoices: rent 387.10
  + service 23.23) the September property P&L shows revenue 410.33, expenses 1,420.00 (after the
  void), net −1,009.67, **`reconcilesExactly: true` with Δ = 0 on every account**; whole-ledger
  check ΣDR = ΣCR = 185,933 (BALANCED).
- *Budget vs actual variance*: Internet 300.00 budget / 0 actual → +300.00 under; Repairs
  1,000.00 / 1,214.50 → **−214.50 over**; unbudgeted spend rows appear without variance.
- *Recurring*: seeded day-5 template correctly `NOT_DUE` on the 3rd; a day-1 template
  materialized `EXP-2026-0004` and a re-run returned `{skipped:true}`.
- *RBDC negatives*: member → no access; owner (owns BLR buildings) → P&L 200; owner2 (other
  buildings) → **403** on BLR.

**Tests**: `tests/pl-math.test.ts` (6 pure — month windows, credit/debit-normal rollups with
reversals, net formula, reconciliation drift flagging, budget variance incl. budget-without-spend
rows, variance states) + `tests/expenses-service.test.ts` (9 DB-backed, baseline-tracked ledger
deltas — category account validation + dupes, auto-approve posting, pending→approve posting with
per-entry account checks, reject-no-posting, void reversal back to baseline, receipt-entity
validation, budget upsert + exact reconciliation, consolidated scope, recurring idempotency).
**npm test 34 files / 313 PASS.**

**Fixed during this phase**
- The M17 upload route still rejected everything but MEMBER/OWNER ("until Phase 5+") — EXPENSE
  resolution + auto-link added (receipts now flow §M20 without a new endpoint).
- `setBudget` validated the month shape but not the range ("2026-13" passed) — now uses the same
  month-window parser as the P&L.

**Gates**: tsc 0 · lint ✔ · `: any` 0 · **npm test 34 files / 313 PASS (0 skipped)** · db:reset
pristine (0 expenses/ledger rows; audit = 2 seed rows; categories 5) · live smoke above
(pages + routes 200, ledger balanced).

---

## Phase 15 — Attendance (M23) — 2026-09-03

**Shipped**
- **Schema** (migration `20260907090000_phase15_attendance`, append-only): `Shift` (per-property
  templates, minute offsets where endMinute > 1440 = night shift crossing midnight, grace minutes,
  unique `property+name`), `OvertimeRule` (one per property: `afterMinutes` floor + `multiplierBp`
  basis points = the §M23 "simple multipliers"), `AttendanceRecord` (unique `user+workDate`,
  clock in/out timestamps, per-punch geo coordinates + inside/outside/unknown status,
  `minutesWorked`/`overtimeMinutes`, source kiosk|mobile|manual, edit stamp `editedBy/At/Reason`),
  `AttendanceException` (record-linked, open→resolved with who/when/why). Property gains the
  optional geofence (`geoLat/geoLng/geofenceRadiusM`), User gains `kioskPinHash`. SQLite has no
  native `Date` (§15 v1.1 portability) — `workDate` is a UTC-midnight `DateTime`.
- **Kiosk PIN (§M23)**: PINs are `sha256(pepper:pin)` — deliberately indexable so a PIN maps to at
  most one user; the endpoint is rate-limited (20/min/IP) like login. PIN is the credential on the
  shared terminal (no session); self-service PIN setup plus manager-set PINs (M23:update). Mobile
  path = session-authenticated self clock (`O(clock)` OWN override added to the RBDC catalog).
- **Pure math** (`attendance-math.ts`): month windows, UTC work dates, haversine geofence check,
  shift materialization/matching (containing window else nearest start), punch derivation —
  late beyond grace, early leave, overtime beyond span+rule floor, missed_clock_out past the
  16h staleness threshold, geofence violations — plus the summary reducer and RFC-escaped CSV.
- **Service** (`attendance-service.ts`): `clockByPin`/`clockBySession` (open-punch and same-date
  guards, shift matching, exception reconciliation on every write — open derived rows regenerate,
  resolved rows never re-open); `createManualRecord`/`editRecord` (**reason mandatory**, who/why
  stamped, minutes recomputed, audit + event — §M23 "no edit without audit"); `sweepStaleOpen`
  (flags >16h open punches as missed_clock_out); `resolveException`; `monthlySummary` (per-staff
  days/minutes/OT/late/early/open-exceptions + the property's OT multiplier); `exportCsv`
  (one row per record).
- **Routes** (10): `POST /api/attendance/kiosk` (PIN, rate-limited), `…/mobile` (session self),
  `GET|POST /api/attendance/records` (+`POST …/[id]/edit`), `GET /api/attendance/exceptions`
  (+`POST …/[id]/resolve`), `GET /api/attendance/summary`, `GET /api/attendance/export` (CSV
  attachment `attendance-<prop>-<month>.csv`), `POST /api/jobs/attendance-sweep`, `POST
  /api/attendance/kiosk-pin`. Reads scope via §5: property readers see the property, Staff OWN
  sees own rows (`attendanceScope` helper); mutations M23:update in property scope.
- **UI**: `/attendance` — kiosk card (PIN pad + clock IN/OUT, mobile buttons, self PIN dialog),
  manager tools (manual entry, correct punch, resolve exception, sweep, CSV export link),
  month records table (edited badge, exception chips) and the open-exception report. Nav entry live.
- **Seed**: `seedAttendance()` — BLR geofence (Phnom Penh, r=200 m), Morning 08:00–16:00 +
  Evening 16:00–24:00 shifts, ×1.5 OT rule; demo kiosk PINs **staff 246810 / pm 135711 /
  root 112233**.

**Acceptance (§M23, live)** —
- *Kiosk*: bad PIN → 401; staff PIN 246810 clocks IN at 16:11 → matched to "Evening 16:00–24:00",
  geofence **inside**; clocks OUT (7-second punch: minutes 0, late 11 min + early 469 min derived
  by the rules — consistent, if pedantic); audit rows attributed to Ratana Kim.
- *Missed punches*: manual entry (yesterday 08:00, no clock-out, reason mandatory) → sweep flags
  **1** missed_clock_out; exception report lists open items; resolve with note sticks
  (`ALREADY_RESOLVED` on repeat).
- *Export matches records*: summary shows per-staff totals (1 day, OT ×1.5 rule) and the CSV
  (`attendance-blr-2026-09.csv`) has exactly one row per record with the header
  `date,staff_name,staff_email,shift,clock_in,clock_out,minutes,overtime_minutes,source,exceptions,note`.

**Tests**: `tests/attendance-math.test.ts` (11 pure — windows, haversine/geofence, night-shift
spans, shift matching, punch derivation incl. OT floor + stale threshold, CSV escaping, summary
reducer) + `tests/attendance-service.test.ts` (10 DB-backed — PIN auth, open-punch/date guards,
minutes + OT + exception derivation, geofence flag, audited manual entry/correction, sweep,
resolution finality, monthly summary, export-matches-records). **npm test 32 files / 298 PASS.**

**Fixed during this phase**
- The stale dev server predated `prisma generate` and 500'd the kiosk route
  (`Unknown argument kioskPinHash`) — restarted; hot reload does not refresh generated clients.
- `monthlySummary` initially shipped with a bogus late-minutes shortcut — rewritten to derive
  per-record via `computePunch` (late/early now consistent everywhere).

**Gates**: tsc 0 · lint ✔ · `: any` 0 · **npm test 32 files / 298 PASS (0 skipped)** · db:reset
pristine · live smoke above (pages + routes 200).

---

## Phase 14 — POS & Stock (M14, M15) — 2026-09-03

**Shipped**
- **Schema** (migrations `20260906090000_phase14_pos_stock` + `…091000/092000/094000`, append-only):
  `Supplier` (`name` unique), `StockItem` (category/unit, `minQtyMilli` threshold, optional supplier,
  unique `name+propertyId`), `StockMovement` (**append-only** — qty signed milli, snapshot
  `qtyAfter/avgCostAfter/valueMilli` per row, FKs to sale/ticket/stocktake/target item for
  transfers), `Stocktake` + `StocktakeLine` (expected/counted/variance + `valueDeltaMilli`),
  `PosProduct` (unique name, optional `stockItemId` = the M14↔M15 link), `PosSession`
  (float/expected/counted/variance, one open per property), `PosSale` (unique code `SAL-…`,
  `invoiceId` unique → the charge-to-room invoice, `receiptDocId`), `PosSaleItem`.
  `MaintenanceCost.stockItemId` (a plain string since M19) is now a **real FK** — the "stock-later-M15"
  placeholder is linked.
- **M15 math** (`src/lib/operations/stock-math.ts`, pure): moving average
  (newAvg = (qty·avg + added·cost)/(qty+added), half-up), valuation (qty × avg), `isLowStock`
  (≤ threshold), stocktake variance (counted − expected). Quantities/costs are integer milli
  (1 unit = 1000; minor × 1000) — exact money, no floats.
- **M15 service** (`stock-service.ts`): `applyMovement` tx-core is the **only** writer — every
  change is a movement row (`purchase | sale | consumption | maintenance_use | adjustment |
  transfer`); there is no direct qty edit anywhere. `purchaseStock` blends the moving average;
  sales/consumption exit at the current average (zero-out keeps the last avg);
  `consumeForTicket` posts a `maintenance_use` movement **and** a material `MaintenanceCost` at
  moving average (chargeTo expense) — closing the Phase-13 "1 stock part consumed" hook;
  `runStocktake` (`STK-YYYY-NNNN`) writes lines + posts `adjustment` movements for variance ≠ 0
  and records `valueDeltaMilli`; `transferStock` (same property only — SAME_ITEM/OTHER_PROPERTY
  guards); `valuationReport` (per-item value + `lowStockCount`); crossing to/below threshold
  emits `stock.low` domain events.
- **M14 service** (`pos-service.tsx`): open session (float seeds `expectedCashMinor`,
  `SESSION_OPEN` guards one-open-per-property); `recordSale` (`SAL-YYYY-NNNN`) with methods
  cash/QR/card/**room_charge** — cash DR 1100, qr/card DR 1200, room charge issues a standalone
  one-time invoice `BLR-POS-<seq>` (due +7d) to the member and posts DR 1300/CR 4900; every
  method clears CR 4900; stock-linked lines pre-check availability (`INSUFFICIENT_STOCK`) and
  decrement via `applyStockSale`; closed sessions reject further sales; `closeSession`:
  expected = float + Σ cash sales, variance = counted − expected (`ALREADY_CLOSED` after);
  receipts auto-file to the M17 registry (entity **SALE**, docType receipt, idempotent).
- **Routes** (13): `/api/stock/{items,movement-audit via items/[id]/movements,purchase,consume,
  transfer,stocktakes,valuation,suppliers}` + `/api/pos/{products,sessions,sessions/[id]/close,
  sales}` + `/api/maintenance/tickets/[id]/consume-part`. Dollar-decimal route inputs (`qty`,
  `unitCost`, `float`, `counted`) convert to milli at the boundary. RBDC per matrix: M15
  create/update (purchase/consume/transfer/stocktakes/new items) property-scoped, reads scoped;
  POS open/sales M14:create, close M14:update; consume-part M19:update.
- **UI**: `/stock` (valuation cards with value + low-stock count, item table with on-hand/avg/min,
  purchase / consume / transfer / new item / stocktake dialogs, movement history drawer) and
  `/pos` (open/close session with **live variance preview**, sale cart dialog with method +
  charge-to-room member select) + nav entries.
- **Seed**: `seedStockPos()` — 2 suppliers, 5 BLR items (on-hand 0 by design: purchases happen
  through flows), 6 POS products (5 stock-linked + "Print / scan service").

**Acceptance (§M14/§M15, live)** —
- *M14*: session opened (float 50.00 → expected 5000) → 3 sales: `SAL-2026-0001` cash 3.00
  (3 colas), `SAL-2026-0002` QR 3.00 (noodles), `SAL-2026-0003` charge-to-room 0.60 (water → member
  Sophea Nuon, invoice `BLR-POS-026-0003` **issued** with a one-time line, due +7d) → close with
  counted 53.50 → expected 5300, **variance +50** reported on the close report; all three receipt
  PDFs filed (`receiptDocId` set, entity SALE).
- *M15*: purchased 10 cola @ 0.60 (avg 0.60) → sold 3 via POS → consumed 1 on `TK-2026-0001`
  (movement `maintenance_use`, material cost at moving avg, on-hand after **6.000**) → stocktake
  `STK-2026-0001` counted 5.9 → variance −0.1 → 1 adjustment movement, value delta −0.60;
  valuation report consistent (qty × avg per item, low-stock flags: cola 6 ≤ 12, water 23 ≤ 24,
  noodles 8 ≤ 10, detergent/coffee 0) — **4 `stock.low` events** emitted along the way.

**Tests**: `tests/stock-math.test.ts` (6 pure — blend, valuation, low-stock, variance) +
`tests/stock-service.test.ts` (9, baseline-tracked deltas on the seeded copy: purchase → POS-sale
leg → consume-for-ticket → INSUFFICIENT_STOCK → low event → stocktake → valuation → transfer) +
`tests/pos-service.test.ts` (8 — open/one-open guard, cash/QR/charge-to-room incl. invoice +
1300 posting + receipt filing, INSUFFICIENT_STOCK, close arithmetic 5000+200=5200 counted 6900 →
variance +1700, closed-session rejection). **npm test 30 files / 277 PASS.**

**Fixed during this phase**
- `PosSale↔Invoice` back-link initially landed on the wrong model (Lease) via a scripted patch —
  caught by `prisma validate` (the empty migration it produced was rolled back and replaced with
  `…094000`; never edit an applied migration).
- `consumeForTicket` cost was ×1000 (milli math double-applied): 1 cola @ 0.60 booked 600.00
  instead of **0.60** — test now pins 60 minor.
- `npm test` was silently running against **dev.db** (setup fallback `??=` kept the `.env` URL);
  the script now pins `DATABASE_URL=file:./test-billing.db` so tests can never touch dev data.
- `/api/stock/items` GET hid everything from GLOBAL holders (scope list came from property
  assignments only) — GLOBAL now means all properties, matching `visibleInvoicePropertyIds`.
- `pos-service.tsx` needed the classic-runtime `import * as React` for its JSX receipt call
  ("React is not defined" swallowed by the best-effort receipt `.catch`).

**Gates**: tsc 0 · lint ✔ · `: any` 0 · **npm test 30 files / 277 PASS (0 skipped)** · db:reset
pristine · live smoke above on the dev server (all pages 200).

---

## Phase 13 — Operations: Inspections, Maintenance, Complaints (M18, M19, M22) — 2026-09-05

**Shipped**
- **Schema** (migration `20260905090000_phase13_operations`, append-only): `InspectionTemplate`
  (checklist sections/items per room type as JSON), `Inspection` (type move_in|move_out|periodic;
  draft→completed|cancelled; captured items + score + auto-filed `reportDocId`; the reserved
  `Lease.moveOutInspectionId` column is now a real FK link), `InspectionFinding` (severity, photo
  evidence, ticket link, deduction proposal + status + tx link), `MaintenanceTicket` (category,
  priority, SLA dueAt/breached/escalated, assignee/vendor, resolution, room/lease/member links),
  `MaintenanceCost` (labor|material, `stockItemId` M15 hook, `chargeTo` expense|owner), `Complaint`
  (category/priority/source portal|telegram|staff, SLA fields, rating 1–5, unique `ticketId`
  cross-link), `ComplaintComment` (thread with optional photo).
- **§15 v1.1 hard gates landed**: `endLease` now requires BOTH dues = 0 **and** a completed
  move-out inspection (`MOVE_OUT_INSPECTION_REQUIRED`) — completing any move_out inspection sets
  `lease.moveOutInspectionId`. Room-move execution keeps inspections optional (§M16), it does not
  go through `endLease`.
- **M18** (`src/lib/operations/inspections-service.tsx` + `-machine.ts`): draft → complete with
  captured checklist (immutable JSON), score = passes/applicable (NA excluded), findings auto-built
  from fails (severity default minor); PDF report auto-files to the M17 registry (entity
  `INSPECTION`, docType `inspection_report` — added to `DOC_ENTITIES`); cross-links: finding →
  M19 ticket (priority derived from severity) and move-out finding → M10 deduction proposal →
  **approval executes the actual `deductDeposit`** (M10:update gated in the route) and links the
  deposit transaction. `React` import for the classic JSX runtime in tsx/vitest (same as
  billing/service).
- **M19** (`maintenance-service.ts` + `-machine.ts`): open → assigned → in_progress → resolved →
  verified/closed (+ cancelled from open/assigned); SLA hours urgent 4 / high 24 / medium 72 /
  low 168 computed at creation; costs with `chargeTo` routing; member-own create enforced in the
  service (portal/Telegram sources arrive with later phases). **SLA sweep**
  (`POST /api/jobs/sla-sweep`, M19:update): flags breached open tickets AND unacknowledged
  complaints, audits + emits `*.sla_breached` (escalation notifications ride M21/Phase 19).
- **M22** (`complaints-service.ts`): new → acknowledged → in_progress → resolved → closed; close
  is **member-own only** with a required 1–5 rating; comment thread; one-click conversion to a
  maintenance ticket (unique link + thread note). Complaint SLA hours high 24 / medium 72 / low 168.
- **Routes**: `/api/inspections` (+`/[id]/complete`), `/api/findings/[id]/{ticket,deduction}`,
  `/api/maintenance/tickets` (+`/[id]` op-style), `/api/complaints` (+`/[id]` op-style),
  `/api/jobs/sla-sweep`. RBDC per matrix: Staff W in property scope, Owner W on M19 (own
  buildings), Member O (own create/read/update on M19/M22, read-own on M18), Accountant — none.
- **UI**: `/inspections` (open/complete dialogs with mobile-friendly per-item capture, finding
  chips with ticket/deduction status, approve-deduction for M10 holders), `/maintenance` (ticket
  board with SLA badge, op buttons per state, cost dialog), `/complaints` (thread counts, convert,
  member rating dialog) — plus sidebar nav entries and four seeded checklist templates
  (STANDARD/DELUXE/STUDIO/SUITE).
- **Test-order hardening**: vitest orders DB suites by size, not name — `payments-service` (now
  `aa-payments-service.test.ts`) drops the Phase 8/10 append-only triggers on the disposable copy,
  purges leftovers and recreates them byte-identical before its cleanup; `deposits-service` scopes
  its ledger assertions to its own deposit/member. Fixtures elsewhere made re-run safe.

**Acceptance (§M18/M19/M22, live)** —
- *M18*: move-in INSP-2026-0001 completed (score 75, 1 major finding, PDF filed) and move-out
  INSP-2026-0002 completed (score 50, critical photo-backed finding, PDF filed); lease link set;
  damage → deduction proposal 150.00 → (deposit billed 500.00 via M10, paid via M09) → approved in
  M10 → `deduction:15000` movement, 2100 net = −35000 liability ✓; then lease completion passed the
  hard gate (`notes: "move-out inspection gate passed (M18)"`).
- *M19*: finding → TK-2026-0001 (priority high from severity) → assigned → in_progress → costs
  (labor 35.00 expense + material 12.50 owner) → resolved → verified → closed; SLA sweep clean
  (0 breached). Second ticket TK-2026-0002 open with 24h SLA.
- *M22*: CMP-2026-0001 acknowledged within SLA → staff comment thread → resolved → **member**
  confirmed + rated 5/5 → closed; CMP-2026-0002 converted one-click to TK-2026-0003 with thread
  note; staff-side close is blocked (member-own).
- *v1.1 gate negative* (test): lease end without a completed move-out inspection →
  `MOVE_OUT_INSPECTION_REQUIRED`.

**Tests**: `tests/ops-machine.test.ts` (11 pure — transitions, scoring/NA, finding extraction,
template parsing, SLA hours, cost totals, rating validation) + `tests/inspections-service.test.ts`
(7, self-contained David Cruz fixture incl. paid deposit invoice) + `tests/maintenance-service.test.ts`
(4) + `tests/complaints-service.test.ts` (5); deposits/services fixtures updated for the new gate.

**Gates**: tsc 0 · lint ✔ · `: any` 0 · **npm test 27 files / 254 PASS (0 skipped)** · db:reset
pristine (inspections/tickets/complaints/invoices/moves 0; audit = 2 seed rows; templates 4;
1 active lease) · server up post-reset (all pages 200).

---

## Phase 12 — Room Moves (M16) — 2026-09-03

**Shipped**
- **Schema** (`RoomMove` + back-links): code `MOV-YYYY-NNNN` (unique), status machine
  `requested → approved → executed | cancelled` (executed/cancelled terminal), `requestedByRole`
  member|staff, requester/approver/executor FKs, effective date, and the full money snapshot
  (`oldRent/newRent/rentCredit/newRentCharge/moveFee/net`, `depositDeltaMinor` kept for future
  terms that don't transfer 1:1), unique `newLeaseId` + `adjustmentInvoiceId`, inspections note.
  Migration `20260904090000_phase12_room_moves` (append-only).
- **Pure machine** (`src/lib/rooms/moves-machine.ts`): transition table + `computeMoveProration` —
  **both** rents prorated over the same window `[effectiveAt, periodEnd)` on the **old lease's**
  basis/cycleDay → `net = newCharge + fee − oldCredit` is the exact delta the member sees;
  `currentCycleStart` bounds how far back a move may target.
- **Service** (`src/lib/rooms/moves-service.ts`): preview (compute-only) / request / approve /
  cancel (requester while pending, or M16:update — enforced in routes) / execute. Execute: billing
  catch-up if the old lease is unbilled through today → **lease code allocated outside the tx**
  (numbering opens its own) → single `$transaction` (20 s): new lease (first period = the move
  window) → old lease terminated (`Room move <code>`) → **dual room status** (old → cleaning if
  vacated, new → occupied) → M12 assignments ended + parking/WiFi freed → deposit row repointed
  (2100 liability untouched) → **ONE adjustment invoice** = new lease's first period via
  `composeInvoice` (prorated new rent + move-fee one-time line − unused old-rent credit as
  invoice discount) + `invoiceIssueLines` posting → move row snapshot → audit + event **after
  commit** (in-tx `logAudit` on the global client deadlocks SQLite's single writer — same
  ordering as billing/service) → PDF filed. `EFFECT_IN_FUTURE` guard: execute only on/after the
  effective date, so the credit window is always money the old lease was actually billed for.
- **Routes** (`/api/room-moves` list+create, `/preview`, `/[id]/{approve,execute,cancel}`): RBDC
  per matrix row 12 — member-own via `partyId → memberProfile`, staff scoped, owner read-only
  (403 on create), cancel permission enforced in the route (service defers it).
- **UI**: `/moves` surface (request dialog with live preview, approve/execute/cancel row actions,
  invoice links) + **member timeline card** (room-move history with lease/invoice links and the
  proration delta) + sidebar nav (also removed the built M11/M12/M13 stub entries).
- **Seed**: `moves.moveFeeMinor` = 2000 (idempotent upsert; absent ⇒ 0).

**Acceptance (§M16, live)** — mid-month move LSE-0001 (Chan Ling, A1-01, $250.00, cycle day 1,
calendar) → A1-02 effective 2026-09-03:
- preview: new charge **23,333** − old credit **23,333** + fee **2,000** = **net 2,000** (28/30);
- portal/staff request `MOV-2026-0001` → execute-before-approve 422 → approve → execute 200
  (1.1 s): old lease `terminated (Room move MOV-2026-0001)`, new lease **LSE-0003** active with
  `nextBillingDate = 2026-10-01`, **A1-01 = cleaning / A1-02 = occupied**, exactly **ONE**
  adjustment invoice **BLR-2026-0003** (rent 23,333 prorated 28/30 + fee 2,000 − discount 23,333
  = **2,000**) on the new lease only, ledger D2,000 = C2,000, audit
  `requested/approved/executed` (M16), events `roommove.requested/executed`, full history on the
  member timeline; engine re-run does not double-bill the covered window;
- negatives: owner cross-member create **403**, execute cancelled **422**, future-dated execute
  **422 `EFFECT_IN_FUTURE`**, cancel-with-reason **200** → terminal.
- catch-up proof: old lease was unbilled (pristine DB) → execute first issued
  BLR-2026-0001 (Aug 15–Sep 1 stub 14,533) + BLR-2026-0002 (Sep 26,500) so the credit is real
  money previously billed — §9.4 gapless billing preserved.

**Tests**: `tests/moves-machine.test.ts` (10 — transitions, exact proration ints incl.
calendar-vs-30-day February divergence, full-cycle, currentCycleStart) +
`tests/moves-service.test.ts` (14 — self-contained fixture lease `LSE-MOVTEST` on A1-06 → A1-05,
equal rents ⇒ net = fee; RBDC negative, transition guards, preview deltas, ONE-invoice execution,
lease/room/deposit/ledger/audit/event assertions, engine no-double-bill, cancel path via the
**member-own** positive path; runtime `ctx.skip()` gate for dirty copies since
`describe.skipIf` evaluates before `beforeAll`).

**Gates**: tsc 0 · lint ✔ · `: any` 0 · **npm test 23 files / 227 PASS** · db:reset pristine
(0 invoices/ledger/moves, 1 active lease, audit = 2 seed rows, meters 4, `moves.moveFeeMinor`
2000) · server up post-reset (dashboard/moves/invoices/members/pay 200).

---

## Phase 11 — QR Payments (M13) — 2026-09-03

**Shipped**
- **Adapter interface (§M13)** (`src/lib/qrpay/adapter.ts`): `QrProvider` = `generateQR({amountMinor,
  ref, orgAccount}) → {qrString, imageDataUrl, expiresAt}` + `parseWebhook(payload) → normalized
  {gatewayRef|idempotencyKey, status}`. **DevMock first**: QR encodes
  `devmock://pay?ref=…&amt=…&acct=…`, rendered as a PNG data URL via the new pinned `qrcode`
  dependency (1.5.4 + @types 1.5.5); real providers (PromptPay/QRIS/UPI/gateway links) plug into
  `resolveProvider`.
- **Dynamic QR per invoice**: a Pay-by-QR intent **is an M09 pending payment** (method `qr`,
  explicit allocation to that invoice, deterministic idempotency key `QR:{invoiceId}:{due}`,
  gatewayRef `QRPAY-XXXXXXXX`) — so repeat clicks reuse the **same intent + same QR**, the M09
  confirm path (receipt, allocations, ledger) is reused untouched, and confirmation stays
  **exactly-once by construction** (§9.6 idempotency). Failed attempts regenerate under `:rN`
  keys; paid/void invoices return `NOTHING_DUE`/`INVOICE_VOID`.
- **Portal Pay button**: invoices list shows "Pay by QR" for open invoices (staff with
  M13:create in property scope, or the member's own invoices via M13:O); dialog renders the QR,
  polls `/api/payments/[id]` every 3 s (webhook + **polling fallback**, §M13), supports
  regenerate + check-now.
- **Webhook**: `/api/webhooks/payments` now normalizes **provider payloads** through the adapter
  (`provider: "devmock"` → `parseWebhook`), keeping the signed `x-webhook-secret` gate and the
  idempotent exactly-once semantics for both shapes.
- **Static/member QR — pay without login (§M13)**: stateless **HMAC-signed member tokens**
  (`memberId.base64url(mac)`, keyed off the webhook secret; timing-safe compare) in
  `qrpay/tokens.ts`. GET `/api/members/[id]/qr` (own or M02-scoped staff) renders the member's
  `/pay?m=<token>` QR — also printed on the member card UI and **embedded in open invoice PDFs**
  ("Scan to pay", react-pdf `Image` from the data URL). Public `/pay` page shows the member's
  outstanding invoices; public endpoints `POST /api/qrpay/dues|pay|status` are **rate-limited**
  (existing in-memory limiter), token-guarded, and the pay endpoint only ever charges the
  invoice's exact outstanding due (no free-form amounts without login). Room-lookup poster
  variant deferred (unauthenticated dues enumeration risk — revisit with signed room tokens).
- **New env**: `APP_BASE_URL` (default http://localhost:3000) for absolute scan targets.

**Tests** — 11 new (202 total, 21 files): adapter (QR shape/expiry, reject invalid amounts/refs,
webhook normalization incl. malformed/foreign payloads, DevMock-first resolution), tokens
(round-trip, tamper/malformed rejection, member-binding), service (intent creation with stable
gateway ref, re-click reuse, webhook exactly-once with duplicate delivery ignored + single
receipt/ledger event, `NOTHING_DUE` after settlement, member token dues resolution scoped to
open invoices).

**Live smoke** (§M13 acceptance, dev server): generated 2 invoices for LSE-0001 → Pay-by-QR on
BLR-2026-0001 → `PMT-2026-0001` pending + `QRPAY-60A16FB891` QR (re-click: same intent) →
simulated DevMock webhook delivered **twice**: first `{ignored:false, receiptCode RCP-2026-0001}`,
replay `{ignored:true}`; invoice `paid`, exactly 1 `payment.confirmed` event + 1 payment ledger
tx; further QR → 422 `NOTHING_DUE`. Member QR → public `/api/qrpay/dues` (Chan Ling, 26500 due)
→ public pay intent on BLR-2026-0002 → poll `pending` → webhook → `confirmed`, invoice paid.
Negatives: garbage token 401 `INVALID_TOKEN`, owner fetching Chan's member QR 403. Invoice PDF
renders with the QR image (filed while open). DB reset pristine; all gates green.

**Note**: no schema change this phase — QR intents live on the existing `Payment` model
(method `qr`, `gatewayRef`, `idempotencyKey`); member QR tokens are stateless HMACs.

## Phase 10 — Utilities & Services (M11, M12) — 2026-09-03

**Shipped**
- **M11 data model**: `Meter` (elec|water|gas, unique code, bound to a room), `MeterReading`
  (value in **milli-units ×1000** — exact decimal consumption math in integers; unique per
  meter/day; estimated + source flags), `Tariff` (unit rate, optional **progressive tiers**
  JSON, property-specific or org-wide, effectiveFrom), `UtilityCharge` (1:1 with a reading,
  pending → billed with invoice/invoiceItem linkage, **anomaly flag**).
- **M11 rules (§M11)**: charge = (reading − previous) × tariff, half-up rounding; first reading
  is a baseline (no charge); **estimated readings = average of last 3, flagged** (needs ≥3);
  **spike anomaly when consumption > 2× the recent average (last 6 gaps, ≥2 needed)** → warning
  + `utility.anomaly` event + ⚠ on the invoice line; charges attach to the lease's **next
  generated invoice automatically** (only rooms with an active lease get charged); voiding an
  invoice reverts its charges to pending. CSV import per meter (`YYYY-MM-DD,value[,note]`,
  invalid/out-of-order rows skipped with reasons).
- **M12 data model**: `ServiceCatalog` (fixed_monthly | per_use | metered), `ServiceAssignment`
  (lease-scoped, optional **ParkingSlot** / **WifiAccount** binding, snapshotId link),
  `ServiceUsage` (per-use entries, milli-qty, price snapshot), `ParkingSlot` (unique code,
  monthly fee, free|assigned), `WifiAccount` (unique SSID, free|assigned|suspended).
  `LeaseService` (Phase 5 snapshot) gained `activeFrom`/`activeThrough` **billing-window**
  columns.
- **Engine**: fixed_monthly services now bill by **window overlap** `[max(start, periodStart),
  min(activeThrough, periodEnd))` prorated on the rent denominator — **mid-month suspend →
  prorated stop (§M12 acceptance)**; full-window behaviour is bit-identical to Phase 6 (stub
  WiFi 823 asserted). Pending utility charges + per-use usages ride `generateInvoices` as
  one-time lines (`utility` / `one_time` kinds → 4200 / 4300+4100 credits via the existing
  issue posting) and are marked billed inside the creation transaction.
- **M12 rules (§M12)**: fixed services auto-bill monthly via the rent engine; per-use entries
  create one-time lines; **parking assigns a slot uniquely** (`SLOT_TAKEN`), WiFi activates on
  assign and **suspends on assignment suspend**, both release on assignment end; lease end ends
  all assignments (releases slot/WiFi, closes windows). `metered` services bill through M11
  meters.
- **API**: GET/POST `/api/meters`, GET `/api/meters/[id]` (readings + charges), POST
  `…/readings` (manual or estimate), POST `…/readings/import` (CSV), GET/POST `/api/tariffs`
  (org-wide tariff creation needs a GLOBAL grant), GET/POST `/api/services` (catalog creation =
  GLOBAL M12:update), GET/POST `/api/services/assignments`, POST `…/[id]/suspend`, GET/POST
  `/api/services/usages`. Reads use `hasModuleAccess` + data-level property scoping
  (`rbac/propscope.ts`: GLOBAL → all, PROPERTY → assigned, **OWN → owned buildings'
  properties** — owners now see their buildings' meters).
- **UI**: `/utilities` (pending-charges/anomaly/tariff stat cards, meter table with latest
  reading + consumption, record-reading & CSV-import dialogs, tariff list) + `/utilities/[id]`
  (**pure-SVG consumption history chart**, red = spike, amber = estimated, per-meter charges).
  `/services` (assignments with binding + suspend/record-use row actions, catalog, per-use
  entries, parking slots, WiFi accounts). Nav live.
- **Seed**: 2 tariffs, 4 meters (A1-01/A1-02 elec+water), 3 catalog services (WIFI/PARK/
  LAUNDRY), 2 parking slots, 2 WiFi accounts (idempotent).

**Tests** — 33 new (191 total, 19 files): machines (milli math, tier pricing incl. bracket
coverage error, estimate avg-3, spike detection, tariff pick), engine windows (full/prorated-
stop/mid-start/closed/thirty_day + Phase-6 back-compat), utilities service (baseline → charge →
estimate → spike → CSV → invoice folding → void reverts → property tariff precedence, vacant
room warning, own fixture lease so suite order can't break it), services service (WiFi+parking
assignment → invoice lines, slot/WiFi uniqueness, per-use one-time line, mid-month suspend
window, lease-end releases, catalog validation). Fixed a date-rot bug in the Phase-8 dunning
test (hardcoded 2026-09-02 → UTC-relative "today − 13 days").

**Live smoke** (§M11+§M12 acceptance, dev server): 2 members created via API + KYC + verified +
leases on A2-01/A2-03 (200.00/mo) activated → staff created meters on both rooms → readings for
**3 rooms** (ELEC-A1-01 240.5 kWh → 8418; ELEC-A2-01 105 kWh → 3675; ELEC-A2-03 30 kWh → 1050)
+ CSV import + estimate + a deliberate **900 kWh spike → 31500 ⚠ anomaly charge + event** →
`invoice-generation` issued **6 invoices**: utility lines present on all three leases' invoices,
Parking (P-A01) on LSE-0001 prorated **12/31 stub + 9/30 Sep (mid-month suspend, §M12)**, WiFi
on the new lease (581 stub + 1500 Sep), Laundry 2.5 kg one-time 500; all charges/usages flipped
**billed** with invoice linkage; ledger 161885 = 161885 (rent 4000: 94194 · service 4100: 6465
· **utility 4200: 60726**); RBDC: staff meter-create/reading/usage 201, staff tariff & catalog
403, duplicate slot 422 SLOT_TAKEN; owner sees Building-A meters only. DB reset to pristine.

**Ops notes**: appending SQL to an already-applied migration does nothing on `migrate deploy`
(the migration is recorded applied) — new SQL needs a new migration folder; keep applied
migration files byte-stable (§3). `next dev` caches the Prisma client at boot — restart after
schema migrations (recurred from Phase 9).

## Phase 9 — Deposits (M10) — 2026-09-02

**Shipped**
- **Data model**: `Deposit` (1:1 with lease via `leaseId @unique`; requiredMinor snapshot;
  status machine `pending → billed → held → settled`, forward-only; invoiceId @unique back-link) and
  `DepositTransaction` (type `deduction | refund`, amountMinor, reason, **evidenceDocId**,
  note, method, ledgerTxId). Deposit movements are append-only: DB triggers reject UPDATE and DELETE
  on `DepositTransaction` — corrections are compensating movements, mirroring the ledger (§9.3 spirit).
- **Billing integration**: deposit installments are **billed through invoices** (§M10) —
  `ensureDepositForLease` (fires automatically in `activateLease` when `depositTotalMinor > 0`,
  idempotent per lease) creates a `deposit`-kind invoice flagged `isDeposit: true` with one item per
  installment (`installmentSplit`: floor + last absorbs remainder → Σ = total exactly) and dueDate =
  lease.startDate so FIFO payment allocation collects deposits first. Deposit invoices are excluded
  from the billing-period chain (`isDeposit: false` filters) and use a 2000-01-01 period sentinel.
- **Ledger**: deposits sit in **2100 Deposit Liability** (account added to chart; new
  `CREDIT_ACCOUNT_BY_KIND` map replaces REVENUE_BY_KIND, `deposit → 2100`). Issue posts **DR 1300 /
  CR 2100**; payment flows through normal M09 (confirm auto-refreshes deposit status inside the
  payment transaction); deduction posts **DR 2100 / CR 4900** (damage/cleaning/other) or **CR 1300**
  (unpaid_rent — settles the receivable, no double income); refund posts **DR 2100 / CR 1100 or 1200
  (by method)**. Status flips to `held` only when fully collected, `settled` when held = 0.
- **Settlement** (§M10 move-out): gated on lease `notice | completed | terminated` (checked in
  service, not just UI). `deductDeposit` **requires an evidence document** (M17 registry lookup —
  API rejects unknown ids), a ≥3-char note, amount ≤ held (else `EXCEEDS_HELD`), reason ∈
  damage|cleaning|unpaid_rent|other. `refundDeposit` (Accountant+ GLOBAL, mirroring the M09 refund
  approval) returns the remainder — amount null ⇒ full remainder ⇒ deposit settles. Settled is
  terminal (`ALREADY_SETTLED`). **Move-out hard gate**: `endLease` refuses to complete/terminate a
  lease whose member has open dues (§15 v1.1 OPEN_DUES — settle or write off first, M20).
- **API**: GET `/api/deposits` (list + computed held/deducted/refunded per row; any-scope read with
  data-level filtering), GET `/api/deposits/[id]` (scoped detail), POST `…/deduct` (M10:update +
  property-scope recheck — staff-level), POST `…/refund` (**GLOBAL** M10:update = Accountant+).
- **UI**: `/deposits` — stat cards (held liability / awaiting collection / ready to settle), status
  filter, per-row ledger math, permission-aware Deduct/Refund dialogs (deduct: amount, reason,
  evidence registry id, note; refund: amount-or-empty, method, note). Nav live.
- **Visibility** (`deposits/visibility.ts`): GLOBAL → all; PROPERTY → assigned properties; OWN →
  deposits on their building's properties ∪ own member deposits.
- **Seed**: no deposit backfill — deposits appear when a lease with deposit terms is **activated**
  (LSE-0001 500.00/2, LSE-0002 500.00/1 both ready to demo this).

**Tests** — 14 new (158 total, 15 files): machines (forward-only transitions, installment split
[33,33,34]/[2,2,2,4], credit-account map, settlement eligibility) + service golden flow: bill 2
installments → collect both (billed→held) → LEASE_ACTIVE/EVIDENCE_REQUIRED/EXCEEDS_HELD/INVALID_REASON
guards → OPEN_DUES blocks move-out → pay rent, end lease → deduct 100.00 with evidence (DR 2100/CR
4900) → refund remainder (DR 2100/CR 1200) → **2100 nets 0**, integrity balanced, settled terminal,
movements append-only (UPDATE/DELETE rejected), M10 audit = billed/deducted/refunded. Suite is
order-independent: tolerates running before/after the billing/payments suites on the shared copy
(payments+allocations+invoices are append-only, never deleted across suites).

**Live smoke** (dev server, §M10 acceptance): KYC-verify Sophea → activate LSE-0002 → activation note
"deposit billed via invoice BLR-2026-0001" → record+confirm 500.00 cash → deposit **held** → notice →
complete (OPEN_DUES gate clear) → deduct 100.00 damage with inspection evidence → 200 {remaining
400.00, held} → refund remainder → **settled, 0** → post-settle deduct 422 ALREADY_SETTLED; staff
deduct/refund 403, owner refund 403; ledger: 2100 DR 50000 = CR 50000 (nets **0**), integrity
150000 = 150000, audit + events (`deposit.billed/settlement_due/deducted/refunded`) all present.

**Ops note**: the dev server caches the Prisma client at boot — after a schema migration, restart
`next dev` or new models read as `undefined` (`prisma.deposit.findMany` → TypeError).

## Phase 8 — Payments (M09) — 2026-09-02

**Shipped**
- **Data model**: `Payment` (code `PMT-2026-0001` global-yearly; method cash|bank_transfer|qr|card|cheque;
  machine `pending → confirmed → refunded | failed`; `remainingMinor` = unallocated member credit;
  `gatewayRef` + `idempotencyKey` **unique** for webhook dedupe §9.6) and `PaymentAllocation`
  (payment→invoice, immutable after creation, `@@unique([paymentId, invoiceId])`). Rows append-only:
  DB triggers block DELETE on payments and any UPDATE/DELETE on allocations (status transitions on
  payments remain legitimate updates).
- **Service** (`src/lib/payments/`): `createPayment` (validates member/method/amount; explicit
  allocations validated against open invoices + dues, or **oldest-first auto-allocation** by
  dueDate→periodStart; propertyId derived from first allocation or member home; idempotent on
  idempotencyKey), `confirmPayment` (idempotent — replays return `ignored` with zero side effects;
  allocates receipt number `RCP-{year}`, applies allocations to invoices via the shared recompute
  (amountPaidMinor + machine-checked `partial_paid`/`paid`), posts **DR 1100 Cash / 1200 Bank (by
  method) / CR 1300 Receivable**, files the receipt PDF), `failPayment`, `refundPayment` (Accountant+
  only — returns **unallocated member credit**, DR 1300 / CR cash-bank, §15 v1.1 scope decision),
  `handlePaymentWebhook` (idempotencyKey → gatewayRef → paymentId resolution; system actor with
  FK-safe null audit attribution).
- **API**: POST/GET `/api/payments` (create scoped: GLOBAL anywhere, PROPERTY assigned members,
  OWN = self only — members can pay from the portal), GET `/api/payments/[id]`, POST `…/confirm` and
  `…/fail` (M09:update, PROPERTY-scope checked against the payment), `…/refund` (**GLOBAL M09:update**
  = Accountant+), GET `…/receipt` (PDF, M09:read scoped), POST `/api/webhooks/payments`
  (`x-webhook-secret` header vs `PAYMENT_WEBHOOK_SECRET` env; duplicates → 200 `{ignored:true}`).
- **UI**: `/payments` (stat cards: collected / pending / member credit; filters; record-payment dialog;
  per-row confirm/fail/refund/receipt actions with permission-aware visibility), `/payments/[id]`
  (allocations §9.5 table, totals ladder, timeline, actions). Nav live. Member dues badge now reflects
  payments (recompute).
- **DOC_ENTITIES += PAYMENT** (docTypeId `receipt`); receipts auto-file v1 at confirmation.

### Phase 8 acceptance (evidence)
- **Tests**: +22 (machines & settlement-account mapping 3; allocation math 7: FIFO spill, due caps,
  remainder credit, zero-handling, explicit-allocation validation; DB flow 12: 50% → partial_paid with
  receipt numbering PMT/RCP sequences, full → paid, double-confirm no-op, webhook confirm + duplicate
  ignored (no double posting), failed-webhook path + terminality, overpayment credit → Accountant
  refund with DR 1300/CR 1100, refund terminality + NOTHING_TO_REFUND, amount/member/method
  validation, allocation-over-due rejection, idempotencyKey dedupe, append-only triggers, machine gate
  on fail). **144/144 total across 13 files.**
- **Live smoke** (HTTP): staff records 50% cash → `PMT-2026-0001` → confirm → `RCP-2026-0001`,
  invoice `partial_paid` (due 72.66) → rest → `paid`; receipt PDF `%PDF` 4.7 KB; QR payment with
  gatewayRef → webhook confirm (secret) → September `paid`, **duplicate webhook ignored** (same
  receipt, no posting), wrong secret → 401; PM-confirmed bank overpayment → member credit 50.00 →
  staff refund 403 → Accountant refund 200 (ledger DR 1300/CR 1200); member (OWN) pays self, 403 for
  another member, refund 403; owner sees own-building payments, owner2 sees 0; final trial balance
  **ΣDR = ΣCR = 92066** with AR netting 0 (everything collected or credited); pending payment
  correctly absent from the books; audit rows attributed per actor incl. `payment-gateway`.
- **Invoice machine untouched** (per §15 v1.1): paid stays terminal; allocated-amount refunds deferred.

### Fixed during this phase
- **Webhook audit attribution**: the gateway pseudo-actor (`webhook`) violates the audit FK — audit
  rows for system actors now carry `actorId: null` + name (`auditActorId` override on ActorCtx; note
  `??` treats explicit null as absent — the classic foot-gun, caught by tests).
- **Vitest file parallelism**: the two DB-backed suites shared one SQLite copy and raced —
  `fileParallelism: false` in vitest config; ledger assertions in the payments suite are deltas
  scoped to its own refTypes (the ledger is append-only even for tests, by design).

### Global gates (§11) — Phase 8
lint ✅ · typecheck ✅ · tests ✅ 144/144 (22 payments) · seed ✅ (`db:reset` pristine: 0 payments/
invoices/ledger rows) · audit-on-mutation ✅ (record/confirm/fail/refund all logged, gateway
attributed) · ledger ✅ balanced through every payment flow · RBDC negatives ✅ live · no `any` ·
webhook idempotency ✅ (unique keys + replay-ignore).
