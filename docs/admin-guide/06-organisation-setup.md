# 6. Organisation setup (golden order)


## Golden setup order

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
