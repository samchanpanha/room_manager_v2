# Part 11 — FAQ (Frequently Asked Questions)

Written in everyday language. Multi-part questions: "**Q** / **A**".

**Getting in**
- **Q: How do I log in?** Enter your work email and password on the login page. Admin accounts also enter a 2FA code. New admin-set passwords must be changed on first sign-in.
- **Q: I forgot my password — is there a reset email?** Not in the current system (no email channel). Ask an administrator to set a temporary password; you'll change it on next login.
- **Q: Why can't I see a menu item?** Your role doesn't have permission for it (or the feature flag is off). That's intended — ask an admin if you need it.
- **Q: I keep getting "403 FORBIDDEN".** You lack the module/action permission or aren't assigned to that property. Request access; don't try workarounds.
- **Q: How do members log in to the tenant portal?** With a one-time password (OTP) sent to their email/phone. Codes are single-use and lock after 5 attempts.

**Properties, members, leases**
- **Q: How do I create a rental / lease?** First ensure the property→building→floor→room exists and the member is KYC-verified. Then **Leases → New**, pick member + room, set rent/start/deposit/services, save draft, then **Activate** (Part 3.6).
- **Q: Can a room have two tenants?** Only up to its bed capacity. There's **one active lease per bed**; the system blocks over-booking.
- **Q: How do I change the monthly rent?** You don't edit posted bills. Rent terms are snapshotted on the lease; future changes use renewals / room moves / new lease terms. Settings change applies **forward only**.
- **Q: What do the room colours/statuses mean?** vacant, reserved (draft lease), occupied (active lease), cleaning (after move-out), maintenance (needs repair).
- **Q: How do I cancel/end a contract?** Give notice, clear outstanding dues (or approved write-off), complete the move-out inspection, then terminate/complete. The room goes to cleaning and the deposit is settled.
- **Q: How do I blacklist a tenant?** From the member profile with a mandatory reason; it blocks status moves and new leases. Un-blacklisting is also audited.

**Billing & money**
- **Q: How are monthly bills made?** You don't type them. Run **invoice generation** (or the scheduled job): rent + services + utilities + one-offs − discount + tax. It's idempotent and gaplessly numbered.
- **Q: Can I add several services?** Yes — WiFi, parking, laundry etc. Fixed monthly services bill every month (prorated if they start/stop mid-month); per-use becomes one-time lines.
- **Q: How do I record a partial payment?** Just enter the amount received. It's allocated oldest-first and the invoice becomes **partial_paid**; the rest stays due.
- **Q: Why does a tenant still show an outstanding balance after paying?** The payment may be **pending** (QR not yet confirmed), recorded against the wrong member, or it was partial. Check payment status and allocations.
- **Q: What happens if a tenant overpays?** The extra is held as **member credit** (not income), refundable by an Accountant.
- **Q: Can I change or delete an old payment/invoice?** No deletes. Correct an invoice with a **credit note** (or Super-Admin void with reason); reverse a payment with a **refund** (Accountant approval).
- **Q: How do late fees and reminders work?** After the grace period (default 3 days) the daily job adds late fees and marks overdue; dunning reminders go at +3/+7/+14 days.
- **Q: Is the deposit my income?** No — it's held money (liability). It's refunded or deducted (with evidence) at move-out.
- **Q: How do I read the ledger?** Open **Finance → Ledger**: journal (chronological entries) and trial balance. Every entry balances debits = credits (Part 5).
- **Q: How do I see profit?** **Profit & Loss** report (or Expenses & P&L): revenue − expenses − owner payout = net.

**Reports**
- **Q: Who can see financial reports?** Reports need M26. Finance/admin see financial reports; property managers get operational reports for their properties; owners see their own statement history.
- **Q: Is there a balance sheet?** There's no dedicated balance-sheet screen; use **Ledger → Trial balance** (assets 1100–1300, liabilities 2100–2300, equity 3900). See Part 5.6.
- **Q: How do I export a report?** Use the **CSV** or **PDF** export buttons on each report (filters by date + property).

**Notifications / Telegram**
- **Q: How do I connect Telegram?** Get a one-time code in the app/portal, message the bot `/link <code>`, then enable your notification toggles (Part 7.2).
- **Q: Will I get email receipts?** Not in the current build — automated messages go via Telegram; in-app badges/dashboard also show dues.
- **Q: What can members do in the bot?** `/status` (their lease), `/dues` (balance), `/pay` (get a payment QR), `/help`. They only ever see their own data.

**Admin**
- **Q: How do I add a new user?** Admin → Users → New user (email + temporary password, forced change on first login), then assign role(s) and properties (Part 8.2).
- **Q: How do I change permissions?** Admin → Roles & Permissions → tick the module × action × scope grid. Changes are audited; don't give more than needed (Part 8.3).
- **Q: Can I delete the Super Admin role?** No — it's protected so a full-access account always exists. Roles in use can't be deleted.
- **Q: How do I turn a module off?** Settings → Features (feature flags). It hides the module/gates access without deleting data.
- **Q: Where do I set currency / late fees / dunning?** Settings → Locale (currency) and Settings → Billing / Late fee. These apply forward only.
