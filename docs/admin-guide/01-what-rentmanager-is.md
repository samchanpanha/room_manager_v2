# 1. What RentManager is

> **Who this is for:** Super Admins, Admins, IT staff, and business owners who
> install, configure, secure, and maintain RentManager.
> **Staff doing daily work** (front desk, cashiers, managers) should start with
> the in-app **Help & Guide** (`/guide`) or
> [`docs/manual/`](../manual/README.md) instead.
>
> 🌐 Also available in **Khmer** ([`ADMIN_GUIDE_KM.md`](../ADMIN_GUIDE_KM.md)) and
> **Chinese** ([`ADMIN_GUIDE_ZH.md`](../ADMIN_GUIDE_ZH.md)).
>
> Companion docs:
> [`DEPLOY_MAC.md`](../DEPLOY_MAC.md) · [`DEPLOY_WINDOWS.md`](../DEPLOY_WINDOWS.md) ·
> [`CHEAT_SHEET.md`](../CHEAT_SHEET.md) (printable: `/guide/cheat-sheet.html` in-app) ·
> [`BACKUP.md`](../BACKUP.md) · [`SECURITY.md`](../SECURITY.md) ·
> [`manual/08-administrator-guide.md`](../manual/08-administrator-guide.md) (RBDC reference) ·
> [`manual/15-deployment-guide.md`](../manual/15-deployment-guide.md) (in-app deploy guide, EN/KM/ZH)

---



## Key design facts

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
| Source of truth | [`INTENT.md`](../../INTENT.md) + code + `prisma/schema.prisma`. The in-app guide documents only what actually exists. |

---
