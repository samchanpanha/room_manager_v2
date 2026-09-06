# DEMO.md — Full sample dataset & client pitch walkthrough

This document is the sales-demo script for RentManager. The database is
pre-seeded with **one coherent month of real-sounding operations** across every
module — the ledger, member statements, the trial balance and the dunning flow
all tell the same story, so nothing looks staged during the demo.

Demo runbooks live in `docs/manual/` — this file only tells you **what to click
and what to say**.

---

## 1. Run it

```bash
# Option A — Docker (recommended for the client laptop)
docker compose up -d --build   # seeds everything, incl. full demo data
open http://localhost:3000

# Option B — local dev (baseline seed only)
npm run dev                    # then:  npm run db:seed:demo  on the running DB
```

`SEED_FULL_DEMO=1` triggers the rich demo dataset in `prisma/seed-demo.ts`. It
runs **once per database** (guarded by the `demo.full` setting marker), so
restarting the container never duplicates anything.

### Logins (all passwords `Demo1234!`)

| Role            | Email               | Shows off |
|-----------------|---------------------|-----------|
| Super admin     | `root@demo.test`    | everything, RBAC matrix, all properties |
| Admin           | `admin@demo.test`   | settings (M28), portal announcements |
| Property manager| `pm@demo.test`      | BLR scoped, operations, approvals |
| Accountant      | `accountant@demo.test` | ledger, payments, expenses, owner statements |
| Staff           | `staff@demo.test`   | kiosk POS, service desk, inspections |
| Owner           | `owner@demo.test`   | owner portal (statements, occupancy) |
| Member (portal) | `chan.ling@example.test` (OTP) | tenant portal, invoices, complaints |

---

## 2. The storyline you sell

> *"This is a working 9-lease building (Bassac Lane Residence) plus a 2-unit
> villa, running its real August–September 2026 books — every number behind
> these screens is double-entry balanced and reconciles end-to-end."*

**The cast:**

| Member | Room | Lease | Month status | The demo hook |
|---|---|---|---|---|
| Chan Ling | A1-01 | LSE-0001 active (mid-month move-in) | **Paid** | Prorated 15 Aug invoice (13,710 rent + 823 WiFi) + deposit 500 |
| Sokha Preap | A1-03 | LSE-0003 active | **Paid** | WiFi + parking + laundry usage pending |
| Petra Novak | A2-02 | LSE-0004 active | **Issued w/ credit note** | Credit note CN-0001 ($2.00 parking correction); billed utilities on invoice |
| Meng Leang | A2-01 | LSE-0005 active | **Partial paid $150 / $100 due** | **Room move** G0-02 → A2-01 w/ adjustment invoice + move fee |
| Isabella Moreau | A3-02 | LSE-0006 active | **Overdue +$5 late fee** | Dunning stage 1, breach events, complaint open |
| Rith Somnang | A3-01 | LSE-0007 notice | **Issued, unpaid** | Move-out inspection scheduled, deposit settles at checkout |
| Hana Takahashi | A1-04 | LSE-0008 terminated | **Settled** | Deposit fully settled: $15.00 deduction (curtain rail) + $10.00 cash refund |
| Nun Sokha | V-01 | LSE-0009 active (RV villa) | **Paid** | Second property (scope demo) |
| Sophea Nuon | A1-02 | LSE-0002 draft | — | Pipeline: draft lease + **billed but unpaid deposit** |

---

## 3. The 20-minute pitch, module by module

### Dashboard & occupancy (M00/M04)
Click **Dashboard**. Show the occupancy board: A1-01, A1-03, A2-01, A2-02, A3-02,
V-01 occupied; A2-03/A1-04(A2-?) cleaning; A3-03 maintenance ("Ceiling leak fix").
Say: *"Room states are machine-driven — reserved → occupied → cleaning, no typos."*

### Members & leases (M02/M05/M06)
Members page → note the KYC badge, emergency contact, nationality, occupation.
Lease LSE-0005 → **Room move** tab → MOV-2026-0001 executed row (old rent 180 →
new 250, $20 move fee, $70 deposit delta). Say: *"One move ended the old lease,
issued the prorated adjustment invoice and repointed the deposit — automatically."*

### Invoices & payments (M07/M08/M09) — the money shot
**Invoices** list, filter by status:
- **Paid**: BLR-2026-0008 (Ling) — shows the prorated move-in line items.
- **Partial**: BLR-2026-0019 (Meng) — $200.00 invoiced, $150.00 in, `amountDue = total − paid − credited`.
- **Overdue**: BLR-2026-0020 (Isabella) — $325.00 total incl. the `late_fee` line; dunning stage 1.
- **Credit note**: BLR-2026-0018 (Petra) — $2.00 credited, credit note CN-0001 attached.

Then open **Member statement** for Isabella / Meng and click through to the
**Ledger** — showing the same DR/CR balances (1300 Receivable ↔ 4000/4100/4300).
Say: *"One system does billing, receipts, arrears and the general ledger — the
accountant never re-keys anything."*

Hit **Generate invoices** once — it issues next month for every active lease and
picks up the pending utility/usages automatically (Petra's meter, Sokha's
laundry), skipping the periods already billed. Show that re-running is a no-op
(idempotent).

### Deposits (M10)
Deposits page → 9 deposits: 7 **held**, 1 **billed** (Sophea, pre-deposit for a
draft lease), 1 **settled** (Hana). Open Hana → the $15.00 damage deduction is
linked to inspection INSP-2026-0002 finding, and the $10.00 refund is a cash
transaction; the ledger shows `2100 Deposit Liability → 4900 Other Revenue` and
`2100 → 1100 Cash`.

### Utilities & services (M11/M12)
Utilities → Petra's meters: 2 charges **billed** (matched to her invoice lines:
$35.00 elec / $8.00 water), plus **pending** current readings. Sokha has a
usage **anomaly flag** (2.4× spike) that Ethereum-ishrides next month's invoice.
Services → laundry per-use entry pending on Sokha; parking P-A01/P-A02 and WiFi
accounts assigned.

### Facilities & operations (M14/M15/M18/M19/M22/M29/M30)
- **POS**: a closed till session with 3 sales (cash $2.50, QR $6.60, room-charge
  $3.60 on Sokha) and a **$0.10 cash variance** logged.
- **Stock**: 13 movements; PO-2026-0001 received (5 lines), PO-2026-0002 draft;
  a completed **stocktake** with counted variance (–1 cola, –2 noodles) and the
  valuation delta.
- **Inspections**: completed move-in (Sokha), **move-out (Hana)** with the damage
  finding → deposit deduction link, periodic (Petra), scheduled draft (Rith).
- **Maintenance**: 5 tickets — one watching an **SLA breach**, one with $27.00
  costs (labour+material), one complaint→ticket conversion (CMP-2026-0004).
- **Complaints**: 4 across the status machine; CMP-2026-0003 is a billing
  dispute assigned to the accountant.

### Finance (M20/M23/M24)
- **Expenses**: 5 across the approval machine (3 approved & posted to the ledger,
  1 pending A/C quote, 1 rejected w/ reason) + budget/P&L variance.
- **Attendance**: staff week + late clock-in exception + overtime day; PM punch
  records; one open *missed clock-out* exception on the report.
- **Owner statements**: STM-2026-0001 (Building A, 60% revenue share, 10% mgmt
  fee) — net $729.10 from $2,498.33 collected, pass-through $220.00 WiFi,
  $400.00 owner-borne repair; STM-2026-0002 (Riverside Villa, $650.00 fixed rent).
  Both accrual-posted (`3900 → 2200`) and **approved**.

### Guests (M32)
Short stays: one **checked out** hourly booking (paid tab STY-TAB, $38.00 via QR)
and one **checked in** overnight booking with an open F&B tab ($120.00).

### The glue (M16/M21/M25/M33)
- **Room move** page shows the executed move end-to-end.
- **Telegram**: 2 bound chats (member + owner) and 4 outbox messages with statuses.
- **Portal**: 3 announcements; member OTP login for Chan Ling.
- **Events**: 5 domain events (overdue, SLA breach, low stock, new complaint,
  stay check-in) feed the alert inbox.

---

## 4. Numbers you can be quizzed on

- 27 invoices: 21 paid, 1 overdue, 1 partial, 4 issued (incl. the billed deposit).
- 22 payments + 2 direct POS receipts → **24 payment postings**.
- Ledger is balanced: **Σ debits = Σ credits = $16,690.06** (58 postings, 124 entries).
- `amountDue = total − paid − credited` holds for **every** invoice (verified by CI).
- Outstanding: Isabella $325.00 (overdue), Rith $320.00, Petra $275.00,
  Meng $100.00, Sophea $500.00 (unpaid deposit), guest tab $120.00.
- Next codes already synced: next invoice `BLR-2026-0022`, next payment
  `PMT-2026-0023`, next lease `LSE-0011` — the demo never breaks numbering.

---

## 5. Why it won't trip over itself

- `npm run db:seed:demo` is **idempotent** — re-running is skipped via the
  `demo.full` marker, so `docker compose restart` is safe.
- The full test suite (450 tests) reseeds a **clean** DB without the demo flag;
  the demo data never bleeds into CI.
- Every banked row posts its own balanced double-entry transaction using the
  exact same ledger service the app uses — nothing is faked at the DB layer.