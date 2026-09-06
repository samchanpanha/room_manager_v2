# Part 12 — Glossary

Simple definitions of the terms used in RentManager. Module codes in brackets.

| Term | Plain-language meaning |
|---|---|
| **Property** | A rental site/project — the top level of the inventory tree. |
| **Building** | A building within a property, owned by one Owner. |
| **Floor** | A level within a building. |
| **Room / Bed** | A lettable unit; beds let rooms individually in co-living. |
| **Room status** | vacant · reserved · occupied · cleaning · maintenance (state machine). |
| **Owner (landlord)** | The person/company who owns a building and gets owner statements. |
| **Owner contract [M05]** | Management agreement: FIXED_RENT (master rent) or REVENUE_SHARE (% + fee). |
| **Member / Tenant** | The resident/occupant; lifecycle prospect→verified→active→notice→moved_out. |
| **KYC** | Identity documents a member must upload before being verified (passport/ID, etc.). |
| **Party** | The shared record for any person or company (members, owners, vendors, contacts). |
| **Lease [M05]** | A member's occupancy contract for a room/bed (draft→active→notice→terminated/completed). |
| **Rent plan / Rent engine [M06]** | Billing rules (amount, cycle day, proration, late fees, tax, discounts) that generate invoice lines. |
| **Cycle day** | The day of the month rent is billed (clamped 1–28). |
| **Proration** | Charging only for the days occupied in a partial month (e.g. 17/31). Basis = calendar or 30-day. |
| **Invoice [M07]** | A member's monthly bill. States draft→issued→partial_paid→paid→overdue (or void). Gapless numbering {PROP}-{YEAR}-{SEQ}. |
| **Credit note** | The correct way to reduce an issued invoice (immutable); auto-settles at zero. |
| **Void** | Cancelling an invoice — **Super Admin only**, reason required; the number is never reused. |
| **Dunning** | Reminder ladder for overdue invoices (+3/+7/+14 days). |
| **Late fee** | Charge after the grace period; flat or % (with cap); never exceeds the amount due. |
| **Payment [M09]** | Money received (cash/bank_transfer/qr/card/cheque); pending→confirmed→refunded/failed. |
| **Receipt** | Numbered proof of payment (`RCP-…`), PDF auto-filed. |
| **Allocation** | Applying a payment to invoices, oldest-first; sums equal the payment. |
| **Member credit** | Money a member overpaid, held on account (refundable) — not income. |
| **Refund** | Returning money; needs Accountant+ approval; reverses ledger entries. |
| **QR payment [M13]** | Pay-by-QR; member QR opens the public `/pay` page (no login, exact-due only). |
| **Deposit [M10]** | Security deposit held for a lease; billed as installments; held in liability (not revenue). |
| **Deposit deduction** | Keeping part of a deposit at move-out (damage/cleaning/unpaid rent) — requires evidence + reason. |
| **Utility [M11]** | Metered charge (electric/water/gas) = usage × tiered tariff; billed on the next invoice. |
| **Service [M12]** | Add-on (WiFi, parking slot, WiFi account, laundry). Fixed monthly or per-use. |
| **Ledger [M08]** | The immutable double-entry book of all money events (append-only). |
| **Journal** | Chronological list of ledger entries. |
| **Trial balance** | Check that total debits = total credits (should net to zero). |
| **Debit / Credit** | The two sides of every entry (Σ debits = Σ credits always). |
| **Account** | A tracked bucket: Cash (1100), Bank (1200), Rent Receivable (1300), Deposit Liability (2100), Owner Payable (2200), Tax Payable (2300), Owner Distributions (3900), revenue 4000–4900, expenses 5000–5100. |
| **Receivable** | Money members owe (asset), until paid. |
| **Revenue / Income** | Money earned (rent, services, utilities, late fees, other). |
| **Expense [M20]** | Money spent operating; expenses below $500 auto-approve, above need approval. |
| **Asset** | What the business holds (cash, bank, receivables). |
| **Liability** | What the business owes (deposits held, owner payable, tax payable). |
| **Equity** | Owners' stake / owner distributions (account 3900). |
| **Reversal** | A corrective entry that undoes a posted one (originals are kept). |
| **Profit & Loss (P&L) [M20/M26]** | Revenue − expenses (and owner payouts) = net profit/loss for a period. |
| **Owner statement [M24]** | Monthly payout report per owner: collected × share (or fixed rent) − fees − costs; draft→approved→paid. |
| **Owner payable (2200)** | Money owed to owners (liability), cleared when the payout is made. |
| **POS [M14]** | Point-of-sale counter: register sessions, cash float, sales, charge-to-room. |
| **Charge to room** | A POS sale billed to a resident as a one-time invoice. |
| **Stock [M15]** | Inventory; changes only via movements (purchase/sale/consumption/adjustment/transfer). |
| **Purchase order (PO) [M29]** | A planned supplier order; placing is bookkeeping, receiving adds stock. |
| **Stocktake** | Counting actual stock; variance posts an adjustment. |
| **Moving-average cost** | Inventory valuation method (cost per unit averages in new purchases). |
| **Room move [M16]** | Moving a resident between rooms; creates one net adjustment invoice; both rooms flip status. |
| **Inspection [M18]** | Move-in/move-out/periodic condition checklist; move-out is required to end a lease. |
| **Finding** | A failed inspection item; can open a maintenance ticket or propose a deposit deduction. |
| **Maintenance ticket [M19]** | Repair job: open→assigned→in_progress→resolved→verified/closed; SLA by priority. |
| **SLA** | Service-level time target (urgent 4h … low 168h); breaches swept daily. |
| **Complaint [M22]** | Member grievance: new→acknowledged→in_progress→resolved→closed; can convert to a ticket; rated 1–5. |
| **Attendance [M23]** | Staff clock in/out (kiosk PIN or mobile geofence); exceptions; CSV payroll export. |
| **Short stays [M32]** | Hotel-style hourly/daily bookings (`STY-…`) via rent modules & rate rules. |
| **Tenant portal [M25]** | Member self-service web app at `/portal` (OTP login, own data only). |
| **Owner portal** | Read-only view for landlords of their buildings/statements/documents. |
| **Telegram bot [M21]** | Chat integration for notifications and `/status /dues /pay`; linked with a one-time code. |
| **Reports [M26]** | 13 ledger/query-backed analytics with CSV/PDF export. |
| **Arrears** | Total money still owed on open invoices. |
| **Occupancy %** | Occupied rooms ÷ total rooms. |
| **Cash position** | Ledger Cash (1100) + Bank (1200) balance (a dashboard KPI). |
| **Audit log [M01/M27]** | Tamper-evident, append-only record of every mutation (actor, time, before/after, IP). |
| **Role** | A named set of permissions (Super Admin, Admin, Property Manager, Accountant, Staff, Owner, Member, or custom). |
| **Permission** | module × action × scope (e.g. `M09:approve` at PROPERTY scope). |
| **Action** | create · read · update · delete · approve · void · refund · export · config. |
| **Scope** | GLOBAL (all properties) · PROPERTY (assigned properties) · OWN (own records only). |
| **RBDC** | Role-Based Dynamic Access Control — the permission system enforced on every API call. |
| **Feature flag** | Org-level on/off switch for a module (Settings → Features). |
| **2FA / TOTP [M27]** | Two-factor authentication via an authenticator app; mandatory for Admin+. |
| **Session** | A signed-in browser session; revocable; expires after a set number of days. |
| **Feature/module code (Mxx)** | Internal permission code (M01…M33) shown on the roles screen and used by `can()`. |
| **Minor units** | Money stored as integer cents to avoid rounding errors (single org currency). |
| **Forward-only** | Setting changes apply to future transactions only; posted history is never rewritten. |
| **Idempotent** | Running a job twice gives the same result (no duplicate invoices/payments). |
