# Part 10 — Troubleshooting

Common problems, likely causes, how to check, and how to fix safely. When in
doubt, **use the Audit Log and contact an Administrator** rather than editing
posted data.

Format per item: **Problem → Possible causes → How to check → How to fix → When
to escalate.**

---

## 10.1 Login & access

### "I can't sign in"
- **Causes:** wrong password (case-sensitive), account disabled, rate-limited after many tries, 2FA needed.
- **Check:** retype carefully; wait a minute if you hit the limit; confirm your account is active.
- **Fix:** use the correct password; if admin-set, change it when prompted; for a lost 2FA, ask an admin to **reset your 2FA** then re-enroll.
- **Escalate:** account disabled or repeated lockouts → Admin.

### "I see 403 FORBIDDEN / a menu item is missing"
- **Causes:** your role lacks that module/action, or you're not assigned to that property.
- **Check:** compare with the matrix (Part 8.1); confirm your **property assignments**.
- **Fix:** not a bug — request the permission/assignment from an Admin.
- **Escalate:** if you believe you should have access, an Admin edits your role/assignments.

### Member OTP says "Too many attempts / locked"
- **Fix:** request a **new OTP** (codes are single-use and lock after 5 tries).

---

## 10.2 Billing & invoices

### "A utility/service charge is missing from this month's invoice"
- **Causes:** meter readings not entered before generation; service not assigned; charges attach to the *next* cycle.
- **Check:** **Utilities** — is there a reading for the period? **Services** — is the assignment active for that lease?
- **Fix:** enter readings/log usage; they bill on the **next** generation run. For the current period you can add an appropriate one-time line/credit per policy.
- **Escalate:** Accountant if a correction to an issued invoice is needed (**credit note**).

### "I generated invoices but nothing appeared for a lease"
- **Causes:** lease not **active** (still draft), period already billed (one live invoice per lease-period — generation is idempotent).
- **Check:** lease status = active; check the lease's billing period.
- **Fix:** activate the lease; if already billed, no duplicate is created by design.
- **Escalate:** Accountant.

### "An issued invoice has the wrong amount"
- **Fix:** do **not** try to edit/delete it (issued invoices are immutable). Use a **credit note** (≤ due, auto-settles at zero), or a Super Admin **void** with a mandatory reason.
- **Escalate:** void = Super Admin only.

### "Late fee / dunning didn't apply"
- **Causes:** still within **grace days**; late-fee mode is `none`; the daily billing job hasn't run.
- **Check:** Settings → Billing (grace) and Late fee (mode); run/confirm the **billing-daily** job.
- **Escalate:** Accountant/Admin for job scheduling.

---

## 10.3 Payments

### "Tenant paid but the outstanding balance didn't change"
- **Causes:** payment still **pending** (QR/gateway not confirmed); payment recorded against the **wrong member/invoice**; webhook not received.
- **Check:** open the payment — status pending vs confirmed; check the gateway reference and webhook delivery; check **allocations**.
- **Fix:** confirm pending cash/bank payments; for QR, confirm via the gateway webhook (duplicate webhooks are safely ignored). If it was recorded against the wrong member, don't delete — use **refund/reversal** and record correctly.
- **Escalate:** Accountant (refunds/reversals, gateway webhook checks).

### "A payment was recorded twice"
- **Causes:** manual double-entry. Gateway duplicates are auto-ignored (idempotency keys), so this only happens with manual entry.
- **Fix:** **refund/reverse** the extra payment (Accountant+), which posts correcting ledger entries.
- **Escalate:** Accountant.

### "The member overpaid"
- **Behaviour (not an error):** the extra stays as **member credit** (refundable by an Accountant) — it is **not** income.

---

## 10.4 Contracts & leases

### "I can't activate a lease"
- **Causes:** room not vacant (already an active lease/at capacity), member KYC incomplete (member not verified).
- **Check:** room status (should be vacant/reserved); member KYC checklist complete.
- **Fix:** choose a vacant room; complete KYC uploads; then activate.

### "I can't end/terminate a lease"
- **Causes:** **outstanding dues** not cleared (or approved write-off); no completed **move-out inspection**; deposit not settled.
- **Check:** member balance = 0; move-out inspection completed; deposit ledger netting to zero.
- **Fix:** collect/clear dues, complete the move-out inspection, settle/refund the deposit (evidence required for deductions).
- **Escalate:** Manager for write-off approval; Accountant for deposit refunds.

### "Room status is stuck on cleaning / maintenance"
- **Fix:** return the room to **vacant** (or complete maintenance) to re-let it; maintenance requires a reason to set.

---

## 10.5 Deposits

### "Can't refund / deduct a deposit"
- **Causes:** deductions require **evidence documents + reason code**; refunds need **Accountant approval** and a payout method.
- **Fix:** upload evidence and pick a reason; ensure the owner/member has a payout method; route refund to an Accountant.

### "Deposit still showing after move-out"
- **Fix:** for a closed lease the **2100 Deposit Liability** must net to zero — complete all deductions + refund.

---

## 10.6 Reports & numbers

### "A report number doesn't match what I expect"
- **Check:** filters (date range, property); report permission scope (PROPERTY vs GLOBAL); remember reports read the **ledger/live data** — numbers change as data is entered.
- **Fix:** clear/adjust filters; wait for the relevant posting to land (e.g. payments confirm); drill into the source (invoices/ledger/tickets).
- **Escalate:** genuinely inconsistent totals → Admin/Accountant + check Audit Log.
- Note: there is **no dedicated Balance Sheet report** — use **Ledger → Trial balance** (Part 5.6).

---

## 10.7 Telegram

### "Bot isn't sending messages"
- **Causes:** not linked; per-user toggles off; in dev the sender is **mocked to the outbox**; dispatch job not run; member linking disabled.
- **Check:** Comms → Telegram — linked chats, toggles, and the **outbox** (status/body); Settings → Telegram (`allowMemberLinking`); bot token sealed secret present.
- **Fix:** re-link with a fresh code; enable toggles; in demo, read messages from the outbox; ensure the **telegram-dispatch** job runs in production.
- **Escalate:** Admin (bot token, jobs).

### "Link code doesn't work"
- **Fix:** codes are one-time/short-lived — request a fresh one and send `/link <code>` to the bot.

---

## 10.8 Documents

### "A download link expired / says forbidden"
- **Causes:** signed URLs last **120 seconds**; you may lack permission (cross-property/own-scope only).
- **Fix:** open the document from the record (a fresh signed URL is issued); staff of another property are correctly denied.
- **Escalate:** if you should have access, Admin reviews property assignment/permission.

---

## 10.9 Accounting

### "The books look wrong / trial balance"
- **Fix:** the system rejects unbalanced postings, so issues are usually timing or a missing confirmation. Trace via **Ledger journal** (filter by account/reference) and the **Audit Log**. Correct with the proper reversal (credit note / void / refund) — **never edit ledger rows** (the database blocks updates/deletes on posted rows).
- **Escalate:** Accountant for corrections; Admin for audit-chain verification.

---

## 10.10 Notifications / alerts

### "Rent dues/overdue not showing"
- **Check:** you need **M33 read**; alerts respect the **ahead/overdue days** settings (default 3/1).
- **Fix:** run/confirm the **rent-alerts** and **telegram-dispatch** jobs; check feature flags.

---

## Quick escalation matrix
| Issue | Escalate to |
|---|---|
| Password reset / 2FA reset / disabled account | Admin |
| Missing menu / 403 | Admin (role/property assignment) |
| Invoice correction, refund, deposit refund, owner statements | Accountant |
| Invoice void | Super Admin |
| Bot token / secrets / backups / audit chain | Super Admin / IT |
| Gateway/payment webhook problems | Accountant + IT |
| Suspected tampering / security incident | Super Admin — verify audit chain immediately |
