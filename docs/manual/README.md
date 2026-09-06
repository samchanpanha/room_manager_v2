# RentManager — Complete User & Administrator Manual

> **What this manual covers.** This manual documents **RentManager** — the rental &
> co-living property operations platform in this repository — *exactly as it is
> built in the code*. Every workflow, field, role, report, and setting below was
> verified against the source code (`src/`), the database schema
> (`prisma/schema.prisma`), the permission catalog (`src/lib/rbac/catalog.ts`)
> and the product intent (`INTENT.md`).
>
> **No features are invented.** Where the master brief asked about a capability
> that does **not** exist in the current build, this manual says so explicitly
> with a block like this:
>
> > 🚫 **Not confirmed in the current system.**
>
> so staff are never trained on a button that isn't there.

## How the manual is organised

The manual is written in three layers (Quick Start → User Guide → Admin Guide),
as recommended, and split into 13 parts so you can open only what you need.

| Part | File | Who it is for |
|---|---|---|
| 1 · System Overview | [01-system-overview.md](./01-system-overview.md) | Everyone |
| 2 · Quick Start Guide | [02-quick-start.md](./02-quick-start.md) | New staff (start here) |
| 3 · User Guide (daily modules) | [03-user-guide.md](./03-user-guide.md) | Staff, managers, finance, cashiers |
| 4 · Business Workflows (lifecycle) | [04-business-workflows.md](./04-business-workflows.md) | Staff, managers |
| 5 · Financial & Accounting Guide | [05-financial-accounting-guide.md](./05-financial-accounting-guide.md) | Finance, accountants, managers |
| 6 · Reports Guide | [06-reports-guide.md](./06-reports-guide.md) | Managers, finance, owners |
| 7 · Telegram & Notifications Guide | [07-telegram-notifications.md](./07-telegram-notifications.md) | Staff, members, owners |
| 8 · Administrator Guide | [08-administrator-guide.md](./08-administrator-guide.md) | Admins, super admins |
| 9 · Security Guide | [09-security-guide.md](./09-security-guide.md) | Admins, IT, security |
| 10 · Troubleshooting | [10-troubleshooting.md](./10-troubleshooting.md) | Everyone |
| 11 · FAQ | [11-faq.md](./11-faq.md) | Everyone |
| 12 · Glossary | [12-glossary.md](./12-glossary.md) | Everyone |
| 13 · Golden Paths & Scenarios | [13-golden-paths.md](./13-golden-paths.md) | Trainers, new employees, admins |

There is also a short one-page index card inside Part 2.

## Two audiences, two reading paths

- **Operating staff / property managers / finance** → read **Parts 1, 2, 3, 4, 5, 6, 7**,
  then keep **Parts 10–13** for reference.
- **Administrators / IT / security** → read **Parts 1, 8, 9**, plus **Part 13
  (Admin golden path)** and the audit/security references.

## Demo / training system

A seeded training system is included. Every demo account uses the password **`Demo1234!`**:

| Sign-in email | Role | Good for learning |
|---|---|---|
| `root@demo.test` | **Super Admin** | Everything, incl. roles/permissions/voids |
| `admin@demo.test` | **Admin** | Whole organisation, no destructive config |
| `pm@demo.test` | **Property Manager** | Assigned to one property (sees scoping) |
| `accountant@demo.test` | **Accountant** | Billing, ledger, payments, statements |
| `staff@demo.test` | **Staff** | Front-desk operational work |
| `owner@demo.test` | **Owner** | Sees only his own buildings & statements |
| `member@demo.test` | **Member** | Tenant portal (own records only) |

> ⚠️ These are **training accounts only**. Change or disable them before go-live
> (see Part 8 → User Management).

## Conventions used in this manual

- **`Menu → Item`** is a navigation path inside the admin console.
- **Module codes** like **M07** are the internal permission codes (you see them
  on the Roles & Permissions screen). They map to names in Part 1.
- 💰 marks anything that moves money or posts to the ledger.
- 🔒 marks something restricted to certain roles.
- ⚠️ marks an action that is hard or impossible to reverse.
- 🚫 marks a feature from the brief that is **not in the current build**.
