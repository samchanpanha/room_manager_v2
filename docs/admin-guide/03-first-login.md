# 3. First login & admin accounts

After deployment (see `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`), open
**http://localhost:3000/login**. The database is seeded automatically
(idempotent — safe on every restart).

## 3.1 Seeded accounts (password: `Demo1234!`)

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

## 3.2 First things to do as Super Admin

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
