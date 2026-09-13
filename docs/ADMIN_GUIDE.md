# RentManager — Administrator Guide

> **Who this is for:** Super Admins, Admins, IT staff, and business owners who
> install, configure, secure, and maintain RentManager.
> **Staff doing daily work** (front desk, cashiers, managers) should start with
> the in-app **Help & Guide** (`/guide`) or
> [`docs/manual/`](./manual/README.md) instead.
>
> 🌐 Also available in **Khmer** ([`ADMIN_GUIDE_KM.md`](./ADMIN_GUIDE_KM.md)) and
> **Chinese** ([`ADMIN_GUIDE_ZH.md`](./ADMIN_GUIDE_ZH.md)).
>
> Companion docs:
> [`DEPLOY_MAC.md`](./DEPLOY_MAC.md) · [`DEPLOY_WINDOWS.md`](./DEPLOY_WINDOWS.md) ·
> [`CHEAT_SHEET.md`](./CHEAT_SHEET.md) (printable: `/guide/cheat-sheet.html` in-app) ·
> [`BACKUP.md`](./BACKUP.md) · [`SECURITY.md`](./SECURITY.md) ·
> [`manual/08-administrator-guide.md`](./manual/08-administrator-guide.md) (RBDC reference) ·
> [`manual/15-deployment-guide.md`](./manual/15-deployment-guide.md) (in-app deploy guide, EN/KM/ZH)

---

## Table of contents

1. [What RentManager is](#1-what-rentmanager-is)
2. [System architecture & services](#2-system-architecture--services)
3. [First login & admin accounts](#3-first-login--admin-accounts)
4. [Roles, permissions & RBDC](#4-roles-permissions--rbdc)
5. [User management SOPs](#5-user-management-sops)
6. [Organisation setup (golden order)](#6-organisation-setup-golden-order)
7. [Settings reference (M28)](#7-settings-reference-m28)
8. [Module-by-module admin operations](#8-module-by-module-admin-operations)
9. [Scheduled jobs (cron)](#9-scheduled-jobs-cron)
10. [Backup & restore](#10-backup--restore)
11. [Security hardening checklist](#11-security-hardening-checklist)
12. [Monitoring & logs](#12-monitoring--logs)
13. [Updating the system](#13-updating-the-system)
14. [Troubleshooting for admins](#14-troubleshooting-for-admins)
15. [Go-live checklist](#15-go-live-checklist)

---

## 1. What RentManager is

RentManager is a **rental & co-living property operations platform**: one system
for rooms, leases, billing, payments, deposits, utilities, maintenance,
expenses, POS/shop, stock, attendance, owner statements, reports, and tenant/
owner portals — with Telegram notifications.

Key design facts an admin must know:

| Fact | Detail |
|---|---|
| Org model | Single organisation, **multi-property** (Property → Building → Floor → Room → Bed). Properties are the scoping unit — there is no separate "branch" entity. |
| Money | Single org currency, stored as **integer minor units** (cents). Set currency once at go-live — changing it later is unsupported. |
| Ledger | Double-entry ledger; money moves only via balanced postings. Corrections use **reversals** (credit note / void / refund) — history is never rewritten. |
| Permissions | **RBDC**: every page *and* every API call is checked server-side by one resolver: `can(user, action, module, resource?)`. The UI hides buttons, but the API is the real gate. |
| Audit | **Every mutation** writes an attributable, hash-chained audit row (actor, time, before/after JSON, IP). The trail can be verified and is **never purged**. |
| Languages | UI switches between **English, Khmer (ខ្មែរ), Chinese (中文)** per browser (🌐 picker) with an org default in Settings → Locale. |
| Source of truth | [`INTENT.md`](../INTENT.md) + code + `prisma/schema.prisma`. The in-app guide documents only what actually exists. |

---

## 2. System architecture & services

### 2.1 Components

```
                    ┌──────────────────────────────┐
                    │  Browser: staff / portal     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
  :3000             │  rentmanager (Next.js 15)    │  ← main app, all UI + APIs
                    │  Prisma → PostgreSQL         │
                    └──────┬───────────────┬───────┘
                           │               │ /api/* (migrated prefixes)
                           ▼               ▼
                    ┌────────────┐  ┌──────────────────────┐
                    │ PostgreSQL │  │ gateway :8080        │  ← Spring Cloud
                    │ :5432      │  │ 8 Spring Boot svcs   │
                    └────────────┘  │ :8081–:8088          │
                           ┌────────┴──────────────────────┤
                           │ Nacos :8848 · Keycloak :7080  │
                           │ Kafka :9092 · Redis :6379    │
                           │ MinIO :9000/:9001 (files)    │
                           │ Grafana :9090 · Kafka UI     │
                           └───────────────────────────────┘
```

### 2.2 Full port map (default `docker-compose.yml`)

| Service | URL | Login (defaults — change in prod!) |
|---|---|---|
| **App (Next.js)** | http://localhost:3000 | demo accounts below (§3) |
| API Gateway | http://localhost:8080 | — |
| Swagger (all APIs) | http://localhost:8080/swagger-ui.html | — |
| Identity :8081 · Property :8082 · Billing :8083 · Ops :8084 · Staff :8085 · Commerce :8086 · Notification :8087 · Report :8088 | `http://localhost:808x/actuator/health` | — |
| Nacos console | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak admin | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO console (files) | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana dashboards | http://localhost:9090 | `admin` / `admin` |
| PostgreSQL | `localhost:5432` | `rentmanager` / `rentmanager` |
| Redis | `localhost:6379` | password `rentmanager-redis-secret` |

> The compose file sets demo/dev secrets via environment with `-default`
> fallbacks. For anything beyond a local demo, override **every** secret —
> see §11.

### 2.3 Where data lives

| Data | Location |
|---|---|
| All business data | PostgreSQL (`rentmanager` DB). Migrations are **additive-only**; snapshots can always be migrated forward. |
| Documents/receipts/PDFs | S3-compatible storage (MinIO in Docker; any S3 when `S3_*` env is set; local disk otherwise). **Back up the bucket separately** in production. |
| DB backups | `/app/backups` in the container → `rentmanager-backups` Docker volume (host path managed by Docker). |
| Sessions | DB-backed, revocable, httpOnly cookies (`SESSION_TTL_DAYS`, default 30). |
| Sealed secrets | Settings → Providers secrets are AES-256-GCM encrypted (`SETTINGS_ENC_KEY`); env vars act as fallback. |

---

## 3. First login & admin accounts

After deployment (see `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`), open
**http://localhost:3000/login**. The database is seeded automatically
(idempotent — safe on every restart).

### 3.1 Seeded accounts (password: `Demo1234!`)

| Email | Role | Use it to learn |
|---|---|---|
| `root@demo.test` | **Super Admin** | Everything incl. deletes, voids, RBDC config |
| `admin@demo.test` | **Admin** | Whole org; no destructive/config actions |
| `pm@demo.test` | **Property Manager** | Assigned to **BLR only** — watch scoping hide other properties |
| `accountant@demo.test` | **Accountant** | Finance modules (rent engine, ledger, payments, statements) |
| `staff@demo.test` | **Staff** | Front-desk operational write |
| `owner@demo.test` | **Owner** | Owns Building A (BLR) — sees only own property/records |
| `owner2@demo.test` | **Owner** | Owns Villa Main (RV) — cross-owner denial demo |
| `member@demo.test` | Member | Tenant portal (`/portal`, OTP login) |

### 3.2 First things to do as Super Admin

1. Sign in as `root@demo.test`.
2. Enroll **2FA** (mandatory for Admin+): Account → Security → set up TOTP
   with an authenticator app. There is also a signed login-challenge flow.
3. Create a **real Super Admin** for yourself (Admin → Users → New user),
   sign in as that user, and **disable or re-password the demo accounts**
   before any production use.
4. Go to **Admin → Settings** and set Org, Locale (currency/timezone/
   language), Billing, and Secrets (§7).
5. Verify **Admin → Audit Log** is recording, and run **Verify audit chain**.

> ⚠️ **Demo data is for training.** For production, deploy fresh, change all
> secrets (§11), and either purge demo rows or seed an empty org — never run
> real money on top of `*@demo.test` data.

---

## 4. Roles, permissions & RBDC

### 4.1 The model (read this once, use it forever)

```
Permission = MODULE × ACTION × SCOPE
```

- **Modules** M01–M33 (Users, Members, Owners, Properties, Leases, Rent
  Engine, Invoices, Ledger, Payments, Deposits, Utilities, Services, QR,
  POS, Stock, Room Moves, Documents, Inspections, Maintenance,
  Expenses/P&L, Telegram, Complaints, Attendance, Owner Statements, Tenant
  Portal, Reports, Security, Settings, Purchase Orders, Short Stays,
  Rent Alerts…).
- **9 actions:** `create · read · update · delete · approve · void · refund · export · config`.
- **3 scopes:**
  - `GLOBAL` — all properties.
  - `PROPERTY` — only properties **assigned** to the user.
  - `OWN` — only the user's own records.
- A user can hold **multiple roles**; effective access = **union**.
- **Menu visibility is derived from permissions** — there is no separate menu
  builder. To show/hide a menu item, change the role's permissions (and the
  module's **feature flag** in Settings → Features). Two modules (M13 QR,
  M17 Documents) intentionally have no top-level menu — they live inside
  invoices/member records.

### 4.2 Default roles & matrix

| Role | Scope | In one line |
|---|---|---|
| **Super Admin** | GLOBAL | Full (`F`) everywhere incl. config/delete/void. **Protected — cannot be deleted.** |
| **Admin** | GLOBAL | Manage (`M` = create/read/update) across modules; no full delete/config |
| **Property Manager** | PROPERTY | Runs assigned properties: rooms, leases, ops, ops-reports |
| **Accountant** | GLOBAL | Money: rent engine, invoices, ledger, payments, deposits, statements, P&L |
| **Staff** | PROPERTY | Operational write (`W`) on assigned properties; blocked from finance mutations |
| **Owner** | OWN | Read-only on **own** buildings, statements, documents |
| **Member** | OWN | Tenant: own records via `/portal` only |

Matrix letters: `F` full · `M` manage (CRU) · `R` read · `W` read +
operational write · `O` own records · `–` none.

| Module | Super | Admin | PM | Acct | Staff | Owner | Member |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| M01 Users/RBDC | F | M | R | R | – | – | – |
| M02 Members | F | M | M | R | W | R | O |
| M03 Owners | F | M | R | R | – | O | – |
| M04 Properties/Rooms | F | M | M | R | R | R* | – |
| M05 Leases | F | M | M | R | R | R | O |
| M06 Rent Engine | F | M | R | M | – | – | – |
| M07 Invoices | F | M | M | M | R | R | O |
| M08 Ledger | F | R | – | M | – | O† | O† |
| M09 Payments | F | M | M | M | W | R | O |
| M10 Deposits | F | M | M | M | R | R | O |
| M11 Utilities | F | M | M | R | W | R | O |
| M12 Services | F | M | M | R | W | – | O |
| M13 QR Payments | F | M | R | M | W | – | O |
| M14 POS | F | M | M | R | W | – | – |
| M15 Stock | F | M | M | R | W | – | – |
| M16 Room Moves | F | M | M | R | W | – | O |
| M17 Documents | F | M | M | R | R | O | O |
| M18 Inspections | F | M | M | – | W | R | O |
| M19 Maintenance | F | M | M | – | W | W | O |
| M20 Expenses/P&L | F | M | R | M | W | R | – |
| M21 Telegram | F | M | – | – | – | O | O |
| M22 Complaints | F | M | M | – | W | R | O |
| M23 Attendance | F | M | M | R | O | – | – |
| M24 Owner Statements | F | M | R | M | – | O | – |
| M25 Tenant Portal | F | M | – | – | – | – | O |
| M26 Reports | F | M | M(ops) | M(fin) | R | R(own) | – |
| M27 Security | F | M(audit) | – | – | – | – | – |
| M28 Settings | F | M | R | R | – | – | – |
| M29 Purchase Orders | F | M | M | R | W | – | – |
| M32 Short Stays | F | M | M | R | W | – | – |
| M33 Rent Alerts | F | M | M | M | R | – | – |

\* Owners read their own buildings (own-scope). † OWN scope on statements/own data only.

### 4.3 Building a custom role (example: Cashier)

1. **Admin → Roles → New role** → name it `Cashier`.
2. Tick the grid: **M09 (Payments)** → operational write at **PROPERTY** scope; leave everything else off.
3. Assign the role to the cashier's user + assign their **property**.
4. Result: they can record payments but **cannot open invoices to edit** —
   the API returns `403`. (This exact case is covered by CI negative tests.)

### 4.4 Reports access

Reports are **M26**. Additionally, **Settings → Reports** controls:
`enabledKeys` (which reports exist), `assignments` (which roles/users see
which), `designs` (columns/branding). Report data is never editable.

### 4.5 Safety rules

- Least privilege by default; effective access is the union of all roles.
- A role **in use cannot be deleted**; Super Admin role is protected.
- Every role/permission change is **audited**; the matrix is snapshot-tested
  in CI so privilege can't be silently widened.

---

## 5. User management SOPs

**Where:** Admin → Users (M01).

### 5.1 Onboard a new employee

1. **Users → New user** → name, **email**, temporary password.
2. Account is created with `mustChangePassword = true` → forced change on first sign-in.
3. Assign **role(s)** (least privilege; §4).
4. Assign **properties** (required for PROPERTY-scoped roles).
5. Tell them the URL + temp password; Admin+ must also enroll **2FA**.

### 5.2 Offboard someone (do all four)

1. **Disable** the user (`status = disabled`) — blocks sign-in immediately.
2. **Revoke sessions** — force sign-out on all devices.
3. **Reset 2FA** if you ever re-enable for handover (so old codes die).
4. Check **Audit Log** filtered by that actor for a final review.

### 5.3 "I forgot my password" / lost phone

- There is **no self-service email reset** in this build — an admin sets a
  temporary password (re-arms must-change).
- Lost authenticator: admin performs **2FA reset** (M27) so the user can re-enroll.

---

## 6. Organisation setup (golden order)

Follow this order for a new property/company — each step unlocks the next:

| # | Step | Where |
|---|---|---|
| 1 | Company/org: legal name, currency, timezone, language | Settings → Org / Locale |
| 2 | Structure: **properties → buildings → floors → rooms → beds** | Properties (M04) |
| 3 | Roles & users; assign roles + properties | Admin → Roles, Users (M01) |
| 4 | Rent engine: plans, late-fee, tax, discounts | Rent Engine (M06), Settings → Billing/Late fee |
| 5 | Accounting opening balances (if migrating in) | Settings → Opening balances (balanced `opening` postings) |
| 6 | Payment methods + provider secrets | Settings → Secrets |
| 7 | Billing/dunning + rent alerts | Settings → Billing, Alerts (M33) |
| 8 | Owners + owner contracts + payout methods | Owners (M03), Owner Contracts, M24 |
| 9 | Notifications: templates + Telegram bot token + linking | Settings → Templates/Telegram, Telegram (M21) |
| 10 | Security: 2FA for Admin+, sessions, rate limits | Account → Security, §11 |
| 11 | Feature flags + report assignments | Settings → Features / Reports |
| 12 | End-to-end test (lease → invoice → payment → receipt) | — |
| 13 | Audit review + backup job scheduled | Admin → Audit, §9–§10 |

Details per area live in `docs/manual/` Parts 3–7.

---

## 7. Settings reference (M28)

**Where:** Admin → Settings. All changes are **audited**; financial settings
apply **forward-only** (posted history is never rewritten).

| Group | Controls | Admin notes |
|---|---|---|
| **Org** | Legal name, address, phone, email, website, tax ID, logo, invoice footer, PDF template (classic/modern) | Branding on every PDF/receipt. Keep legal name & tax ID accurate. |
| **Locale** | Currency, timezone, UI language (en/km/zh) | ⚠️ Set **currency once** at go-live; not changeable after data exists. |
| **Billing** | Invoice prefix, grace days (default **3**), dunning days (**[3,7,14]**) | Drives numbering + when reminders/late fees start. Forward-only. |
| **Late fee** | Mode none/flat/percent, flat amount, monthly % (bp), cap | Off by default. Always set a **cap** — fees never exceed amount due. |
| **Retention** | outbox 90d, events 365d, OTP 7d, session 30d | **Audit trail is never purged.** |
| **Features** | Per-module flags (POS, Stock, Telegram, PO default ON) | Off hides menu + gates access; **data is kept**. |
| **Reports** | enabledKeys, assignments, designs | Who sees which reports; data stays source-backed. |
| **Templates** | Telegram overrides, 5 events, `{placeholders}` | issued / receipt / dunning / reminder / overdue wording. |
| **Printers** | 58/80mm, auto-print, copies, barcode default | POS receipt/label printing. |
| **Telegram** | Bot display name, welcome msg, member self-link | Tenant bot behaviour. |
| **Menu** | Sidebar side (left/right) | Layout preference only — visibility comes from permissions. |
| **Units / Table** | Stock units; default page size (25) | List density + item units. |
| **Alerts (M33)** | ahead days (3), overdue days (1) | Dashboard due-soon/overdue windows. |
| **Secrets** | Payment creds, Telegram token | **AES-256-GCM sealed**, masked reads; env vars = fallback. Never paste secrets in chat. |
| **Opening balances** | Balanced `opening` ledger postings | For migration into RentManager; must balance. |

### Environment variables (server-side)

| Variable | Purpose | Default (dev) |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://rentmanager:rentmanager@localhost:5432/rentmanager` |
| `SESSION_TTL_DAYS` | Session lifetime | `30` |
| `FILE_SIGNING_SECRET` | Signed file URLs | random dev value in `.env` |
| `PAYMENT_WEBHOOK_SECRET` | Gateway webhook HMAC | `dev-webhook-secret-change-me` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `TELEGRAM_BOT_USERNAME` | Telegram bot | `dev-*` placeholders |
| `SETTINGS_ENC_KEY` | Sealed-settings encryption (32-byte) | must set in prod |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage | MinIO in Docker |
| `APP_BASE_URL` | Public base URL (links in PDFs/messages) | `http://localhost:3000` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO console + S3 | `rentmanager` / `rentmanager-s3-secret` |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana | `admin` / `admin` |
| `COOKIE_SECURE` | Secure cookies | `false` locally → **`true`** behind HTTPS |
| `SEED_FULL_DEMO` | Seed full demo dataset | `1` in Docker |

Copy `.env.example` → `.env` for local runs; in Docker the compose file
injects production-style values — override secrets via shell env or a
`docker-compose.override.yml` (never commit real secrets).

---

## 8. Module-by-module admin operations

Daily how-tos are in `manual/03-user-guide.md`; this is the **admin angle**:
what to configure, approve, and watch per module.

### M04 Properties & rooms
- Structure rooms correctly up front (type, floor, rent). Room **status
  machine is enforced** (available → occupied → cleaning → available…);
  staff can't skip states — moves/leases flip statuses automatically.
- Buildings can carry **map coordinates + geofence radius** for kiosk attendance.

### M05 Leases · M16 Room moves
- Lease activation auto-bills the **deposit invoice** (M10).
- **Move-out inspection (M18) is a hard gate** for ending a lease.
- Room move = request → approve → execute: old lease ends, new lease
  starts, deposit follows the member, **one adjustment invoice** nets the
  prorated delta. Never hand-edit two leases to fake a move.

### M06 Rent engine · M07 Invoices
- Monthly `invoice-generation` job (per billing day) + daily `billing-daily`
  catch-up. Mid-month suspends **prorate**; fixed services ride the engine.
- Invoice numbers come from `number_sequences` + Settings prefix — gaps are
  normal (idempotent retries), duplicates are impossible.

### M08 Ledger
- Accountants own this. Every money event posts balanced entries; voids and
  refunds post **reversals**, never edits. P&L and reports read the ledger,
  so "register ↔ ledger" must reconcile exactly — if a report disagrees,
  investigate the postings, not the report.

### M09 Payments · M13 QR
- Methods: cash / bank transfer / QR / card / cheque. Machine:
  `pending → confirmed → refunded | failed`.
- **Allocations are oldest-first** (due date, then period) and immutable;
  overpayments become **member credit** (refundable by Accountant with a
  ledger-reversed payout).
- Webhooks are **signed + idempotent** — duplicate gateway notifications are
  ignored, never double-posted. Receipts (`RCP-…`) auto-file as PDFs.
- Public `/pay` page: exact-due-only, rate-limited, no login.

### M10 Deposits
- Billed at lease activation; deductions are proposed from move-out
  inspection findings and **approved in M10**; payouts reverse through the ledger.

### M11 Utilities · M12 Services
- Meters per room (electric/water/gas), milli-unit precision; estimated =
  avg of last 3; CSV import supported. Tiered tariffs; charges attach to the
  **next cycle automatically**; >2×-average spikes flag as anomalies.
- Services: fixed-monthly (prorate on suspend) vs per-use (one-time lines).
  Parking slots are unique; WiFi accounts follow the lease.

### M14 POS · M15 Stock · M29 Purchase orders
- POS sessions: opening float → expected = float + Σ cash → counted
  variance on close. **Charge-to-room** issues a one-time invoice + AR posting.
- Stock movements are **append-only** (purchase/sale/consumption/
  maintenance_use/adjustment/transfer) with moving-average cost.
  **Stocktakes post variance adjustments** — that's the correction path, not edits.
- Low-stock alerts go to staff (and Telegram if wired).

### M18 Inspections · M19 Maintenance · M22 Complaints
- Checklist templates per room type; move-out inspection gates lease end;
  damage findings → deposit deductions or tickets.
- Tickets: open → assigned → in_progress → resolved → verified/closed, with
  SLA by priority (urgent 4h … low 168h) + daily breach sweep. Costs route to
  expense or owner P&L.
- Complaints: thread + SLA + member-confirmed close with 1–5 rating;
  one-click convert to ticket.

### M20 Expenses & P&L
- Vendor expenses + receipt attachments; **approval above a configurable
  threshold** (auto-approve below; Accountant+ gate); voids reverse.
  Monthly budgets with variance; recurring templates; per-property and
  consolidated P&L from the ledger.

### M23 Attendance
- Kiosk-PIN + mobile clock in/out, optional property geofence, shift
  templates with grace + OT multipliers; exceptions (late/early/missed
  punch/overtime/geofence) with audited resolution; monthly summary + CSV
  payroll export.

### M24 Owner statements
- Monthly generation job (payout day, force bypass, idempotent per
  contract+month). Formula: collected × share | fixed master rent −
  management fee − pass-through − owner maintenance ± audited adjustments.
- `draft → approved → paid`; approval accrues DR 3900 / CR 2200, payout
  DR 2200 / CR cash|bank. PDFs auto-file; owners read them in the portal.
  Generation gated to Accountant+ (GLOBAL M24:update).

### M25 Tenant portal · M21 Telegram
- Portal (`/portal`, mobile PWA): OTP login (hashed single-use codes,
  lockout) materializes the member's User (role MEMBER) — **strictly OWN**
  scope over the same module APIs. No duplicate business logic.
- Telegram: signed webhook (spoofs rejected), one-time link codes, commands
  `/status /dues /pay /help` (own data only), event→template dispatcher with
  per-user toggles. Dev token = mocked sender with full outbox.

### M26 Reports
- 12 reports + dashboard KPI strip (occupancy %, billed vs collected,
  arrears, open tickets, cash position). Every report declares its source
  line; arrears aging must sum to outstanding invoice totals. CSV (RFC-4180)
  + branded PDF export; filter by date + property.

---

## 9. Scheduled jobs (cron)

Job endpoints are cron-shaped — call them on a schedule in production with an
Admin session/token. All runs are audited.

| Job | Endpoint | Typical schedule | Needs |
|---|---|---|---|
| `invoice-generation` | `POST /api/jobs/invoice-generation` | Monthly, on billing day | M07:create |
| `billing-daily` | `POST /api/jobs/billing-daily` | Daily ~01:00 | M06:update |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | Daily ~06:00 | M33:update |
| `statement-generation` | `POST /api/jobs/statement-generation` | Monthly, payout day | GLOBAL M24:update |
| `telegram-dispatch` | `POST /api/jobs/telegram-dispatch` | Daily (or hourly) | M21:update |
| `sla-sweep` | `POST /api/jobs/sla-sweep` | Daily | M19:update |
| `attendance-sweep` | `POST /api/jobs/attendance-sweep` | Daily | M23:update |
| `retention` | `POST /api/jobs/retention` | Daily/weekly | M28:update |
| `backup` | `POST /api/jobs/backup` | **Nightly** | M27:update |

Example (macOS/Linux cron — server must be reachable; use a service account
cookie/token):

```bash
# RentManager nightly jobs (server-local cron)
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup          -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts     -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

On Windows use **Task Scheduler** → "Run a program" →
`powershell.exe -File C:\RentManager\jobs\invoke-jobs.ps1` with an equivalent
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`.
See `DEPLOY_WINDOWS.md` §"Scheduled jobs".

> Prefer a **dedicated service account** (Admin role, long random password,
> 2FA enrolled, credentials in the server vault) over any personal account.

---

## 10. Backup & restore

Full runbook: [`BACKUP.md`](./BACKUP.md). Summary for admins:

- **What:** consistent full PostgreSQL dump via `pg_dump` (custom format),
  safe on a live server. Uploads live in object storage — **back up the
  bucket separately** with provider tooling.
- **Where:** `backups/backup-<timestamp>.dump` (or `$BACKUP_DIR`); container
  path `/app/backups` → `rentmanager-backups` volume. Keeps newest **7**.
- **Restore (order matters):**
  1. `docker compose stop rentmanager`
  2. `createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump`, point `DATABASE_URL` at it
  3. `npx prisma migrate deploy` (forward-only, always safe)
  4. Restart, then verify: `GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · collections report reconciles
- **RPO/RTO:** nightly snapshots ⇒ ≤24h RPO. Test-restore quarterly; an
  untested backup is not a backup.

---

## 11. Security hardening checklist

Baseline already in the build: scrypt passwords, DB revocable sessions,
httpOnly cookies, rate-limited login, TOTP 2FA (mandatory Admin+), signed
login challenges, tamper-evident audit hash chain with PII masking, CSP +
security headers, sealed provider secrets, S3 signed URLs with short TTL.
(see `manual/09-security-guide.md` + `SECURITY.md`.)

Before production, an admin must:

- [ ] Change **every** default secret: `FILE_SIGNING_SECRET`,
      `PAYMENT_WEBHOOK_SECRET`, `SETTINGS_ENC_KEY` (32+ random bytes),
      `TELEGRAM_WEBHOOK_SECRET`, DB password, Redis password,
      MinIO root password, Grafana admin, Nacos/Keycloak admins.
- [ ] Disable or re-password **all `*@demo.test` accounts**; create real
      admins; enroll **2FA** for every Admin+.
- [ ] Set `COOKIE_SECURE=true` and serve **HTTPS only** (reverse proxy:
      Caddy/Nginx/Traefik with TLS; `APP_BASE_URL` = public https URL).
- [ ] Bind internal ports (5432, 6379, 8848, 7080, 9092, 9000…) to
      localhost or a private network — never expose DB/Redis/Kafka to the internet.
- [ ] Verify **rate limits** on auth + webhooks; confirm Telegram/Payment
      webhooks reject bad signatures (spoof test).
- [ ] Run **Verify audit chain**; confirm PII masking in logs.
- [ ] Schedule **nightly backup** + offsite copy; test-restore once before go-live.
- [ ] Set **retention** policy; confirm audit is excluded from purge.
- [ ] Review the **permission matrix** (§4.2) against your org chart; remove
      unused role grants (least privilege).
- [ ] Penetration self-check: cross-property IDOR, privilege escalation,
      webhook spoofing, URL guessing, public `/pay` exact-due enforcement.

---

## 12. Monitoring & logs

| Signal | How |
|---|---|
| App health | `GET /api/health` → 200 + DB `SELECT 1` (used by Docker healthcheck) |
| Backend health | `GET http://localhost:808x/actuator/health` per service; gateway aggregates |
| Audit integrity | `GET /api/audit/verify` → `{ ok: true }` |
| Books reconcile | collections/arrears report `summary.reconciles == "yes"` |
| Dashboards | Grafana http://localhost:9090 (provisioned per-service dashboards) |
| Container status | `docker compose ps` · `npm run docker:status` |
| Logs | `docker compose logs -f rentmanager` · `docker compose logs -f gateway` |
| Kafka | Kafka UI http://localhost:8090 |
| Files | MinIO console http://localhost:9001 |

Investigating a bad transaction: **Audit Log** → filter actor/date/entity →
compare before/after → trace linked invoice/ledger → correct with the proper
**reversal** (credit note / void / refund). Never hand-edit posted records.

---

## 13. Updating the system

```bash
# 1. Snapshot first (backup job or volume backup)
# 2. Pull + rebuild + restart
git pull
docker compose up --build -d
# 3. Migrations run automatically in the entrypoint; verify:
curl -sf http://localhost:3000/api/health
docker compose ps
```

- Migrations are **append-only** — safe to apply to older snapshots; rollbacks
  are not attempted (restore from backup if you must go back).
- Watch `docker compose logs -f rentmanager` on first boot after an update.
- Pin image tags / commit SHAs for production so updates are deliberate.

---

## 14. Troubleshooting for admins

| Symptom | Most likely cause → fix |
|---|---|
| App 500s / won't start | DB not ready → `docker compose ps`, check `postgres` healthy; then `docker compose logs rentmanager` (entrypoint waits + migrates + seeds — read the log tail) |
| Login fails for everyone | Session/cookie domain or `DATABASE_URL` wrong; check env + `/api/health` |
| `403 FORBIDDEN` on an action | Correct RBDC denial → check user's roles + scopes + property assignments (§4–§5) |
| Missing menu item | No `read` on that module, or feature flag off in Settings → Features |
| Invoice job didn't run | Cron/Task Scheduler didn't fire or used an expired cookie → check job audit rows + scheduler logs |
| Webhook double-posted | Shouldn't happen (idempotent) → verify `PAYMENT_WEBHOOK_SECRET` matches gateway config; check logs |
| Telegram silent | Wrong bot token/secret, or template disabled → Settings → Secrets/Templates; check `telegram-dispatch` runs |
| Audit verify fails | **Stop and investigate** — possible tampering; restore from backup only after root-causing |
| Disk full | Docker volumes (DB, MinIO, backups) → prune old backups, `docker system df`, expand volume |
| Slow first build | Normal: Java services + Next build take a while; give Docker ≥8GB RAM, don't pin to 1 CPU (`NEXT_BUILD_CPUS`) |

Platform-specific install issues → `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`
troubleshooting sections. End-user issues → `manual/10-troubleshooting.md`.

---

## 15. Go-live checklist

- [ ] Deployment green on the target machine (`DEPLOY_*.md` verify steps pass)
- [ ] All §11 hardening items done
- [ ] Org/Locale/Billing/Late-fee/Alerts configured; currency final
- [ ] Properties → buildings → floors → rooms → beds entered
- [ ] Real users + roles + property assignments; demo accounts disabled
- [ ] Opening balances posted (if migrating); payment methods + secrets set
- [ ] Owners + contracts + payout methods; Telegram linked + test message received
- [ ] All §9 jobs scheduled and **test-fired once** (check audit rows)
- [ ] Nightly backup scheduled + one test restore completed
- [ ] Staff trained on golden path: lease → invoice → QR/cash payment → receipt → move-out settlement (`manual/13` + `manual/14`)
- [ ] Printed: admin contact list, backup/restore one-pager, incident process

---

*End of Administrator Guide. Keep this file next to the deployment guides and
review it after every major update.*
