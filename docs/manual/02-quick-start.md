# Part 2 — Quick Start Guide

> **"I am a new user. What should I do?"**
> This one-page guide gets a brand-new employee productive on day one. You do
> not need any accounting or software background. Just follow the ten steps.

## Your first 10 things to learn

### 1. Sign in
Open the system in a browser. On the **login page**, enter your work email and
password (your administrator gives these). If your password was set by an
admin, you will be asked to **change it on first sign-in**. If your role
requires it, you will also set up **two-factor authentication (2FA)** with an
authenticator app (see Part 9).
- Pick your language (English / ខ្មែរ Khmer / 中文 Chinese) from the 🌐 picker on
  the login screen or the top bar.

### 2. Look at the Dashboard
After login you land on the **Dashboard**. It answers the morning's questions at
a glance: how full the property is, how much was billed and collected this
month, how much is owed (**arrears**), cash in hand, open maintenance tickets,
and a **Rent dues** card showing what is due soon and what is overdue.
👉 *Try it:* log in as `staff@demo.test` and read each card out loud.

### 3. Understand the menu
The left sidebar groups the work:
- **Overview** → Dashboard
- **Portfolio** → Properties, Members, Owners, Leases
- **Billing** → Rent Engine, Invoices, Payments, Deposits, Utilities, Services
- **Finance** → Ledger, Expenses & P&L, Owner Statements
- **Operations** → Room Moves, Inspections, Maintenance, Complaints, Short Stays, Attendance
- **Store** → POS, POS Catalog, Stock, Purchase Orders
- **Comms** → Tenant Portal, Telegram Bot
- **Insights** → Reports
- **Admin** → Users, Roles, Audit Log, Settings, Security *(admins only)*

If you cannot see a menu item, your role does not have permission for it — that
is normal and by design.

### 4. Follow the guided tour
Click the **Help (?)** button in the top bar to play a scripted highlight tour
of the screen. Each module also has a short "what it does + tips" note in the
help dialog.

### 5. Learn the one golden rule
**Posted money is never deleted.** You correct mistakes with the proper reversal
tool (credit note for invoices, void for expenses, refund for payments). Never
try to "fix" a posted figure by editing it — the system won't let you, and that
protects everyone.

### 6. Learn the status words
- **Rooms:** vacant → reserved → occupied → cleaning → maintenance → vacant.
- **Members:** prospect → verified → active → notice → moved_out.
- **Leases:** draft → active → notice → terminated/completed.
- **Invoices:** draft → issued → partial_paid → paid → overdue (or void).
- **Payments:** pending → confirmed (or failed / refunded).

### 7. Do the core daily loop
The heart of the job: **check dashboard → look at rent dues → collect/record
payments → issue receipts → raise or update tickets.** Most days are this loop.

### 8. Learn how billing happens
Rent is **not** typed by hand each month. The system generates invoices from
each active lease (rent + services + utilities). An authorised person triggers
**invoice generation** (or the scheduled job does it). You then collect against
those invoices. (Details in Parts 3 & 5.)

### 9. Know what you are allowed to do
Your role decides it. If a button is missing or you get a **403 FORBIDDEN**
message, you don't have that permission — ask your manager, don't try to work
around it.

### 10. Know where to get help
- In-app: the **Help (?)** tour and module tips.
- This manual: **Part 10 (Troubleshooting)** and **Part 11 (FAQ)** for common problems.
- Access problems: contact an administrator (Part 8).
- Money discrepancies: contact an Accountant / Admin and use the **Audit log**.

## The 30-second mental model

```
A room holds a member on a lease.
The lease makes invoices every month.
Invoices get paid; payments make receipts and ledger entries.
Costs are expenses. Revenue − costs = profit (P&L).
Owners get a monthly statement and payout.
```

## Daily / weekly / monthly rhythm

| When | What you do |
|---|---|
| **Daily** | Check dashboard & rent dues; record payments & issue receipts; process POS sales; handle new tickets/complaints; clock in/out (attendance) |
| **Weekly** | Chase overdue invoices (dunning); follow up open maintenance; check low-stock alerts; complete inspections due |
| **Monthly** | Enter utility meter readings; run invoice generation; reconcile payments; record expenses; review P&L; generate owner statements; run reports |

> ✅ When you can describe out loud how a lease becomes an invoice, an invoice
> becomes a payment, and a payment appears on the P&L — you know the system.
> That flow is drawn in **Part 1, §1.4** and taught step-by-step in **Part 13
> (Golden Path)**.
