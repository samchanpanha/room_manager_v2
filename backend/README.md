# RentManager Backend (Spring Boot · Spring Modulith · SaaS)

The split-out backend for RentManager. A **modular monolith**: one deployable
Spring Boot app where each RentManager module (M01…M33) is an isolated Spring
Modulith module that can later be extracted into its own service without a
domain rewrite.

- **Framework:** Spring Boot 3.3, Java 21
- **Modularity:** Spring Modulith (boundaries verified in CI)
- **Persistence:** Spring Data JPA / Hibernate on **the existing PostgreSQL
  schema owned by Prisma** (JPA never mutates it; Flyway adds only tenant/index
  columns)
- **Tenancy (SaaS):** shared DB, row-level `tenant_id` discriminator
- **Auth:** wire-compatible with the Next app — same `rm_session` cookie, same
  `sha256(token)` session lookup, same `scrypt:salt:hash` passwords — so existing
  users and sessions keep working during the migration

See the migration plan in [`../docs/backend-split-plan.md`](../docs/backend-split-plan.md)
and the JPA column mapping in [`../docs/backend-jpa-mapping.md`](../docs/backend-jpa-mapping.md).

## Module layout

```
com.rentmanager
├── platform        # shared: security (session auth + RBDC), tenancy, error, config
├── kernel          # shared: Party, Settings, NumberSequence, AuditLog, DomainEvent, Tenant, Cuid
├── iam             # M01/M27: users, roles, permissions, sessions, auth
│                   #   (+ PortalUserApi: provision portal logins for other modules)
├── members         # M02: tenant/resident lifecycle
│                   #   (+ MemberAccessApi: eligibility + lifecycle status for leasing)
├── properties      # M04: Property → Building → Floor → Room → Bed (+ room status machine)
│                   #   (+ BuildingOwnershipApi, RoomAccessApi, PropertyAccessApi for owners/leasing/billing)
├── owners          # M03: landlords, payout methods, optional OWNER portal login
├── leasing         # M05: member leases, state machine, occupancy rules, activation/ending effects
│                   #   + M06 monthly generation job (InvoiceGenerationService drives
│                   #    billing.BillingQueryApi.generateForLease per active lease)
│                   #   (open-dues gate calls billing.BillingQueryApi; bills deposits
│                   #    via leasing::spi DepositBillingPort, LeasingQueryApi published)
├── billing         # M06 rent engine + M07 invoices + M09 payments: pure engine
│                   #   (billing.engine: proration + composition + late-fee/dunning),
│                   #   invoices/items/credit notes, payments/allocations, and the
│                   #   daily late-fee/dunning job (RentEngineService)
│                   #   (+ BillingQueryApi for leasing/finance;
│                   #    billing::spi LedgerPostingPort → M08, DepositAdvancePort → finance,
│                   #    UtilityBillingPort → M11)
├── finance         # M10 deposits (installment billing, hold/settle lifecycle,
│                   #   deduction/refund) + M08 double-entry ledger sub-module
│                   #   (finance.ledger: chart of accounts, postings, journal,
│                   #   trial balance, member statement). Implements leasing/billing
│                   #   SPIs incl. LedgerPostingPort (dependency inversion)
├── utilities       # M11: meters, readings (manual/estimate/CSV), tariffs (tiers),
│                   #   consumption charge engine. Implements billing::spi
│                   #   UtilityBillingPort so generation folds pending charges into
│                   #   the next invoice as `utility` lines (dependency inversion)
└── services        # M12: add-on catalog, lease assignments, parking/WiFi,
                    #   per-use entries. fixed_monthly → LeaseService snapshot
                    #   (rent engine prorates); implements billing::spi
                    #   ServiceUsageBillingPort (per-use one-time lines) and
                    #   leasing::spi ServiceReleasePort (release on lease end)
```

Cross-module calls go through APIs published in a module's **base package**
(e.g. `iam.PortalUserApi`, `properties.BuildingOwnershipApi`); a module's
`domain`/`service`/`web` sub-packages stay internal. `ModularityTests` fails the
build if a boundary is crossed.

Each business module exposes a **service** (its public API) + **web** controller
and keeps its **domain** entities package-private-ish. Cross-module calls go
through the published service or application events.

## Implemented in Phase 1 (vertical slice)

| Endpoint | Mirrors Next route |
|---|---|
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts` |
| `POST /api/auth/login/verify` | `src/app/api/auth/login/verify/route.ts` |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts` |
| `GET  /api/account` | `src/app/api/account/route.ts` |
| `GET/POST /api/members`, `GET /api/members/{id}` | `src/app/api/members/*` |
| `GET/POST /api/owners`, `GET /api/owners/{id}` | `src/app/api/owners/route.ts` |
| `GET/POST /api/leases`, `GET /api/leases/{id}` | `src/app/api/leases/*` |
| `POST /api/leases/{id}/{activate,notice,complete,terminate}` | `src/app/api/leases/[id]/*` |
| `GET/POST /api/invoices`, `GET /api/invoices/{id}` | `src/app/api/invoices/*` |
| `POST /api/invoices/{id}/{issue,void}`, `POST /api/invoices/{id}/credit-notes` | `src/app/api/invoices/[id]/*` |
| `GET/POST /api/payments`, `GET /api/payments/{id}` | `src/app/api/payments/*` |
| `POST /api/payments/{id}/{confirm,fail,refund}` | `src/app/api/payments/[id]/*` |
| `GET /api/deposits`, `GET /api/deposits/{id}` | `src/app/api/deposits/*` |
| `POST /api/deposits/{id}/{deduct,refund}` | `src/app/api/deposits/[id]/*` |
| `GET /api/ledger/{accounts,journal,trial-balance}` | `src/app/api/ledger/*` |
| `GET /api/members/{id}/statement` | `src/app/api/members/[id]/statement/route.ts` |
| `POST /api/jobs/invoice-generation` | `src/app/api/jobs/invoice-generation/route.ts` |
| `POST /api/jobs/billing-daily` | `src/app/api/jobs/billing-daily/route.ts` |
| `GET/POST /api/properties`, `GET /api/properties/{id}` | `src/app/api/properties/route.ts` |
| `GET /api/buildings`, `/api/floors`, `/api/rooms` | `src/app/api/{buildings,floors,rooms}/*` |
| `POST /api/rooms/{id}/status` | `src/app/api/rooms/[id]/status/route.ts` |
| `GET /api/health` | `src/app/api/health/route.ts` |

## Run locally

> This cloud sandbox has **no JDK and blocks Maven Central**, so the build can't
> run here. On a normal dev box:

```bash
# Prereqs: JDK 21 + a PostgreSQL that the Next app also uses.
export DATABASE_URL='jdbc:postgresql://localhost:5432/rentmanager'
export DB_USER=rentmanager DB_PASSWORD=rentmanager
export SETTINGS_ENC_KEY='dev-settings-enc-key-change-me-32b-min'

./mvnw spring-boot:run            # http://localhost:8080  (Swagger: /swagger-ui.html)
./mvnw test                       # unit tests + Spring Modulith boundary verification
./mvnw -DskipTests package        # target/rentmanager-backend-0.1.0.jar
```

## Wire it to the frontend

In the repo root, point Next.js at this backend and it will proxy migrated
`/api/*` prefixes here (see `next.config.ts` and `src/lib/backend/`):

```bash
export BACKEND_ORIGIN=http://localhost:8080
npm run dev
```

Un-migrated API prefixes continue to be served by the Next handlers, so modules
flip over one at a time (strangler-fig).
