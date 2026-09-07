# RentManager — Frontend/Backend Split & Spring Boot SaaS Backend

**Status:** Planning + Phase 1 scaffold delivered
**Owner:** Platform
**Branch:** `arena/01a07c15-room-manager-v2`
**Last updated:** 2026-09-07

---

## 0. TL;DR

Today RentManager is a **Next.js 15 monolith**: React UI + 178 Next.js route
handlers + a rich TypeScript service layer + Prisma/PostgreSQL (86 models). The
UI is tightly coupled to the backend because **47 admin pages call Prisma
directly** as React Server Components.

We are splitting this into:

- **Frontend** — the existing Next.js app, kept as-is for UI, but re-pointed so
  every data read/write goes through an HTTP API (no direct DB access).
- **Backend** — a new **Spring Boot 3 modular monolith** (Spring Modulith),
  designed as a **SaaS** (multi-tenant, shared DB with `tenant_id`), organized so
  each RentManager module (M01…M33) is an isolated Spring Modulith module that can
  later be extracted into its own service with no rewrite.

The split is executed **incrementally with the strangler-fig pattern**: the new
backend runs alongside the current app, we migrate one module vertical at a time,
and Next.js proxies un-migrated paths to the old handlers until they're ported.

> **Decisions locked with product (2026-09-07):**
> 1. Architecture: **Spring Modulith** modular monolith.
> 2. Tenancy: **Shared DB, row-level `tenant_id`** discriminator.
> 3. First scope: **Vertical slice** — scaffold everything, fully implement
>    M01 (Auth/RBAC), M02 (Members), M04 (Properties/Rooms), and wire the FE.
> 4. Database: **Reuse the existing Prisma-owned PostgreSQL schema**; JPA binds
>    to the same tables; Flyway only adds new/tenant columns.

---

## 1. Current-state assessment (what we're porting)

| Area | Today | Notes for the port |
|---|---|---|
| UI | Next.js 15 App Router, RSC + client comps, Tailwind, TanStack Query available | Keep. Stop touching Prisma from RSC. |
| API | 178 `route.ts` handlers under `src/app/api` | Become the contract the Spring controllers must honor. |
| Service layer | `src/lib/**` — billing engine, ledger, deposits, state machines, RBAC, PDF, sessions/TOTP/OTP | Logic to re-implement in Java services. |
| Data | Prisma, PostgreSQL, 86 models, cuid PKs, `"PascalCase"` table & camelCase column names (no `@@map`) | JPA entities must use `@Table(name="User")`, `@Column(name="passwordHash")` etc. |
| Auth | DB session rows, `rm_session` httpOnly cookie, token = `sha256(random)`, password = `scrypt:salt:hash` | Backend must be **wire-compatible** so existing sessions/users keep working. |
| RBAC (RBDC) | `permission = module × action × scope`; `can(user, action, module, resource?)`; effective perms = union of roles; scopes GLOBAL/PROPERTY/OWN | Re-implement as a Spring Security authorization layer + method guard. |
| Money | integer minor units, ledger-backed, idempotent, no deletes of posted rows | Preserve exactly (use `long`/`BigInteger` minor units, never floats). |
| Cross-cutting | `audit_logs` (hash-chained), `domain_events`, `settings`, `number_sequences` | Kernel module. |

### Auth compatibility contract (must match byte-for-byte)
- Session cookie name: `rm_session`, `httpOnly`, `SameSite=Lax`, `Secure` in prod.
- Session lookup: `Session.tokenHash = SHA-256(hex(cookieToken))`, not revoked, not expired, `user.status = 'active'`.
- Password verify: split stored on `:` → `["scrypt", saltHex, hashHex]`; `scrypt(password, saltHex, keyLen=64)`; constant-time compare. (Java: `Security` provider or a small scrypt impl — see backend `PasswordHasher`.)
- TOTP-enabled users: password step returns `{ totpRequired, challenge }` (5-min signed challenge), no session yet.
- Admin/Super Admin with `totpEnabled = false` ⇒ `totpEnrollmentRequired = true` ⇒ every module except M27 refused.

---

## 2. Target architecture

```
┌────────────────────────────┐        ┌───────────────────────────────────────┐
│  Next.js frontend (UI)     │        │  Spring Boot backend (SaaS, Modulith)  │
│  - App Router pages         │  HTTP  │  ┌─────────────────────────────────┐   │
│  - TanStack Query + client  │ ─────▶ │  │ platform: security, tenancy,    │   │
│  - typed API client         │  JSON  │  │ error handling, OpenAPI         │   │
│  - /api/* → proxy or BFF    │        │  ├─────────────────────────────────┤   │
└────────────────────────────┘        │  │ kernel (M00): party, settings,  │   │
                                       │  │ audit, number seq, events,tenant│   │
        same PostgreSQL                │  ├──────────┬──────────┬───────────┤   │
        (Prisma-owned schema) ◀────────┤  │ iam(M01) │members M02│ props M04 │   │
                                       │  │  …future: M03,M05,M06,M07,…M33   │   │
                                       │  └──────────┴──────────┴───────────┘   │
                                       └───────────────────────────────────────┘
```

- **Modular monolith** = one deployable, many enforced module boundaries.
  `spring-modulith-core` verifies modules only talk through published APIs;
  a `ModularityTests` test fails the build if a boundary is violated.
- **Each module owns**: its JPA entities (package-private), a public `*Api`
  service interface, DTOs, a REST controller, and its slice of Flyway migrations.
- **Inter-module** calls go through the published interface or via
  `ApplicationEventPublisher` (mirrors today's `domain_events`), so extracting a
  module to its own service later means swapping an in-process event for a
  message broker — no domain rewrite.

### SaaS multi-tenancy (shared DB, `tenant_id`)
- Every tenant-scoped table gets a `tenant_id` column (Flyway migration adds it,
  backfilled to a default tenant so the current single-tenant data keeps working).
- `TenantContext` (a `ThreadLocal` / request-scoped holder) is populated by a
  `TenantFilter` from the authenticated session (later: subdomain / header / JWT
  claim).
- A **Hibernate filter** (`@FilterDef`/`@Filter`) is enabled per request so every
  query is automatically constrained to the current tenant — defense in depth on
  top of explicit `where` clauses.
- Property-scope (existing PROPERTY/OWN RBDC scoping) is layered **inside** a
  tenant, unchanged.

---

## 3. Module map (Spring Modulith modules ↔ RentManager modules)

| Spring module pkg | RM modules | Phase |
|---|---|---|
| `platform` (not a business module) | security, tenancy, error, openapi | 1 |
| `kernel` | M00 party, settings, audit, number seq, events | 1 |
| `iam` | **M01** users/roles/permissions/sessions/auth, M27 security bits | **1 (impl)** |
| `members` | **M02** | **1 (impl)** |
| `properties` | **M04** properties/buildings/floors/rooms/beds | **1 (impl)** |
| `owners` | **M03** (M24 statements later) | **2 (impl)** |
| `leasing` | **M05 leases** (M06 rent engine, M32 short stays later) | **2 (impl)** |
| `billing` | **M07 invoices, M09 payments** (M13 QR pay later) | **3 (impl)** |
| `finance` | **M10 deposits + M08 double-entry ledger** (M20 expenses/P&L later) | **3 (impl)** |
| `utilities` | M11 utilities/meters, M12 services | 4 |
| `operations` | M16 room moves, M18 inspections, M19 maintenance, M22 complaints | 4 |
| `inventory` | M14 POS, M15 stock, M29 purchase orders | 5 |
| `workforce` | M23 attendance | 5 |
| `documents` | M17 documents/storage | 5 |
| `portal` | M25 tenant portal, M21 telegram, M33 alerts | 6 |
| `reporting` | M26 reports | 6 |

---

## 4. Delivery phases & task breakdown

### Phase 0 — Foundations (this PR)
- [x] Assess repo, lock architecture decisions.
- [x] Author this plan.
- [x] Scaffold `backend/` Spring Boot 3 + Spring Modulith Maven project.
- [x] Platform: config, tenancy context+filter, security chain, session auth
      filter (cookie/scrypt compatible), RBDC authorization service, global error
      handler, OpenAPI.
- [x] Kernel entities bound to existing tables (Party, Setting, NumberSequence,
      AuditLog, DomainEvent) + Tenant.
- [x] Flyway baseline (`V1` = adopt existing schema as-is) + `V2` add `tenant_id`.
- [x] Frontend: BFF/proxy so `/api/**` can target either backend; typed client.

### Phase 1 — Vertical slice (this PR: code authored; build runs locally)
- [x] **IAM (M01)**: JPA for User/Role/Permission/RolePermission/UserRole/
      UserPropertyAssignment/Session; `AuthService` (login, TOTP challenge,
      logout, current-user); `PermissionResolver` (effective-perm union) +
      `can()`; REST: `POST /api/auth/login`, `/api/auth/login/verify`,
      `/api/auth/logout`, `GET /api/account`, users & roles CRUD.
- [x] **Members (M02)**: JPA MemberProfile/EmergencyContact; `MemberService`
      (onboard, list w/ scope, get, status transitions); REST mirroring
      `/api/members*`.
- [x] **Properties (M04)**: JPA Property/Building/Floor/Room/Bed; `PropertyService`;
      REST mirroring `/api/properties`, `/api/buildings`, `/api/floors`,
      `/api/rooms*`.
- [x] Wire a real page to the backend via the proxy: the **Properties list page**
      (`src/app/(admin)/properties/page.tsx`) now sources data from the backend
      when `BACKEND_ORIGIN` is set (occupancy + building counts computed in
      `PropertyService`), with the legacy Prisma path kept as an automatic
      fallback so the app is unchanged until the backend is wired.
- [x] Backend web-layer tests (MockMvc): health public, protected endpoints
      return Next-compatible `UNAUTHENTICATED`, bad-credentials `BAD_CREDENTIALS`,
      validation `VALIDATION_ERROR`.
- [ ] Wire the Members page + owners page the same way (config prefixes ready).
- [ ] Contract tests: replay a saved set of requests against both old handlers
      and new controllers; assert identical status + JSON shape.

### Phase 2 — Owners (M03) — DONE (this PR)
- [x] JPA OwnerProfile/OwnerPayoutMethod; `OwnerService` (onboard: party +
      profile + primary payout + building ownership + optional OWNER portal
      login, atomic); REST mirroring `/api/owners`.
- [x] Cross-module APIs published in module base packages to keep boundaries
      clean: `properties.BuildingOwnershipApi` (assign buildings) and
      `iam.PortalUserApi` (provision portal user + role).
- [x] Flyway `V2` extended to tenant-scope the owner tables.

### Phase 3 — Leases (M05) — DONE (this PR)
- [x] Kernel `NumberingService` (row-locked gapless `LSE-####`, port of
      `src/lib/numbering.ts`).
- [x] Cross-module published APIs to keep boundaries clean:
      `properties.RoomAccessApi` (room facts + status machine + bed checks) and
      `members.MemberAccessApi` (eligibility + lifecycle status).
- [x] JPA Lease/LeaseService; `LeaseMachine`, `Occupancy`, `BillingDates`
      (ports of `machine.ts`/`rules.ts`/`billing.ts`).
- [x] `LeaseAppService`: draft creation (room→reserved), activation (occupancy
      checks + room→occupied + member verified→active + first-invoice date),
      notice, complete/terminate (room→cleaning, member→moved_out).
- [x] REST `/api/leases` (+ activate/notice/complete/terminate); unit tests for
      the machine/occupancy/billing math; Flyway `V2` extended to Lease tables.
- [x] Open-dues clearance gate at complete/terminate — **re-enabled** now that
      the billing module (M07) is ported: `LeaseAppService.end()` calls
      `billing.BillingQueryApi.hasOpenDues(member)` and returns `422 OPEN_DUES`
      when the member carries any outstanding balance.
- [ ] Re-enable the remaining end-of-lease gate once its module lands: completed
      move-out inspection (**M18**). Marked `TODO(M18)` in `LeaseAppService.end()`.

### Phase 4 — Invoices (M07) — DONE (this PR)
- [x] JPA Invoice/InvoiceItem/CreditNote bound to the existing Prisma tables.
- [x] `InvoiceMachine` — port of `src/lib/billing/machines.ts` (statuses,
      transitions, item kinds). Unit-tested in `InvoiceRulesTest`.
- [x] `InvoiceAppService`: manual draft creation (with live-per-period
      uniqueness per `(leaseId, periodStart)`, voided periods re-billable),
      issue (allocate `INV-####` via `NumberingService`, set due date), void
      (reason required, `amountDue→0`), and credit notes (`CN-####`,
      immutable-document semantics: reduce `amountCreditedMinor`, auto-settle to
      `paid` at zero due). `recompute()` keeps subtotal/total/amountDue in sync,
      matching `recomputeAmountsTx`.
- [x] Ledger side-effects (M08) delegated through the
      `billing.spi.LedgerPostingPort` SPI with a `@ConditionalOnMissingBean`
      no-op default. **Live as of Phase 7**: finance's `LedgerPostingAdapter`
      now posts double entries on issue/void/credit. Remaining parity gaps: no
      invoice-PDF filing (M17); no utility/usage re-billing on void (M11/M12).
      Tracked here.
- [x] Payments (M09) not yet ported, so `amountPaidMinor` stays 0 and the
      `partial_paid`/auto-`overdue`/dunning transitions are reachable in the
      machine but not yet driven — they land with the payments + M06 jobs.
- [x] Cross-module published API `billing.BillingQueryApi` (open-dues sum per
      member) consumed by leasing; new `properties.PropertyAccessApi`
      (propertyId validation) consumed by billing.
- [x] REST mirroring `/api/invoices*`: list (`?status`,`?propertyId`), get
      detail, create draft, `POST /{id}/issue`, `POST /{id}/void`,
      `POST /{id}/credit-notes`.
- [x] Flyway `V3` tenant-scopes Invoice/InvoiceItem/CreditNote (+ composite
      `(tenantId,memberProfileId,status)` index for the open-dues gate).
- [x] FE seam wired: `/api/invoices` added to `MIGRATED_PREFIXES`; typed
      `api.invoices` client (list/get/create/issue/void/creditNote).

### Phase 5 — Payments (M09) — DONE (this PR)
- [x] JPA Payment/PaymentAllocation bound to the existing Prisma tables.
- [x] `PaymentMachine` (port of `src/lib/payments/machines.ts`: statuses,
      methods, cash-drawer settlement accounts) and `PaymentAllocator` (pure
      port of `allocation.ts`: oldest-first FIFO + explicit-allocation
      validation). Unit-tested in `PaymentRulesTest`.
- [x] `PaymentAppService`: record (pending; explicit or oldest-first
      allocations; **idempotent on `idempotencyKey`** §9.6), confirm (allocate
      `RCP-YYYY-####` receipt, apply allocations to invoices, flip invoice
      status to `partial_paid`/`paid` via `amountPaidMinor` + `Invoice.recompute()`,
      post to the ledger; **idempotent** — re-confirm is a no-op), fail, and
      refund of the unallocated remainder (Accountant-only, GLOBAL M09:update).
- [x] This closes the loop M07 left open: payments now drive
      `issued→partial_paid→paid`. (`overdue`/dunning still await the M06 job.)
- [x] Ledger side-effects (M08) via the extended `billing.spi.LedgerPostingPort`
      (`onPaymentConfirmed`/`onPaymentRefunded`). **Live as of Phase 7**:
      finance's `LedgerPostingAdapter` posts DR-cash/CR-receivable on confirm
      and the mirror on refund. Remaining parity gap: no receipt-PDF filing
      (M17). (Deposit advance on deposit-invoice payment was closed in Phase 6.)
- [x] `Invoice.recompute()` extracted onto the entity so M07 and M09 share the
      single derived-money rule (subtotal/total/amountDue).
- [x] REST mirroring `/api/payments*`: list (`?status`,`?method`), get detail,
      create, `POST /{id}/{confirm,fail,refund}`. (Gateway webhook intake
      `/api/webhooks/payments` deferred — see below.)
- [x] Flyway `V4` tenant-scopes Payment/PaymentAllocation.
- [x] FE seam wired: `/api/payments` added to `MIGRATED_PREFIXES`; typed
      `api.payments` client (list/get/create/confirm/fail/refund).
- [ ] Deferred: signed gateway webhook (`/api/webhooks/payments`) and QR-pay
      (M13) intake — need the webhook-signature verifier; they reuse
      `PaymentAppService.confirm/fail` once added.
- [ ] Deferred: receipt PDF (M17) — same SPI approach as the invoice PDF.

### Phase 6 — Deposits (M10, new `finance` module) — DONE (this PR)
- [x] JPA Deposit/DepositTransaction bound to the existing Prisma tables.
- [x] `DepositMachine` (port of `src/lib/deposits/machines.ts`: forward-only
      pending→billed→held→settled, installment split with last-absorbs-remainder,
      deduction credit-account routing, move-out settlement window). Unit-tested
      in `DepositRulesTest`.
- [x] `DepositAppService`: bill a deposit as an installment `deposit`-kind
      invoice at lease activation (idempotent per lease), advance status from
      collection/settlement facts, and record deduction (evidence + note
      mandatory) / refund (Accountant-only) movements at move-out.
- [x] **Cross-module cycles broken by dependency inversion** — finance depends
      on `leasing`/`billing`, never the reverse:
  - `leasing.spi.DepositBillingPort` (named interface `leasing::spi`) — leasing
    calls it on activation; finance's `DepositBillingAdapter` implements it.
    **Closes the M05 `TODO(M10)`**: `LeaseAppService.activate()` now bills the
    deposit and notes the invoice code.
  - `billing.spi.DepositAdvancePort` (named interface `billing::spi`) — billing
    calls it when a deposit invoice is paid; finance's `DepositAdvanceAdapter`
    implements it. **Closes the M09 `TODO(M10)`**: `PaymentAppService.confirm()`
    advances the deposit billed→held.
  - Both adapters are `@Primary` so they deterministically replace the no-op
    defaults (`NoopDepositBilling`/`NoopDepositAdvance`) once finance is on the
    classpath.
  - New published `billing.BillingQueryApi.billDepositInvoice/invoiceFacts` and
    `leasing.LeasingQueryApi` (lease deposit terms + settlement-window check)
    give finance read/bill access without reaching into internals.
- [x] Ledger postings (M08) via the extended `LedgerPostingPort`
      (`onDepositBilled`/`onDepositDeducted`/`onDepositRefunded`). **Parity gap
      closed in Phase 7**: the finance `LedgerPostingAdapter` now posts the
      DR-receivable/CR-2100-liability on billing and the liability-release
      entries on deduct/refund.
- [x] REST mirroring `/api/deposits*`: list (`?status`), get detail,
      `POST /{id}/{deduct,refund}`. (No manual create — deposits are billed at
      activation, parity with the Next app.)
- [x] Flyway `V5` tenant-scopes Deposit/DepositTransaction.
- [x] FE seam wired: `/api/deposits` added to `MIGRATED_PREFIXES`; typed
      `api.deposits` client (list/get/deduct/refund).
- [ ] Deferred: the M17 evidence-document existence check on deductions (the
      Next service verifies the doc against the M17 registry; here we require a
      non-blank `evidenceDocId` and will validate it once documents are ported).

### Phase 7 — Ledger (M08, `finance.ledger` sub-module) — DONE (this PR)
- [x] JPA `LedgerAccount` (shared reference data, **not** tenant-scoped),
      `LedgerTransaction` + `LedgerEntry` (tenant-scoped, EAGER entries via
      `@JoinColumn`) bound to the existing Prisma tables.
- [x] `ChartOfAccounts` — port of `src/lib/ledger/accounts.ts`: the 14 system
      accounts (incl. `2300 Tax Payable` so invoice tax has a home),
      `CREDIT_ACCOUNT_BY_KIND`, `settlementAccountCode`, `isDebitNormal`.
- [x] `Postings` — pure, unit-tested builders (`LedgerPostingsTest`):
      `invoiceIssueLines` (DR 1300 / CR revenue-by-kind, largest-remainder
      discount proration, tax → 2300), `lateFeeLines`, `creditNoteLines`
      (pro-rata of the original revenue lines, fallback 4900), `reversalLines`,
      `allocateProportional`, and the `assertBalanced` invariant.
- [x] `LedgerService` — the only writer: append-only `post()` (resolves codes →
      active accounts, else UNBALANCED) and `reverse()` (mirror + `reversalOf`
      back-link, rejects double reversal with `REVERSAL_FAILED`), plus
      `liveTransactions`/`liveRevenueLines` for void & credit-note proration.
- [x] `LedgerQueryService` — chart of accounts, trial balance, journal browser
      (all GLOBAL M08:read), member statement (GLOBAL **or** own party), and the
      integrity probe.
- [x] **Closes the M04/M07/M09/M10 ledger parity gap** — finance's
      `LedgerPostingAdapter` (`@Primary`, implements `billing.spi.LedgerPostingPort`)
      replaces `NoopLedgerPosting`, so every invoice issue/void/credit-note,
      payment confirm/refund, and deposit billed/deducted/refunded now posts
      balanced double entries. `onInvoiceIssued` was enriched with
      discount/tax/line breakdown so revenue splits and prorations match the
      accrual rules. Dependency inversion preserved — billing never imports
      finance.
- [x] REST mirroring the Next routes: `GET /api/ledger/{accounts,journal,
      trial-balance}` and `GET /api/members/{id}/statement` (parity path, same
      guard). No write endpoints — the ledger is append-only and posts through
      the SPI on domain events.
- [x] Flyway `V6` tenant-scopes `LedgerTransaction`/`LedgerEntry` (LedgerAccount
      stays global) and idempotently seeds the 14 system accounts.
- [x] FE seam wired: `/api/ledger` added to `MIGRATED_PREFIXES`; typed
      `api.ledger` (accounts/trialBalance/journal) + `api.members.statement`.

### Phase 8+ — Port remaining modules (one vertical per module, same recipe)
For each module: entities → service (port `src/lib/**` logic) → controller →
Flyway (only if new columns) → contract tests → flip the FE proxy route →
delete the old `route.ts` and the module's `src/lib` server logic.

Exit criteria for the whole migration: no `src/app/api/**/route.ts` remains, no
`@/lib/db` import in `src/app/**`, backend `ModularityTests` + contract tests
green, FE talks only HTTP.

---

## 5. Frontend integration strategy (step by step)

**Principle:** the UI keeps its shapes; we change only the data source. Two layers:

1. **Proxy switch** — `next.config.ts` rewrites `/api/:path*` to the Spring
   backend (`BACKEND_ORIGIN`) for migrated prefixes; un-migrated prefixes keep
   hitting the in-app handlers. This lets us flip modules one at a time and roll
   back instantly by removing a rewrite.
2. **Typed API client** — `src/lib/backend/client.ts`. Server Components and
   client components both call it. Server calls forward the `rm_session` cookie
   so RBAC still works. This replaces `import { prisma } from "@/lib/db"` inside
   pages with `await api.members.list(...)`.

Migration recipe per page:
1. Identify the page's data needs (currently a Prisma query in the RSC).
2. Ensure the backend exposes an equivalent endpoint (contract-tested).
3. Add the rewrite for that prefix → backend.
4. Replace the RSC Prisma call with `await api.<module>.<op>()` (forwarding the
   cookie via `next/headers`).
5. Remove now-dead `route.ts` + `src/lib/<module>` server code.
6. Verify with contract test + manual smoke.

Cookies & CORS: the FE and BE are same-origin from the browser's view (Next
proxies), so the `rm_session` cookie flows without CORS. If deployed on separate
origins, switch the client to send `credentials: 'include'` and enable CORS with
credentials on the backend (already stubbed in `SecurityConfig`).

---

## 6. Data & migration

- **No destructive changes.** Prisma remains the schema owner during migration;
  Flyway migrations are **additive only** (`tenant_id`, indexes). JPA maps
  existing columns exactly (see `docs/backend-jpa-mapping.md`).
- Backfill: `V2__add_tenant.sql` creates a `Tenant` table, a `DEFAULT` tenant,
  adds nullable `tenant_id` to scoped tables, backfills them to `DEFAULT`, then
  sets `NOT NULL`.
- CUID PKs are kept as `String` IDs generated app-side (a small `Cuid` helper)
  so IDs stay compatible with existing rows and the FE.
- Long term, when Prisma is retired, flip ownership to Flyway and drop the Prisma
  migration folder.

---

## 7. Build, run, test (local — this sandbox lacks a JDK + Maven Central egress)

> ⚠️ This cloud sandbox has **no Java toolchain** and **blocks Maven Central**,
> so the Java build cannot run here. Everything below runs on a normal dev box.

```bash
# Prereqs: JDK 21, Docker (for Postgres). Maven wrapper is committed.
cd backend

# 1. Start the same Postgres the Next app uses
docker compose -f ../docker-compose.yml up -d postgres      # or your own PG

# 2. Point the backend at it (defaults match the Next .env)
export DATABASE_URL='jdbc:postgresql://localhost:5432/rentmanager'
export DB_USER=rentmanager DB_PASSWORD=rentmanager
export SETTINGS_ENC_KEY='dev-settings-enc-key-change-me-32b-min'

# 3. Run (Flyway applies additive migrations on boot)
./mvnw spring-boot:run            # serves on :8080

# 4. Tests (unit + Spring Modulith boundary verification)
./mvnw test

# 5. Package
./mvnw -DskipTests package        # target/rentmanager-backend.jar
```

Frontend against the split backend:
```bash
# in repo root
export BACKEND_ORIGIN=http://localhost:8080   # Next proxies migrated /api/* here
npm run dev
```

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Auth wire-incompatibility locks users out | Compatibility contract (§1) + a JUnit test that logs in against a seeded user and validates the cookie/session row. Old handlers stay as fallback during rollout. |
| Behavior drift vs. TS services (billing/ledger) | Contract tests replay identical requests old vs new; port money math with integer minor units and golden-value tests before flipping finance modules. |
| Big-bang temptation | Strangler proxy enforces one-module-at-a-time; each flip is independently revertible. |
| Tenant leakage | Hibernate tenant filter (default-on) + explicit scoping + a negative test that a tenant B token can't read tenant A rows. |
| Sandbox can't build Java | Build/run documented for local/CI; add a GitHub Actions job (`backend-ci.yml`) so CI compiles + tests on every push. |

---

## 9. Definition of done (Phase 1)
- Backend boots against the existing DB; `GET /api/health` green.
- `POST /api/auth/login` issues an `rm_session` cookie identical in shape to
  today; the old Next app accepts that cookie and vice-versa.
- Members and Properties list/detail render in the FE sourced from the backend.
- `ModularityTests` + contract tests pass in CI.
- No page in the migrated slice imports `@/lib/db`.
