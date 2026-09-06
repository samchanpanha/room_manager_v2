# Part 3 — User Guide (Daily Operations)

This part explains every module staff use day to day, in the format:
**Purpose → Who uses it → Before you start → Step-by-step → Fields → Actions →
Result → Common mistakes → Best practice.**

Module codes in brackets (e.g. **[M04]**) are the permission codes you'll see
on the Roles screen.

---

## Table of contents
1. [Authentication & login](#1-authentication--login)
2. [Dashboard](#2-dashboard)
3. [Properties & Rooms (M04)](#3-properties--rooms-m04)
4. [Members (M02) & Documents (M17)](#4-members-m02--documents-m17)
5. [Owners (M03)](#5-owners-m03)
6. [Leases & Contracts (M05)](#6-leases--contracts-m05)
7. [Rent Engine (M06)](#7-rent-engine-m06)
8. [Services (M12)](#8-services-m12)
9. [Utilities & Meters (M11)](#9-utilities--meters-m11)
10. [Invoices & Monthly Billing (M07)](#10-invoices--monthly-billing-m07)
11. [Payments & Receipts (M09)](#11-payments--receipts-m09)
12. [QR Payments (M13) & the public /pay page](#12-qr-payments-m13--the-public-pay-page)
13. [Deposits (M10)](#13-deposits-m10)
14. [Room Moves (M16)](#14-room-moves-m16)
15. [Inspections (M18)](#15-inspections-m18)
16. [Maintenance (M19)](#16-maintenance-m19)
17. [Complaints (M22)](#17-complaints-m22)
18. [POS (M14)](#18-pos-m14)
19. [Stock & Purchase Orders (M15, M29)](#19-stock--purchase-orders-m15-m29)
20. [Attendance (M23)](#20-attendance-m23)
21. [Short Stays / hotel-style bookings (M32)](#21-short-stays--hotel-style-bookings-m32)

---

## 1. Authentication & login

### Purpose
Let the right people in, keep everyone else out, and keep a record of who did
what. Staff sign in with **email + password** (and a 2FA code for Admin+).
Members sign in to the tenant portal with a **one-time password (OTP)**.

### Who uses it
Everyone with an account.

### How login works
1. Open the login page and enter your **email** and **password**.
2. If your account has **2FA enabled** (mandatory for Admin and Super Admin),
   enter the current 6-digit code from your authenticator app.
3. Click **Sign in**. A session cookie keeps you signed in.
4. First-time sign-in with an admin-set password → you are **forced to change
   your password** before you can do anything else. After changing it, your other
   sessions are revoked.

> ⚠️ **2FA gate for Admin+:** an Admin/Super Admin must finish 2FA enrollment
> before any other module permission works. Until then you can only enroll.

### Logout, sessions & devices
- Use **Sign out** (top of the menu / My Account).
- **My Account →** shows your **sessions & devices** with device/IP info; you can
  **revoke** any session. Sessions last a fixed number of days (env
  `SESSION_TTL_DAYS`) and then expire automatically.
- Change your own password any time at **My Account → Password**. Changing it
  revokes other sessions so the new password is in force everywhere.

### Login security
- Login is **rate-limited** (10 attempts per minute per IP). Repeated failures
  are throttled — wait and retry, or contact an admin.
- Member portal OTP codes are **single-use**, stored hashed, and **lock after 5
  attempts** — then you must request a new code.

### When you cannot log in
| Symptom | What to do |
|---|---|
| "Invalid email or password" | Re-check spelling; passwords are case-sensitive |
| Asked for a 2FA code you don't have | Contact a Super Admin to **reset your 2FA** (`M27` admin reset), then re-enroll |
| "Account disabled" | Your account was disabled by an admin — contact them |
| Forced password change | Set a new password (this is normal for new accounts) |
| Locked out after many tries | Wait, or ask an admin to reset the password |
| Member OTP "Too many attempts" | Request a fresh OTP code |

> 🚫 **Not confirmed in the current system:** self-service "forgot password"
> email reset link. Passwords are reset by an administrator (who sets a new
> temporary password with the must-change flag) or changed while signed in.
> There is no email channel in the current build (see Part 7).

---

## 2. Dashboard

### Purpose
Your morning briefing and launch pad: occupancy, money, alerts and quick links.

### Who uses it
All roles (numbers are automatically limited to what your role/property can see).

### What each indicator means
| Indicator | Meaning |
|---|---|
| **Occupancy %** | Rooms occupied ÷ total rooms (e.g. `80%` = 8 of 10 rooms occupied) |
| **Properties** | Number of properties, with buildings count |
| **Rooms / Beds** | Total rooms and beds in the inventory |
| **Monthly book value** | Sum of all room base prices (a portfolio reference figure) |
| **Users / Members** | Counts of staff users and members (prospects + residents) |
| **Collected vs billed (month)** | Confirmed payments received vs invoices issued this month |
| **Arrears** | Total still owed on open invoices (issued/partial/overdue) |
| **Cash position** | Ledger balance of the Cash (1100) + Bank (1200) accounts |
| **Open tickets** | Maintenance tickets still open/assigned/in progress |
| **Rent dues (M33) card** | Invoices **due soon** (within the configured "ahead days") and **overdue**, with member, invoice code and amount |
| **Recent activity** | Latest audit entries (who did what) |
| **Quick launch** | One-click tiles to every module your role can open |

### Best practice
Start every day by scanning **Rent dues** and **Arrears**, then work the overdue
list. The dues card links straight to the **Overdue & not paid** report.

---

## 3. Properties & Rooms (M04)

### Purpose
Define the physical inventory: **Property → Building → Floor → Room → Bed**.
Everything else (leases, invoices, tickets) hangs off rooms.

### Who uses it
Admin/Property Manager create and edit; Staff read; Owners read their own buildings.

### Before you start
You need `M04` access and (for property-scoped roles) assignment to the property.

### Step-by-step — create the hierarchy
1. **Portfolio → Properties → New property.** Enter a unique **code** and name, address, optional map coordinates/geofence.
2. Open the property and **add a building** (e.g. "Building A"). A building can be linked to an **owner**.
3. **Add a floor** (name + level number).
4. **Add rooms** one by one, or use the **bulk room creation wizard** (prefix, start number, count, beds per room, type, base price).
5. On each room set: **number, type (STANDARD/DELUXE/STUDIO/SUITE), base price, capacity, notes**.
6. Add **beds** if you let rooms by the bed (co-living).

### Room status machine (enforced by the system)
```
vacant → reserved → occupied → cleaning → maintenance → vacant
```
- **Draft leases** mark a room *reserved*. **Activating** a lease makes it *occupied*.
- **Ending** a lease sends it to *cleaning*; you then return it to *vacant* (or *maintenance*).
- Setting a room to **maintenance** requires a reason. Invalid transitions are rejected (`422`), and every transition is audited.

### Field explanation (room)
| Field | Meaning | Required? | Example |
|---|---|---|---|
| Number | Room label, unique on the floor | ✔ | `A-101` |
| Type | Pricing/amenity category | ✔ | `STUDIO` |
| Base price | Standard monthly rent (minor units) | ✔ | `300.00` |
| Capacity / beds | How many can occupy | ✔ | `1` |
| Status | Current state (see machine) | system | `vacant` |
| Notes | Free text | ✖ | "Near elevator" |

### Actions
Create, edit, view, search/filter, **bulk create rooms**, **change room status**
(with reason), archive (soft delete). A property/room can only be **archived if
it has no lease history** — otherwise it stays for the records.

### Result
Rooms appear on the live room grid (colour-coded by status) and occupancy stats
update on the dashboard and reports.

### Common mistakes
- Trying to delete a room that has history → use **archive** (and only when allowed).
- Forgetting to return a room from *cleaning* to *vacant* → it can't be re-let.
- Setting a price on the room but a different price on the lease — the **lease price is what is billed**.

> ✅ **Best practice:** standardise room codes (`Building-Floor-Room`) and use the
> bulk wizard for new floors. Keep base prices current; they feed reports and
> short-stay quotes.

---

## 4. Members (M02) & Documents (M17)

### Purpose
Keep the complete record of every tenant/resident — identity, contacts, KYC
documents, stay history, balance and notes.

### Who uses it
Staff/Managers create and update; Accountant reads; Owners read (own buildings); Members see only their own.

### Member lifecycle (enforced server-side)
```
prospect → verified → active → notice → moved_out
        (blacklisted flag can block everything)
```
- **prospect → verified** requires a **complete KYC checklist** (all required
  document types uploaded, unexpired).
- **verified → active** happens automatically when a lease is **activated**.
- **notice** = member has given move-out notice; **moved_out** = lease ended.
- **Blacklist:** a member can be flagged blacklisted (**reason mandatory**,
  audited). Blacklist blocks all lifecycle moves *and* any new lease. Remove via
  the un-blacklist action (also audited).

### Step-by-step — onboarding wizard (4 steps)
1. **Portfolio → Members → New member.**
2. **Personal:** name, type (person/company), email, phone.
3. **Property & emergency contacts:** assign property; add emergency contact(s).
4. **KYC uploads:** upload ID/passport and other required document types, set expiry dates.
5. **Review** and save. The member is a *prospect* until KYC is complete → then *verified*.

### The member profile tabs
- **Profile** — personal & contact details, status, blacklist flag.
- **Lease** — current/past leases and room.
- **Ledger / Statement** — running receivable balance and invoice/payment history.
- **Documents** — KYC files, generated PDFs, expiry badges.
- **Activity** — timeline (status changes, moves, payments).

A member with unpaid invoices shows a **dues badge** (e.g. "$265.00 due").

### Documents (M17)
- **Upload** a document, choose its **type**, link it to the member (or
  lease/room/owner/contract), and set an **expiry date**.
- Files are stored **privately**; downloads go through a **signed URL valid 120
  seconds** — you cannot open a file just by guessing its link.
- **Expiry reminders** fire at 30 and 7 days (via Telegram events).
- Generated PDFs (invoices, receipts, contracts, statements, inspection reports)
  are **auto-filed** into the registry.
- Access is permission- and property-checked: staff of another property get a
  denial; members/owners only see their own.

### Actions
Create, edit, view, search/filter (status, property, owing), upload/replace
documents, download (signed), set status, blacklist/unblacklist, view statement/QR.

### Common mistakes
- Marking a member verified before KYC is complete (the system blocks it).
- Letting an ID expire without re-uploading — the badge warns 20/7 days out.
- Blacklisting without a reason (blocked) — always record why.

> ✅ **Best practice:** complete KYC at onboarding; upload a new ID before the old
> one expires; always check the dues badge before agreeing to anything financial.

---

## 5. Owners (M03)

### Purpose
Record landlords, their buildings and how they get paid.

### Who uses it
Admin/Manager manage; Accountant reads; **the Owner role sees only their own records** (read-only).

### Step-by-step
1. **Portfolio → Owners → New owner** (name, email, phone).
2. Add a **payout method** — bank transfer, mobile money or cash; one is marked
   **primary**; account numbers are stored masked.
3. Create the owner's **portal login** (Owner role, linked to their party) so they
   can sign in; password reset is available for them.
4. **Assign a building** to the owner. Each building links to exactly **one**
   owner — assigning to an owner who already has it / conflicts returns `409`.
5. Formalise terms with an **Owner Contract** (see Leases).

### Owner portal (`/owners/portal`)
Shows **your buildings**, occupancy, payout details and recent documents, plus
owner statements. Owners **cannot change data** (read-only) and cannot see other
owners' properties — cross-owner reads return `403`.

### Common mistakes
- Trying to assign a building that already has an active owner contract.
- Expecting owners to edit records — they are intentionally read-only.

---

## 6. Leases & Contracts (M05)

### Purpose
The occupancy agreement between a member and a room/bed (**member lease**), and
the management agreement with a landlord (**owner contract**).

### Who uses it
Managers/Admin create and operate; Accountant reads; Staff read; Members/Owners see their own.

### Member lease — lifecycle
```
draft → active → notice → terminated | completed
```
- **draft** reserves the room (room → *reserved*).
- **active** flips room → *occupied*, member → *active*, and **schedules the first invoice**; the **deposit is billed** (installment invoices).
- **notice** = move-out notice given.
- **terminated / completed** flips room → *cleaning*, member → *moved_out*, and triggers the **deposit settlement** flow.

### Where to find it
Leases are reached at the **`/leases`** pages (list, **`/leases/new`**, and
**`/leases/[id]`**), typically opened from a member's profile or the relevant
record (the sidebar "Leases" label is present but the list is opened from those
contexts). Owners' management agreements live under **Owners → Owner contracts**
(**`/owner-contracts`**).

### Step-by-step — create a member lease
1. Open **Leases → New** (**`/leases/new`**), or start from a member/room.
2. Select the **member** and the **room/bed**.
3. Set **start / end dates**, **rent amount**, **cycle day** (day of month billed),
   **proration basis** (calendar = real month length, or 30-day).
4. Set **deposit terms** (total + number of installments).
5. Set **notice days**, **auto-renew** and any **escalation** rule.
6. **Add services** (WiFi, parking, laundry — see Services).
7. Save as **draft**, review, then **Activate**.
8. A **contract PDF** is generated server-side and auto-filed to documents.

### Occupancy rules (enforced & tested)
- **One active lease per bed.** Capacity cannot be exceeded.
- Whole-room vs per-bed leases are supported; co-living free-bed moves are allowed.
- Mid-month start/end is **prorated** automatically.
- **Ending a lease requires clearance** — dues must be zero (or written off with
  approval) — and a **completed move-out inspection** is the hard gate before ending.

### Modifying a lease safely
- While **draft**, edit freely.
- Once **active**, you don't rewrite history: use the supported transitions
  (notice → terminate/complete), a **renewal**, or a **room move** (Part 3.14).
  Rent terms are **snapshotted** on the lease so old invoices never change.

### Owner contracts
- Fields: owner, building, **model = FIXED_RENT** (monthly master rent) **or
  REVENUE_SHARE** (owner %, 1–100) plus a **management fee %**, term dates,
  **payout cycle day** (1–28).
- Numbered `OWC-…`. One open contract per building.
- **Activation is the authoritative ownership source** — it syncs
  `Building.ownerId`. Lifecycle: `draft → active → terminated | expired`.

### Actions
Create, edit (draft), view, **activate**, **complete**, **terminate** (with
reason), give **notice**, add/manage services, generate/download contract PDF.

### Common mistakes
- Activating a lease before the room is vacant/the member is verified.
- Ending a lease with money still owed or no move-out inspection (blocked).
- Creating two leases on the same bed (blocked).

> ✅ **Best practice:** always activate only after KYC + deposit terms are set;
> let the system prorate — don't hand-calculate partial months.

---

## 7. Rent Engine (M06)

### Purpose
The billing rulebook that turns leases into invoice line items. It is a set of
**pure, tested rules** — no money moves here; it only computes what *should* be billed.

### Who uses it
**Accountant** owns it (manage); Admin manages; Managers/Staff read.

### What you configure
- **Rent plans** — amount, cycle day, proration basis (calendar / 30-day).
- **Late fee rules** — grace days, then a **flat** fee or a **% of outstanding**
  (with a floor and a cap; never exceeds the amount due).
- **Tax rules** — tax rates that appear on invoices.
- **Discount rules** — discounts applied to lines.

### How billing math works
- Proration uses the exact factor shown on the line (e.g. **"17/31"** for 17 days
  of a 31-day month on calendar basis). Cycle day is clamped to days 1–28 so
  February is safe.
- Monthly totals always satisfy: **total = Σ lines − discount + tax** (asserted
  by the engine and locked by tests).
- Services prorate together with rent; mid-month suspension prorates the stop.

> See **Part 5** for worked numeric examples.

---

## 8. Services (M12)

### Purpose
Billable add-ons beyond rent: **WiFi, parking, laundry, general services**.

### Who uses it
Managers/Admin manage the catalog and assignments; Staff assign/use; Members see their own.

### Pricing models
- **Fixed monthly** — rides the rent engine and appears every month; prorates on
  mid-month start/suspend.
- **Per-use** — e.g. laundry by kg, visitor parking — becomes a **one-time invoice line**.
- **Metered** services can link to utility usage.

### Step-by-step
1. **Billing → Services →** define a catalog item (name, model, price, optional image).
2. **Assign** a service to a lease (start/end dates). Parking assigns a **specific
   slot uniquely**; WiFi creates an **account** that activates/suspends with the lease.
3. Fixed services flow into monthly invoices automatically; log **per-use usage**
   to create one-time lines.
4. **Suspend** a service (e.g. parking given up) — mid-month suspension prorates.

### Result
Assigned fixed services appear as `service` lines on the next generated invoice
(→ revenue account **4100 Service Revenue**); per-use entries appear as
`one_time` lines (→ **4900**).

### Common mistakes
- Assigning the same parking slot to two leases (blocked — slots are unique).
- Forgetting to suspend a service when a member leaves it — they keep being billed.

---

## 9. Utilities & Meters (M11)

### Purpose
Meter-based charges for **electricity, water and gas**.

### Who uses it
Staff/Managers enter readings; Accountant reads; Members see their own.

### Step-by-step
1. Create a **meter** for a room/building (type elec/water/gas; readings in exact
   milli-units).
2. Define a **tariff** — a unit rate, optionally **tiered** (different rates per consumption band).
3. Each period, enter a **reading**:
   - **Manual** — type the meter reading.
   - **Estimated** — system uses the average of the last 3 readings (flagged as estimated).
   - **CSV import** — bulk import readings.
4. The system computes **charge = (new reading − previous) × tariff** (tiered where applicable).
5. Charges **attach automatically to the next invoice cycle**.

### Safety features
- A reading **more than 2× the average** is flagged as an **anomaly** (possible mis-read).
- Per-meter **SVG consumption history** chart.

### Result
Utility charges appear as `utility` lines on the next invoice (→ **4200 Utility
Revenue**). Nothing is billed until the next generation run.

### Common mistakes
- Entering a reading lower than the previous one (negative usage) — re-check.
- Skipping readings (the system can estimate, but real readings are better).
- Forgetting to import before monthly billing — then charges land a month late.

> ✅ **Best practice:** enter readings on a fixed day each month *before* running
> invoice generation; investigate any spike flag before billing.

---

## 10. Invoices & Monthly Billing (M07)

### Purpose
The monthly bill each member receives: rent + services + utilities + one-time
charges − discounts + tax (+ late fees once overdue).

### Who uses it
Accountant/Manager generate and manage; Staff read; Members/Owners see their own.

### Invoice lifecycle
```
draft → issued → partial_paid → paid
              ↘ overdue            (any of these may be) → void
```
- **draft** — created, not yet sent.
- **issued** — sent/visible to the member; number assigned; **immutable**.
- **partial_paid / paid** — set automatically as payments land.
- **overdue** — set by the daily job after the due date + grace.
- **void** — Super-Admin only, **reason mandatory**, audited.

### How monthly charges are generated
```
 Rent (prorated if mid-month)
 + Services (fixed monthly, prorated)
 + Utility charges (from meter readings)
 + One-time charges (per-use services, POS room charges, moves)
 − Discounts
 + Tax
 + Late fees (after grace, by the daily job)
 = Total due
```

### Step-by-step — generate the month's invoices
1. Ensure meter readings and per-use entries are in.
2. Go to **Billing → Invoices** and click **Generate** (the invoice-generation
   job), or the scheduled job runs it.
3. The run bills **every active lease with a pending period**:
   - **Catch-up safe** — a mid-month move-in first gets a prorated stub invoice.
   - **Idempotent** — there is only ever **one live invoice per lease & period**
     (running it twice doesn't duplicate).
   - **Gapless numbering** per property-year: `BLR-2026-0001` (voided numbers
     are **never reused**).
4. Each invoice gets a **PDF auto-filed** to the document registry.
5. **Issue** invoices (draft → issued) to send them (members see them in the
   portal and get a Telegram "invoice issued" message).

### On an invoice you can
- View **items**, **credit notes**, the **timeline** and totals.
- Download the **PDF**, show the **QR** for payment.
- **Issue** a draft.
- Add a **credit note** (≤ amount due; auto-settles at zero) to correct an issued invoice.
- **Void** (Super Admin, reason required).

### Corrections — never edit an issued invoice
- **Credit note** for reductions/errors (issued invoices are immutable).
- **Late fees** are added by the daily job once the grace window passes; **dunning
  reminders** go out at +3 / +7 / +14 days (configurable).

### Worked example
| Line | Amount |
|---|---|
| Rent (month) | 300.00 |
| WiFi service | 15.00 |
| Electricity (metered) | 32.50 |
| One-time (visitor parking) | 5.00 |
| **Subtotal** | **352.50** |
| Discount (−) | −2.50 |
| Tax (+) | 0.00 |
| Late fee (once overdue) | 0.00 |
| **Total due** | **350.00** |

Member pays 200.00 → invoice becomes **partial_paid**, **amount due = 150.00**.
Paying the rest flips it to **paid**.

### Common mistakes
- Running generation before meter readings are in → utilities miss the cycle.
- Trying to edit/delete an issued invoice — use a **credit note**.
- Expecting voided invoice numbers to be reused (they never are — gapless by design).

> ✅ **Best practice:** one monthly rhythm — readings first, generate, verify a
> sample, issue, then let reminders/late fees run automatically.

---

## 11. Payments & Receipts (M09)

### Purpose
Record money collected against invoices and issue receipts.

### Who uses it
Accountant/Manager manage; **Staff/cashier record payments (operational write)**;
Members make their own in the portal; Owners read their buildings'.

### Payment lifecycle
```
pending → confirmed → refunded
        ↘ failed
```

### Step-by-step — receive a payment
1. **Billing → Payments → New payment** (or from an invoice/member).
2. Select the **member**; the system lists their open invoices.
3. Enter the **payment amount** and choose the **method**:
   **cash · bank_transfer · qr · card · cheque**.
4. Save. A cash/bank payment is **confirmed** directly; QR/gateway payments start
   **pending** and confirm via webhook.
5. On confirm:
   - Money is **allocated to invoices oldest-first** (due date, then period).
   - The invoice flips to **partial_paid** or **paid**.
   - A **numbered receipt** `RCP-2026-0001` PDF is generated and auto-filed.
   - **Balanced ledger entries** post.
   - A **Telegram receipt** message can be sent to the member.

### Payment situations
| Situation | What happens |
|---|---|
| **Partial payment** | Allocated oldest-first; invoice = partial_paid; remainder still due |
| **Full payment** | Invoice = paid |
| **Advance / overpayment** | Allocations must equal the payment; anything left over stays as **member credit** (refundable by an Accountant via a ledger-reversed payout) |
| **Refund** | Requires **Accountant+ approval**; reverses through the ledger |
| **Failed gateway payment** | Marked failed; no receipt/ledger impact |
| **Duplicate gateway webhook** | Ignored via idempotency keys — never double-posted, never double-receipted |

### Field explanation
| Field | Meaning | Required? |
|---|---|---|
| Member | Who is paying | ✔ |
| Amount | Total received (minor units) | ✔ |
| Method | cash / bank_transfer / qr / card / cheque | ✔ |
| Allocation | Which invoices it covers (defaults oldest-first) | system/adjusted |
| Gateway ref | External payment reference (QR/card) | for gateway |

### Actions
Create/record payment, **confirm**, **fail**, **refund** (approve), view,
download **receipt PDF**, search/filter.

### Common mistakes
- Recording a payment against the wrong member — always confirm identity & invoice.
- Trying to delete a confirmed payment — use **refund** (reverses ledger).
- Expecting overpayments to be "lost" — they become **member credit**.

> ✅ **Best practice:** issue the receipt to the member immediately; reconcile
> cash at session/end of day; let oldest-first allocation run unless there's a
> reason to target a specific invoice.

---

## 12. QR Payments (M13) & the public /pay page

### Purpose
Frictionless "pay by QR" for members, including payment without logging in.

### How it works
- On every open invoice (and in the tenant portal) a **Pay by QR** button mints a
  **pending payment** and shows a QR code. A **deterministic idempotency key**
  means the same invoice always produces a stable QR.
- The QR works with the configured provider adapter (the development system uses
  a **DevMock**; real deployments plug in UPI / PromptPay / QRIS / a gateway link).
- Confirmation arrives via a **signed webhook** (`x-webhook-secret` + unique
  gateway refs), with polling as a fallback. Duplicate webhooks confirm **exactly once**.
- **Member QR codes** are HMAC-signed and open the public **`/pay`** page —
  **rate-limited, exact-due-only, no login required** — and are printed on invoice
  PDFs. A static poster QR allows lookup by member/room.

### Who uses it
Members pay; Staff/Accountant can show/verify; the gateway confirms.

> 🚫 There is no separate admin QR menu — QR lives on invoices and `/pay`.

---

## 13. Deposits (M10)

### Purpose
Manage **security deposits** correctly: they are held money (a liability), **not revenue**.

### Who uses it
Accountant/Manager manage; Staff read; Members see their own deposit status.

### Deposit lifecycle (append-only, forward-only)
```
billed → held → settled (refunded and/or deducted)
```

### How it works
- When a lease activates, the deposit is **billed automatically** as
  `deposit`-kind **installment invoices** (e.g. total 600 in 2 installments).
- You collect it via the **normal payments flow**; oldest-first allocation picks
  the deposit invoice first.
- Collected deposits sit in the **2100 Deposit Liability** account — *never* revenue.
- At **move-out** you settle:
  - **Deduct** for damage/cleaning (requires **mandatory evidence documents** +
    reason code). Damage/cleaning deductions become **other income**; unpaid-rent
    deductions **clear the receivable**.
  - **Refund** the remainder — refunds need **Accountant approval** and use the
    stored payout method; they reverse through the ledger.
- For a closed lease the liability account must **net to zero** (every deposit
  either refunded or deducted).

### Actions
View deposits, record/deduct (with evidence), **refund** (approve), view
transactions/history.

### Deposits vs rent payments
| | Rent payment | Deposit |
|---|---|---|
| What it is | Revenue for the month | Money you **hold** and may return |
| Ledger account | Revenue (4xxx) | Liability (2100) |
| Refundable? | No (it's earned) | Yes (minus approved deductions) |

### Common mistakes
- Treating a deposit as income — it is a liability until settled.
- Deducting without evidence/reason (blocked).
- Closing a lease with deposit liability still showing (it must net to zero).

---

## 14. Room Moves (M16)

### Purpose
Move a resident from one room to another mid-lease and re-price correctly.

### Who uses it
Managers/Staff create; **approval** required; Members can *request* from the portal.

### Workflow
```
request (portal or staff) → approve → execute
```
1. **Request** a move: choose the target room and **effective date**.
2. The system **previews** the money: prorated new rent + a **move fee** − credit
   for unused old rent = one **adjustment invoice** (exact prorated delta); plus
   any deposit delta. Billing catch-up runs first so credits are real billed money.
3. **Approve**, then **Execute**:
   - The old lease terminates; a new lease starts.
   - **Both room statuses flip** (old → cleaning, new → occupied).
   - The **deposit row follows the member**.
   - One adjustment invoice carries the net delta.
   - Full move history appears on the member timeline.
4. Optional move-out / move-in **inspections** can be linked.
5. A request can be **cancelled** before execution.

### Common mistakes
- Choosing an effective date in the past without expecting catch-up billing.
- Forgetting the old room goes to *cleaning* (not straight to vacant).

---

## 15. Inspections (M18)

### Purpose
Structured room-condition checks: **move-in, move-out and periodic**.

### Who uses it
Staff/Managers perform; Members see their own; Owners read.

### Step-by-step
1. Pick an **inspection template** (sections/items per room type).
2. Create an inspection for a room (type = move_in / move_out / periodic).
3. For each item mark **pass / fail / NA**, add a **photo** and note; the system
   computes a **score**.
4. Record **findings** for failures. A **move-out** finding can:
   - **open a maintenance ticket**, or
   - **propose a deposit deduction** (approved in Deposits, M10).
5. Complete it — a **PDF report** is auto-filed to documents.

### Key rule
A **completed move-out inspection is the hard gate** for ending a lease. You
cannot complete move-out without it.

---

## 16. Maintenance (M19)

### Purpose
Track repairs from report to verified close, with costs and parts.

### Ticket lifecycle
```
open → assigned → in_progress → resolved → verified/closed
```
**SLA targets by priority** (urgent 4h … low 168h). A daily **breach sweep** flags
overdue tickets; escalation notifications go via Telegram.

### Step-by-step
1. A ticket is raised (member via portal/Telegram, or staff): category, priority,
   room/building, reported-by.
2. **Assign** a technician or vendor.
3. Work it (**in_progress**); log **labour** costs and **consume stock parts**
   (M15) — part cost flows onto the ticket automatically.
4. **Resolve**, then **verify/close**. Costs are routed either to an **expense**
   (M20) or to the **owner's P&L** (owner-borne → M24 statement).

### Actions
Create, assign, update status, consume part, add cost, resolve, verify/close, view.

> ✅ Members rate resolution where applicable (via complaints). Keep an eye on the
> dashboard **Open tickets** count and SLA breaches.

---

## 17. Complaints (M22)

### Purpose
Handle member grievances with a clear paper trail.

### Lifecycle
```
new → acknowledged → in_progress → resolved → closed
```
- Comments thread, photos, priority with **SLA**.
- **One-click conversion** to a maintenance ticket if it's a repair.
- The member **confirms resolution and rates 1–5**.
- Owners can raise/comment on their own tickets.

### Common mistakes
- Leaving a complaint at "new" past SLA — acknowledge quickly; breaches are swept daily.

---

## 18. POS (M14)

### Purpose
A front-desk / canteen / store till: sell products, print receipts, take cash/QR/card,
and charge purchases to a resident's room.

### Who uses it
Staff/cashiers operate (operational write); Managers manage products; Accountant reads.

### Register session workflow
```
open session (opening float) → sales… → close session (count cash → variance)
```
1. **Open a POS session** with your opening cash float.
2. Add products to a sale (scan **barcode/EAN-13** badge, or pick from catalog).
3. Take payment: **cash / QR / card**, or **charge to room**:
   - **Charge-to-room** auto-issues a **one-time invoice** to the member and posts
     to receivables.
4. A **receipt PDF** is auto-filed; thermal printing settings (58/80 mm,
   auto-print, copies) live in **Settings → Printers**.
5. Sales **decrement linked stock items** (M15).
6. **Close the session**: expected cash = float + Σ cash sales; enter counted
   cash; the system records the **variance**.

### Products (POS Catalog)
Products link to stock items, have images and printed **barcode labels**.

### Common mistakes
- Selling without an open session.
- Forgetting to close the session (cash variance not recorded).
- Charging to room for a guest with no lease — charge-to-room needs a member.

---

## 19. Stock & Purchase Orders (M15, M29)

### Purpose
Inventory control with **moving-average cost** and an **append-only movement log**.

### Who uses it
Staff/Managers do operational stock work; Accountant reads valuation; POs need M29 access.

### Golden rule
**You never type a quantity directly.** On-hand changes only through **movements**:
`purchase · sale · consumption · maintenance_use · adjustment · transfer`.

### Stock items & categories
- Items belong to a **category**, have a **unit** (units list configurable in
  Settings), a **low-stock threshold**, and a moving-average cost.
- Suppliers are recorded; purchases can be receipted via **Purchase Orders**.

### Purchase Orders (M29)
1. Create a PO to a supplier (lines = items + quantities).
2. **Place** it (bookkeeping only — stock doesn't change yet).
3. **Receive** items — receiving creates purchase movements and **changes on-hand**;
   **partial receipts** keep the PO placed until everything arrives.

### Other movements
- **Sale** (via POS), **consumption** (internal), **maintenance_use** (parts on a
  ticket), **transfer** between locations, **adjustment** (via stocktake).
- **Stocktakes:** count actual vs system; variance posts an **adjustment** with a
  valuation delta.
- **Low-stock alerts** fire (and can reach staff via Telegram).
- **Valuation report** gives on-hand value (moving-average).

### Worked quantity example
Purchase 10 → sell 3 via POS → consume 1 on a ticket → **on-hand = 6**, and the
valuation report reflects the moving-average cost of the 6.

### Common mistakes
- Trying to edit quantities directly (not allowed — use a movement/stocktake).
- Marking a PO received when it's only placed (placement changes nothing).

---

## 20. Attendance (M23)

### Purpose
Staff time tracking for payroll and operations.

### Who uses it
**Staff clock their own in/out** (OWN scope); Managers review; Accountant reads summaries.

### How clocking works
- **Kiosk PIN** clock in/out at a shared terminal (PIN stored hashed) — no browser session needed.
- **Mobile** clock in/out, optionally with a property **geofence**; punches outside the radius create an **exception**.
- **Shifts** define schedules with **grace windows** and **overtime rules** (simple multipliers).

### Exceptions (derived automatically)
late · early departure · missed clock-out · overtime · geofence violation.
A daily **attendance-sweep** flags stale open punches as missed clock-outs.
Managers **resolve** exceptions with a reason; corrections are **audited**.

### Outputs
- Monthly **per-staff summary**.
- **CSV payroll export**.

### Common mistakes
- Forgetting to clock out (the sweep flags it; a manager resolves it).
- Clocking in far from the property without reason (geofence exception).

---

## 21. Short Stays / hotel-style bookings (M32)

### Purpose
Rent rooms by the **hour or day** to guests (hotel-style), alongside long-term leases.

### Who uses it
Managers/Staff create bookings (operational); Accountant reads.

### Concepts
- **Rent modules** define a product: e.g. "hourly", with a billing strategy
  (**progressive** bucket table, or **blended** = bucket + full-day carry),
  min/max duration, deposit default, min/max guests. Modules can be global or per property.
- **Rate rules** set the prices per module/room/period.

### Booking flow
1. Create a **booking**: module, room, check-in/out, guests, guest name/phone/ID
   (optionally link a member profile), optional deposit; mode **direct** or **tab**.
2. A **quote** computes the price; on confirm the price is **snapshotted**
   (recomputed on extend).
3. Bookings are numbered `STY-2026-0001` and have statuses:
   `requested → confirmed → checked_in → checked_out`, plus `no_show / cancelled / void`.
4. Deposit collected upfront is **credited at checkout**.

> This module is enabled per property; check with your manager if short stays are part of your operation.
