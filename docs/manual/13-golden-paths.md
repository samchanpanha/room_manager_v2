# Part 13 — Golden Paths & Practical Scenarios

The fastest way to learn the system is to follow the **golden path** — the normal
end-to-end journey. Then use the 20 scenarios for specific tasks.

---

## 13.1 The User Golden Path (new staff / daily business)

> The easiest way for a new employee to learn the system.

1. **Log in** (change your temporary password; set up 2FA if prompted).
2. **Check the Dashboard** — occupancy, collected vs billed, arrears, cash, rent dues.
3. **Manage properties & rooms** — confirm rooms are vacant/priced.
4. **Register a member** — 4-step wizard + KYC uploads (prospect → verified).
5. **Create a lease** — member + room + rent + deposit + services; activate (room occupied, member active).
6. **Add monthly services** — WiFi/parking/laundry as applicable.
7. **Enter meter readings** — utilities for the period.
8. **Generate monthly charges** — invoice generation (idempotent, gapless).
9. **Issue invoices** — members see them in the portal / get Telegram messages.
10. **Receive payment** — cash/QR/card; receipt issued; invoice partial_paid→paid.
11. **Ledger updates automatically** — balanced entries; member statement reflects it.
12. **Record expenses** — vendor costs with receipts (approve if above threshold).
13. **Handle operations** — maintenance/complaints/inspections/room moves as they arise.
14. **Review Profit & Loss** — revenue − expenses = net.
15. **Review trial balance** — debits = credits (via Ledger).
16. **Generate owner statements** — Accountant generates; approve; pay owners.
17. **Send notifications** — dunning/reminders/Telegram (jobs or manual triggers).
18. **Run reports** — occupancy, collections/arrears, rent roll, P&L, etc.; export.

If you can do steps 2 → 10 unaided, you can run the front desk.

---

## 13.2 The Admin Golden Path (initial system setup)

1. **Configure company/org** — name, legal name, logo, invoice template (Settings → Org).
2. **Configure locale** — currency, timezone, default language (en/km/zh).
3. **Create properties → buildings → floors → rooms** (use the bulk room wizard).
4. **Onboard owners** — owner records + payout methods; assign buildings; create owner contracts.
5. **Configure roles** — review the default matrix; create any custom roles (e.g. "Cashier").
6. **Configure users** — create staff with temporary passwords; assign role(s) + properties.
7. **Configure the rent engine** — plans, cycle days, proration basis, late fees, tax, discounts.
8. **Set billing & dunning defaults** — grace days, dunning ladder, invoice prefix; rent-alert windows.
9. **Configure accounting** — opening balances (balanced postings) if migrating; verify chart of accounts.
10. **Configure payment methods & providers** — sealed provider secrets; confirm QR/webhook setup.
11. **Configure notifications** — Telegram bot token (sealed), templates, member linking.
12. **Set feature flags & reports** — turn modules on/off; assign reports to roles.
13. **Enforce security** — 2FA for Admin+, session policy, rate limits, backups.
14. **Schedule the jobs** — invoice-generation, billing-daily, rent-alerts, telegram-dispatch, sla-sweep, attendance-sweep, statement-generation, retention, backup.
15. **Test the golden path** end to end (the 12-scenario acceptance in §13.4).
16. **Review audit logs** and run **verify audit chain**; confirm backups run (restore test).

---

## 13.3 Twenty practical scenarios

### Scenario 1 — Create a new property
**Portfolio → Properties → New.** Enter a unique code, name, address, optional geofence. Save. You can now add buildings.

### Scenario 2 — Create a new unit (room)
Open the property → **add building** → **add floor** → **add room** (or **bulk create** rooms with prefix/start/count/beds/type/price). Set base price and capacity. The room starts **vacant**.

### Scenario 3 — Create a tenant (member)
**Members → New member** → wizard: personal → property/emergency contacts → **KYC uploads** (all required doc types) → review. Member is **prospect**; complete KYC flips to **verified**.

### Scenario 4 — Create a rental (lease)
**Leases → New** → choose member + vacant room/bed → set start/end, rent, cycle day, proration basis, deposit installments → add services → save **draft** → **Activate**. Room → occupied; member → active; deposit billed; first invoice scheduled.

### Scenario 5 — Create a contract
Activating a lease **generates the member contract PDF** (auto-filed to documents). For landlords, create an **owner contract** (FIXED_RENT or REVENUE_SHARE %, management fee, payout day) and **activate** — that syncs building ownership.

### Scenario 6 — Add monthly services
**Billing → Services** → create catalog items; on the lease **assign** fixed monthly services (WiFi/parking slot) and log **per-use** usage (laundry/visitor parking). Fixed services bill on the next invoice; mid-month suspend prorates.

### Scenario 7 — Generate monthly billing
Enter meter readings first (**Utilities**), then **Invoices → Generate**. The run bills every active lease (prorated catch-up for mid-month starts, one invoice per lease-period, gapless numbers, PDFs filed). Then **Issue** invoices.

### Scenario 8 — Receive a tenant payment
**Payments → New** → choose member → enter amount → choose method (cash/bank/qr/card/cheque) → save. Cash/bank confirm immediately; the receipt `RCP-…` is filed; the invoice flips to partial/paid; ledger posts; a Telegram receipt can be sent.

### Scenario 9 — Record a partial payment
Same as Scenario 8 but enter less than the due. The payment is allocated oldest-first; the invoice becomes **partial_paid** with the remainder still due. The rest later flips it to **paid**.

### Scenario 10 — Handle an overdue payment
After the grace period the **billing-daily** job marks the invoice **overdue**, applies late fees (if configured), and dunning reminders fire (+3/+7/+14). Use the dashboard **Rent dues** card → **Overdue & not paid** report to chase; record payment when received.

### Scenario 11 — Change the rental price
Don't edit posted bills. Set the new price on the lease/rent plan going **forward** (renewal/new terms); the system prorates mid-period changes via the appropriate workflow (e.g. room move creates an adjustment invoice). Settings apply forward-only.

### Scenario 12 — Renew a contract
At lease end, complete/terminate the old lease (after clearance + inspection + deposit settlement) and create the next lease/terms — or use auto-renew terms where set. Owner contracts are recreated/activated when terms change.

### Scenario 13 — Terminate a rental
Give **notice** → clear dues to 0 (or approved write-off) → complete the **move-out inspection** → **terminate/complete**. Room → cleaning; member → moved_out; settle the deposit (deduct with evidence + refund). Return the room to vacant.

### Scenario 14 — Record an expense
**Finance → Expenses & P&L → New** → vendor, category (maps to ledger 5000/5100), amount, date, payment method, receipt attachment, property. Below $500 it auto-approves and posts; above, an Accountant/Manager approves. Wrong expense? **Void** (reverses).

### Scenario 15 — Review Profit & Loss
**Reports → Profit & Loss** (or Expenses & P&L). Filter by property/period. Read revenue lines (rent/services/utilities/late fees/other) minus expenses and owner payout = net. Compare with **Expense vs budget**.

### Scenario 16 — Generate an owner statement
**Finance → Owner Statements** (Accountant+). **Generate** for the month — idempotent per contract+month. Review the formula (collected × share or fixed rent − fees − costs ± adjustments) → **Approve** (accrues) → **Pay** (clears Owner Payable). PDF is filed and shown in the owner portal.

### Scenario 17 — Send a document through Telegram
Generated docs that ride an event are delivered automatically — e.g. the **payment receipt** on `payment.confirmed` and the **owner statement** on approval. Ensure the user is **linked** and toggles are on. (In demo, see the outbox on the Telegram screen.)

### Scenario 18 — Create a new system user
**Admin → Users → New** → name/email + temporary password → assign role(s) + properties → save. The user is forced to change password on first login; Admin+ must enroll 2FA. Disable/reset from the same screen.

### Scenario 19 — Configure role permissions
**Admin → Roles & Permissions → New/Edit role** → tick the **module × action × scope** grid → save → assign to users. Example: a "Cashier" with only M09 payments write. Changes are audited; roles in use can't be deleted; Super Admin is protected.

### Scenario 20 — Investigate an incorrect transaction
1. Open **Admin → Audit Log**; filter by actor/date/entity.
2. Read the **before/after** values and note the linked record.
3. Open the source (invoice/payment/expense) and the **Ledger journal** for its entries.
4. Apply the correct reversal — **credit note** (invoice), **refund** (payment, Accountant+), **void** (expense) — never hand-edit posted rows.
5. If tampering is suspected, run **verify audit chain** (Security) and escalate.

---

## 13.4 End-to-end acceptance walkthrough (the "golden scenario")

This mirrors the system's own acceptance test — run it in the demo to see everything connect:

1. Super Admin creates org (currency, timezone), property + building + 3 rooms; roles/users (PM, Accountant, Staff).
2. Onboard an Owner with a revenue-share (60%) owner contract for the building.
3. Onboard a Member: KYC docs → lease on a room (mid-month start), rent 300/mo, deposit 600 in 2 installments, WiFi 15/mo.
4. Generate invoice #1: prorated rent + WiFi + an electricity charge (meter reading) → issued → PDF filed → Telegram/portal.
5. Member pays 50% by QR (webhook confirms once; duplicate ignored) and the rest in cash via Staff. Receipts issued; ledger balanced.
6. Member requests a room move → approved with +10 proration → one adjustment invoice; both rooms flip status.
7. Member raises a complaint → converted to a maintenance ticket → resolved consuming 1 stock item → closed → member rates.
8. Month end: utilities recorded, expenses booked, P&L generated; owner statement drafted → approved → payout paid → owner sees the PDF in the portal.
9. Verify: trial balance nets to zero; arrears report consistent; audit trail complete; a Staff user is blocked from voiding an invoice (negative test).

> When this walkthrough runs cleanly, staff have seen the **whole** business
> loop — from an empty room to a paid owner — and understand how every module
> feeds the next.
