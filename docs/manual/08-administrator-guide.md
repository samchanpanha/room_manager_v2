# Part 8 — Administrator Guide

This part is for **Super Admins, Admins, IT and business administrators**. It
covers configuration, users, roles & permissions, menus, reports access,
business settings and maintenance. Users don't need this to do their daily work.

> Everything here is permission-gated. Most administration needs **M01** (Users
> & RBDC) or **M28** (Settings); security items need **M27**. Non-admins simply
> don't see these menus or get `403 FORBIDDEN` from the API.

---

## 8.1 Role-Based Dynamic Access Control (RBDC) — how permissions work

Every page and every API call is checked by a single server-side resolver:

```
can(user, action, module, resource?)
```

- **Permission = module × action × scope.**
- **9 actions:** `create · read · update · delete · approve · void · refund · export · config`.
- **3 scopes:**
  - **GLOBAL** — across all properties.
  - **PROPERTY** — only properties the user is **assigned** to.
  - **OWN** — only the user's own records (members/owners/staff themselves).
- A user holds **one or more roles**; effective permissions = the **union**.
- Users get **property assignments** that limit PROPERTY-scoped access.
- Enforcement is **server-side on every endpoint**; the UI hides things for
  convenience but is never authoritative.
- Permission ids look like `M07:approve` (module:action).

### Default roles (seeded)
| Role | Scope | Description |
|---|---|---|
| **Super Admin** | GLOBAL | Everything, incl. config/delete/void. **Protected — cannot be deleted.** |
| **Admin** | GLOBAL | Manages the org; manage-level (CRU) across modules; no full-delete/config |
| **Property Manager** | PROPERTY | Runs assigned properties: rooms, leases, operations, reports(ops) |
| **Accountant** | GLOBAL | Owns money: rent engine, invoices, ledger, payments, statements, P&L |
| **Staff** | PROPERTY | Front-desk/field: operational write on assigned properties; read on others |
| **Owner** | OWN | Landlord: read-only on **own** buildings, statements, documents |
| **Member** | OWN | Tenant: own records via the portal only |

### Matrix letters
`F`=full (incl. config/delete) · `M`=manage (create/read/update) · `R`=read ·
`W`=read + operational write · `O`=own records only · `–`=none.

### Role × module access matrix (actual seeded permissions)

| Module | Super Admin | Admin | Prop Mgr | Accountant | Staff | Owner | Member |
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

\* Owners read their own buildings (own-scope).
† OWN scope on statements/own data only.

---

## 8.2 User management

**Where:** **Admin → Users [M01]**.

### Create a user
1. **Users → New user.** Enter name, **email**, and a temporary password.
2. The account is created with `mustChangePassword = true`, so the user is **forced
   to change their password on first sign-in**.
3. Assign **role(s)** (one or more).
4. Assign **properties** (for PROPERTY-scoped roles like Property Manager / Staff).
5. Save. The user can now sign in; Admin+ will also be required to enroll **2FA**.

### Edit / disable / reset
- **Edit** name/email and roles/property assignments.
- **Disable** a user (`status = disabled`) — they can no longer sign in.
- **Reset password** — set a new temporary password (sets the must-change flag).
- **2FA admin reset** — if a user loses their authenticator, reset their TOTP so
  they can re-enroll (M27).
- **Revoke sessions** — force sign-out across devices from the security/sessions area.

### Rules
- Every user change is **audited**.
- A role that is **in use cannot be deleted** (you must remove users from it first).
- The **Super Admin role is protected** — it can't be deleted, ensuring there is
  always a full-access account.

> There is no self-service email "forgot password" in the current build — an
> admin resets a forgotten password (sets a temporary one).

---

## 8.3 Role & permission management

**Where:** **Admin → Roles & Permissions [M01]** (`/roles`, detail at `/roles/[id]`).

### Build or edit a role
1. **Roles → New role** (or open a role). Give it a name/description.
2. Tick the **permission grid**: for each **module** choose the **action(s)** and
   the **scope** (GLOBAL / PROPERTY / OWN). The grid uses the same F/M/R/W/O model.
3. Save. The role's permissions are stored as `role_permissions` rows
   (`module:action:scope`).
4. Assign the role to users.

### Example (from the product acceptance test)
Create a role **"Cashier"** with only **M09: W (payments operational write)** at
PROPERTY scope. A user with *only* that role can record payments but **cannot
open invoices to edit** — the API returns `403` (enforced and tested in CI).

### Rules & safety
- **Default/protected roles:** Super Admin is protected; default roles are seeded
  from the catalog. You may create custom roles freely.
- **Deletion:** a role in use cannot be deleted.
- **Auditing:** every role/permission change writes an audit row. The permission
  matrix is also **snapshot-tested in CI** (negative tests included) so
  privilege can't be accidentally widened.
- **Effective access is the union** of all a user's roles — least-privilege by
  default; add roles deliberately.

### Report permissions
Reports are **M26**. In addition, reports can be individually **enabled and
assigned** under **Settings → Reports**:
- **enabledKeys** — which reports are available in the catalog.
- **assignments** — which roles/users see which report.
- **designs** — column layout/branding per report.
Report **data** is never editable — it stays ledger/query-backed.

---

## 8.4 Menu management

There is no separate drag-and-drop menu builder; menu visibility is **derived
from permissions** (the same `can()` resolver drives both the sidebar and the
route guards). The navigation model (`src/lib/nav.ts`) groups items by section:

Overview · Portfolio · Billing · Finance · Operations · Store · Comms · Insights · Admin · Account.

- A menu item appears only if the user's roles grant the module's **read**
  permission **and** the module's **feature flag** isn't off (Settings → Features).
- Unbuilt/phase-gated items are shown disabled and labelled.
- **M13 (QR)** and **M17 (Documents)** intentionally have no top-level menu — they
  live inside invoices/member records.
- **Settings → Menu** lets you choose the sidebar side (`left`/`right`).

So: **to show/hide a menu item, adjust the role's permissions (and the feature
flag)** — you don't edit a menu table.

---

## 8.5 Business settings (M28)

**Where:** **Admin → Settings [M28]**. All changes are **audited** and financial
settings apply **forward-only** (posted history is never rewritten). Settings
are grouped as follows:

| Group | Controls | Why it matters / recommended |
|---|---|---|
| **Org** | Company/legal name, address, phone, email, website, tax ID, logo, invoice footer note, invoice PDF template (classic/modern) | Branding on every PDF/receipt. Keep legal name & tax ID accurate. |
| **Locale** | Currency, timezone, UI language (en / km Khmer / zh Chinese) | Money is integer minor units in the single org currency. Language default applies org-wide; users can override via the 🌐 picker. |
| **Billing** | Invoice prefix, grace days (default **3**), dunning days (default **[3,7,14]**) | Drives invoice numbering and when reminders/late fees start. Changes apply forward. |
| **Late fee** | Mode (none/flat/percent), flat amount, monthly % (basis points), cap | Off by default (`none`). When enabling, set a sensible cap — late fees never exceed the amount due. |
| **Retention** | outbox (90d), events (365d), OTP (7d), session (30d) retention | Data-retention purge; **audit trail is never purged**. |
| **Features** | Feature flags per module (M14 POS, M15 Stock, M21 Telegram, M29 PO = on by default) | Turn modules on/off for the org; hides the menu and gates access. |
| **Reports** | enabled report keys, role assignments, report designs | Controls who sees which reports (data stays source-backed). |
| **Templates** | Telegram message overrides for 5 events with `{placeholders}` | Customise wording for issued/receipt/dunning/reminder/overdue. |
| **Printers** | Thermal paper width (58/80mm), auto-print receipt, receipt copies, print barcode by default | POS receipt/label printing. |
| **Telegram** | Bot display name, welcome message, allow member self-linking | Tenant bot behaviour. |
| **Menu** | Sidebar side (left/right) | Layout preference. |
| **Units** | Measurement units for stock/POS items | Units offered when creating items/products. |
| **Table** | Default page size for lists | List density (default 25). |
| **Alerts (M33)** | Rent alerts: ahead days (3), overdue days (1) | Controls the dashboard "due soon/overdue" window. |
| **Secrets (Providers)** | Payment provider credentials, Telegram bot token | Stored **sealed (AES-256-GCM)**; shown masked; env vars are the fallback. Never paste secrets in chat. |
| **Opening balances** | Ledger opening postings | Set balanced `opening` entries when migrating into the system. |

### What can go wrong
- Changing **currency** after data exists is not supported (single-currency) — set it at go-live.
- **Late fee / billing** changes only affect **future** periods (forward-only) — don't expect them to rewrite old invoices.
- Turning a **feature flag off** hides a module but does not delete its data.
- Removing a **report permission** hides the report; underlying data is untouched.

---

## 8.6 Company / branch structure
RentManager is **multi-property from day one**; every record is property-scoped
where applicable. The hierarchy is **Property → Building → Floor → Room → Bed**.
- A **Property** is the top level (think "site" or "project"); there's no separate
  "branch" entity — properties act as the scoping unit.
- **Property assignments** on a user control which properties a PROPERTY-scoped
  role can see/manage (the Property Manager demo is assigned to one property on
  purpose to demonstrate scoping).
- Buildings optionally carry map coordinates and a **geofence radius** for kiosk
  attendance.

---

## 8.7 Admin golden path (initial setup order)

See **Part 13 §13.2** for the step-by-step, but the order is:

1. Configure **company/org** (name, currency, timezone, language)
2. Create **properties → buildings → floors → rooms**
3. Create **roles** & **users**; assign roles and properties
4. Configure **permissions** (role grid)
5. Configure **rent engine** plans/late fees/tax/discounts
6. Configure **accounting** opening balances (if migrating)
7. Configure **payment methods** / provider secrets
8. Configure **billing/dunning** and **rent alerts**
9. Onboard **owners + owner contracts** and **payout methods**
10. Configure **notifications** (templates) and **Telegram** (bot token, linking)
11. Enforce **security**: 2FA for Admin+, sessions, rate limits (Part 9)
12. Enable/disable **feature flags** and **reports** per the org
13. **Test** the golden path end-to-end (Part 13)
14. Review **audit logs** and set up the **backup** job/runbook

---

## 8.8 Maintenance & background jobs

Cron-shaped job endpoints exist (call them on a schedule in production):

| Job | Schedule (typical) | Permission |
|---|---|---|
| `invoice-generation` | Monthly (per billing day) | M07:create |
| `billing-daily` | Daily | M06:update |
| `rent-alerts` | Daily | M33:update |
| `telegram-dispatch` | Daily (or frequent) | M21:update |
| `sla-sweep` | Daily | M19:update |
| `attendance-sweep` | Daily | M23:update |
| `statement-generation` | Monthly (payout day) | GLOBAL M24:update |
| `retention` | Daily/periodic | M28:update |
| `backup` | Nightly | M27:update |

### Backups
- The **nightly backup job** snapshots the database (SQLite `VACUUM INTO` —
  consistent on a live DB) and keeps the **newest 7**. The restore runbook is in
  [`docs/BACKUP.md`](../BACKUP.md).

### Data retention purge
- The **retention** job purges outbox/events/OTP/sessions per the retention
  settings. **Audit logs are never purged.**

---

## 8.9 Audit log (for administrators)

**Where:** **Admin → Audit Log [M01/M27]** (`/audit`).

- **What is logged:** every mutation (create/update/status change/approve/void/
  refund/login/permission change…) with **actor**, **timestamp**, **before/after
  values (JSON)**, and **IP**.
- **Tamper-evident:** audit rows form a **hash chain**; use **Settings →
  Security → Verify audit chain** to detect any tampering. PII is masked in logs.
- **Investigating an incorrect transaction:** filter by actor/date/entity, find
  the action, compare before/after, then trace the linked ledger/invoice and use
  the correct **reversal** (credit note / void / refund) — never hand-edit.

A backfill/chain utility exists (`scripts/backfill-audit-chain.ts`).
