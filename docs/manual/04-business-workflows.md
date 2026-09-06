# Part 4 — Business Workflows

This part connects the modules into **end-to-end processes**. Each workflow shows
who acts, in what order, what records are created, and what the financial impact
is. Diagrams use simple arrows.

---

## 4.1 The tenant lifecycle (move-in → move-out)

```
Prospect enquires
   │  Staff creates Member (prospect)                         [M02]
   ▼
KYC documents uploaded & complete
   │  Member: prospect → verified                             [M17]
   ▼
Lease created (draft) ── room becomes "reserved"              [M05]
   │  Rent amount, cycle day, proration basis, deposit terms
   │  Services assigned (WiFi/parking)                        [M12]
   ▼
Lease ACTIVATED
   │  room → occupied · member → active
   │  deposit billed (installment invoices)                   [M10]
   │  first invoice scheduled                                 [M06/M07]
   ▼
Monthly living
   │  Invoices generated (rent + services + utilities)        [M07]
   │  Member pays (QR/cash/bank/card) → receipts              [M09/M13]
   │  Maintenance/complaints handled                          [M19/M22]
   │  Meter readings → utility charges                        [M11]
   │  POS room charges (if any)                               [M14]
   │  (Optional) room move → adjustment invoice               [M16]
   ▼
Move-out notice given (lease → notice)
   │  Dues must clear to 0 (or be written off with approval)
   ▼
Move-out INSPECTION completed (hard gate)                     [M18]
   │  Findings → maintenance ticket and/or deposit deduction  [M19/M10]
   ▼
Lease TERMINATED / COMPLETED
   │  room → cleaning · member → moved_out
   │  deposit settled: deductions (evidence) + refund         [M10]
   ▼
Room returns to vacant → ready to re-let                      [M04]
```

**Key controls in this lifecycle**
- Member can't be **verified** without complete KYC.
- A room can't have **two active leases** (one per bed; capacity enforced).
- A lease can't **end** with outstanding dues or without a move-out inspection.
- Deposit liability must net to **zero** before the lease is fully closed.

---

## 4.2 Billing workflow (monthly close rhythm)

```
 (Fixed day each month)
   │
   ├─ 1. Enter utility meter readings (manual / CSV / estimated)   [M11]
   ├─ 2. Log per-use service usage (laundry, visitor parking)      [M12]
   ├─ 3. Confirm any POS "charge to room" sales are in              [M14]
   │
   ▼
   4. RUN invoice generation                                       [M06/M07]
   │     • every active lease with a pending period
   │     • mid-month leases get a prorated stub first (catch-up)
   │     • one live invoice per lease & period (idempotent)
   │     • gapless numbering {PROP}-{YEAR}-{SEQ}, PDF filed
   │
   ├─ 5. Review: spot-check totals = Σ lines − discount + tax
   ▼
   6. ISSUE invoices (draft → issued) → members see them in portal
   │     • Telegram "invoice issued" (if linked)
   │
   ▼
 (Daily job thereafter)
   7. After grace period → late fees post; invoices → overdue
   8. Dunning reminders at +3 / +7 / +14 days                      [M33/M21]
   │
   ▼
   9. Collections recorded against invoices → receipts            [M09]
        invoice: issued → partial_paid → paid
```

**Who does what:** Accountant/Manager runs generation and issues; the daily
billing job (or an authorised trigger) applies late fees/overdue/dunning; Staff
record payments.

---

## 4.3 Payment workflow

```
 Member pays (portal QR, or cash/bank/card/cheque at desk)
   │
   ▼
 Payment created
   ├─ cash/bank/cheque → confirmed immediately
   └─ QR/card/gateway  → pending → webhook confirms (once; duplicates ignored)
   │
   ▼
 Allocation (oldest-first by due date/period)
   ├─ deposit invoices picked first
   ├─ remainder overpays → member credit
   ▼
 Results (all automatic)
   ├─ invoice status partial_paid / paid
   ├─ receipt RCP-… PDF filed
   ├─ ledger: DR Cash/Bank · CR Rent Receivable (and revenue recognition)
   └─ Telegram receipt message (if linked)
```

Refunds reverse this: **Accountant+ approval**, ledger-reversed payout, member
credit returned. Failed payments post nothing.

---

## 4.4 Contract workflow

**Member lease:**
```
Create (draft) → review terms → Activate → (notice) → Terminate/Complete
                     │
   snapshot of rent/cycle/proration/deposit/services is locked at activation
   (changes after activation use renewals / room moves / notices — never rewrite)
```

**Owner contract:**
```
Create owner + payout method          [M03]
   │
Create owner contract (draft)         [M05]
   model = FIXED_RENT (master rent)  or  REVENUE_SHARE (% + management fee)
   term dates + payout cycle day (1–28)
   │
Activate → Building.ownerId syncs (one open contract per building)
   │
Monthly owner statements are generated from the active contract   [M24]
   │
Terminate (reason) / expire
```

> To **change an existing active contract safely**: don't edit posted terms.
> End/terminate the current one and create a new contract (or, for member
> leases, use renewal / room move). All changes are audited.

---

## 4.5 Expense workflow

```
Record expense (vendor, category→ledger 5000/5100, amount, date,
                payment method, receipt attachment, property)
   │
   ▼
 Approval?
   ├─ Below threshold ($500.00 default) → auto-approved → LEDGER POSTS
   └─ Above threshold → pending → Accountant/Manager approves → posts
   │
   ▼
 Paid (paid via payment method)  ──  ledger: DR Expense · CR Cash/Bank
   │
   └─ (If wrong) VOID → reversal entries (history preserved)
```
Recurring expenses can be set as **templates** and **run** each period; **budgets**
per property/category/month show variance in the P&L report.

---

## 4.6 Maintenance / complaint workflow

```
Member raises issue (portal/Telegram) OR staff logs it
   │
   ├─ Complaint?  new → acknowledged → (one-click) → Maintenance ticket
   │                                    resolved → member rates 1–5 → closed
   ▼
Maintenance: open → assigned → in_progress → resolved → verified/closed
   │   • SLA clock by priority (urgent 4h … low 168h)
   │   • daily breach sweep → escalations
   │   • consume stock parts (M15) + labour = costs
   ▼
Cost routing
   ├─ operator cost → Expense (M20) → P&L
   └─ owner-borne   → Owner Statement (M24)
```

**Inspections feed this too:** move-out findings can open a ticket or propose a
deposit deduction (Part 3.15).

---

## 4.7 Room-move workflow

```
Request (member portal or staff): target room + effective date
   │
   ▼
System preview: prorated new rent + move fee − unused old-rent credit
                (= net adjustment) + deposit delta
   │
   ▼
Approve → Execute
   ├─ old lease ends; new lease starts
   ├─ old room → cleaning ; new room → occupied
   ├─ deposit follows member
   ├─ ONE adjustment invoice carries the net delta
   └─ history on member timeline
 (request can be cancelled before execution)
```

---

## 4.8 Owner-statement workflow

```
Month closes (collections + costs final)
   │
Generate statements (job; idempotent per contract+month)        [M24]
   formula:  collected × share%   OR   fixed master rent
            − management fee − pass-through expenses
            − owner-borne maintenance ± approved adjustments
            = net owner payout
   │
 draft → approved
   │   approval accrues: DR 3900 Owner Distributions · CR 2200 Owner Payable
   ▼
 paid (payout via payment method)
   │   DR 2200 Owner Payable · CR Cash/Bank  (payable nets back to prior balance)
   ▼
 PDF auto-filed → visible in owner portal                       [M17/M03]
```
Generation is gated to **Accountant+ (GLOBAL M24:update)**. Regenerating never
rewrites history — new periods are added forward-only; corrections use
**audited adjustments**.

---

## 4.9 The Tenant Portal (M25) — member self-service

A mobile-first web app at **`/portal`**. Members log in with a **one-time
password (OTP)** sent to their email/phone (hashed, single-use, locks after 5
attempts). Logging in materialises their **MEMBER** user so the portal rides the
same module APIs with strict **OWN-scope** (they only ever touch their own records).

From the portal a member can:
- See their **dashboard**: room, lease, **balance due**.
- View **invoices** and **pay by QR** (M13).
- See **deposit** status and their **account statement**.
- Raise **maintenance** and **complaint** requests; track them; rate resolution.
- Request a **room move** and give **move-out notice** (shared lease logic).
- Upload **documents / KYC** and view documents/announcements.

**Golden path for a member:** open invoice → pay by QR → (payment confirmed,
receipt in Telegram/portal) → raise a complaint → track the ticket — all without
staff help.

---

## 4.10 Approvals — who can approve what

| Process | Who can create | Who approves |
|---|---|---|
| Expenses | Staff/Manager | Auto below threshold; **Accountant/Manager** above |
| Invoice void | — | **Super Admin only** (reason + audit) |
| Credit notes | Accountant/Manager | Posts on create (≤ due) |
| Payment refund | — | **Accountant+** |
| Deposit refund / deduction | Accountant/Manager | **Accountant approval**; deductions need evidence |
| Room move | Staff/Member (request) | **Manager** approves before execute |
| Owner statement | — | Generate = **Accountant+**; approve/pay = finance |
| Role/permission changes | **Super Admin/Admin** | Audited |

> Approvals and every state change write an **audit log** row with before/after
> values and IP (Part 9).
