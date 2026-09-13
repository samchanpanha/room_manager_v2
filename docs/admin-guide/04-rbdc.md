# 4. Roles, permissions & RBDC

## 4.1 The model (read this once, use it forever)

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

## 4.2 Default roles & matrix

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

## 4.3 Building a custom role (example: Cashier)

1. **Admin → Roles → New role** → name it `Cashier`.
2. Tick the grid: **M09 (Payments)** → operational write at **PROPERTY** scope; leave everything else off.
3. Assign the role to the cashier's user + assign their **property**.
4. Result: they can record payments but **cannot open invoices to edit** —
   the API returns `403`. (This exact case is covered by CI negative tests.)

## 4.4 Reports access

Reports are **M26**. Additionally, **Settings → Reports** controls:
`enabledKeys` (which reports exist), `assignments` (which roles/users see
which), `designs` (columns/branding). Report data is never editable.

## 4.5 Safety rules

- Least privilege by default; effective access is the union of all roles.
- A role **in use cannot be deleted**; Super Admin role is protected.
- Every role/permission change is **audited**; the matrix is snapshot-tested
  in CI so privilege can't be silently widened.

---
