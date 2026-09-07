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
| `owners` | M03, M24 statements | 2 |
| `leasing` | M05 leases, M06 rent engine, M32 short stays | 2 |
| `billing` | M07 invoices, M09 payments, M13 QR pay | 3 |
| `finance` | M08 ledger, M10 deposits, M20 expenses/P&L | 3 |
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
- [ ] Wire the three slices in the FE via the proxy; delete direct-Prisma reads
      on those pages (replace RSC Prisma with server-side `fetch` to backend).
- [ ] Contract tests: replay a saved set of requests against both old handlers
      and new controllers; assert identical status + JSON shape.

### Phase 2–6 — Port remaining modules (one vertical per module, same recipe)
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
