# Part 14 — Move-Out Settlement Guide (Urgent Paid & Leave)

This part answers one question end to end: **when a lease stops, how is the final
balance worked out and paid?** It is a step-by-step user guide to the checkout
screen called **"⚡ Urgent Paid & Leave"**, plus the rules that make move-outs
money-safe.

> 💡 **Overview in one sentence:** the member tells you when they leave, the
> screen shows every dollar still owed (open invoices + the pro-rated final
> period + pending usages), you subtract their deposit, and one click
> collects the balance, issues the final invoice, and formally ends the lease.

**Reading time:** ~5 minutes. Refer to it every time a member leaves.

---

## 14.1 What the final balance is made of

The checkout adds up four buckets. Nothing else is charged.

| Bucket | Where it comes from | Example |
|---|---|---|
| **1. Open (unpaid) invoices** | Monthly rent/services/utility bills already issued but not yet paid **[M07]** | August invoice, $600 |
| **2. Unbilled final period** | Pro-rated rent (and fixed services) from the last billed period end to the departure date — calculated automatically, you do not hand-calculate **[M06]** | Sep 1–15 → 14/30 × $600 = $280 |
| **3. Pending usages** | Utility meter charges and per-use services logged after the last bill **[M11/M12]** | Electricity reading, visitor parking |
| **4. Fees (optional)** | Early-termination or damage fees from the move-out inspection **[M18/M19/M10]** | Damage $100 |

**Gross due = 1 + 2 + 3 + 4.** Then the deposit is applied:

- **Deposit ≥ gross due** → member owes **$0 (net)**; the excess deposit is
  refunded through the **deposit settlement** step that follows checkout.
- **Deposit < gross due** → member pays **(net) = gross due − deposit**.

> 💰 The system issues a **final invoice** covering bucket 2 (and missing usages)
> during checkout, then allocates the payment across open invoices in order
> (oldest first). Every payment produces a **receipt** and posts to the bookkeeping
> ledger.

---

## 14.2 Which path: standard move-out or urgent checkout?

| Situation | Use | How |
|---|---|---|
| Member gave advance notice; lease status is **notice**; time to close normally | **Standard close** | Pay open invoices via **Payments/QR [M09/M13]** → complete the **move-out inspection [M18]** → click **Complete** (or **Terminate**) on the lease |
| Member leaves immediately, unexpectedly, or wants everything handled in one go | **⚡ Urgent Paid & Leave** | Read Part 14.3 below. One screen does final invoice + payment + close |
| You tried a standard close and it was **blocked** because dues are still open | **⚡ Urgent Paid & Leave** | Confirm the preview, pay what's owed, and terminate in one click (see 14.3) |

Both paths share the same hard rule: **a lease cannot end with money outstanding
or without a move-out inspection.** The urgent checkout simply does all of it in
one place.

---

## 14.3 The checkout — step by step

1. Open the lease (**Portfolio → Leases → lease**). The lease must be **active**
   or **notice**.
2. Click **"⚡ Urgent Paid & Leave"** (the button beside the lease title, top-right of the screen).
3. **Set the departure date** (defaults to today). Changing it re-computes the
   pro-rated final period instantly — the preview updates on every change.
4. **Read the preview.** It lists dues in the four buckets, the **deposit held**,
   the **net to pay**, and any **deposit refund**. Confirm the numbers with the
   member.
5. Enter a **departure reason** (required), then **choose a settlement mode**
   (see 14.4) and, for non-QR modes, a **payment method**.
6. **Move-out inspection:** already done → the screen shows it and you may
   proceed. Not done → check **"Fast-track inspection"** to record the room as
   quickly inspected (or leave it unchecked — the system will block the close).
7. Click **⚡ Execute Urgent Settlement & Checkout** (or **📱 Open Scan-to-Pay
   QR** in QR mode).
8. The screen reports the result: final invoice code, payment code, receipt
   code, and the lease status now **terminated**. The room becomes **cleaning**,
   the member becomes **moved_out**.

> ⚠️ **Result is final.** Settlement terminates the lease immediately. The lease
> and its invoices become read-only history. Make sure every number was agreed
> before you confirm.

---

## 14.4 Settlement modes — which one (and why)

| Mode | What happens | When to choose |
|---|---|---|
| **Direct pay** | Member pays the whole net at the counter (cash, bank transfer, QR, card, cheque) | Member can pay the full balance right now |
| **QR pay** | A **QR code for the exact balance** appears; the lease stays **notice** until the member's payment is confirmed by the gateway, then it **terminates automatically** | Member will scan-and-pay or needs to pay later the same day |
| **Deposit offset** | The deposit is applied to the balance first; whatever it doesn't cover is collected at the counter (cash/bank/card/cheque) | Deposit covers most of the balance |
| **Combo** | Deposit is deducted first, then the member pays the small remainder — same mechanics as *Deposit offset* | The common case; clearest label for the member |
| **Zero due** | Nothing is owed (deposit already covers everything plus refund) | All dues cleared; just close the lease |

> 💡 **Most-used answer:** if the member has a deposit and owes a bit on top,
> pick **Combo** (or **Deposit offset** — in this build they behave the same:
> deposit first, remainder at the counter). If they owe nothing, pick
> **Zero due** (still issues the final invoice and closes the lease cleanly).
>
> 🚫 **Not in the current build:** offline/QR settlement for *deposit_offset*;
> the QR mode is for the full balance only.

---

## 14.5 QR pay in detail

1. Choose **QR pay** and confirm. The system opens a QR payment for the exact
   balance and keeps the lease in **notice**.
2. Show the member the screen: the QR code, the amount, and any expiry time.
3. The member scans it (with their banking app / the public pay page) and pays.
4. The screen shows **"Waiting for the payment gateway…"**. When the gateway
   confirms the money, the system **terminates the lease automatically** — no
   further clicks. Room → **cleaning**, member → **moved_out**, receipt issued.
5. If the payment fails or the QR expires, the screen tells you to **close and
   reopen** the settlement — a fresh QR is generated for the same balance.

> 💡 The lease only terminates **after** the gateway confirms the payment. Until
> then the member can keep paying and the screen keeps polling — if they walk
> away, close the dialog and the lease simply stays on **notice**.

---

## 14.6 Fields on the checkout screen

| Field | What it means |
|---|---|
| **Departure date** | Actual leave date; drives the final pro-rated period |
| **Reason** | Why the member is leaving — **required** (min 3 characters); kept in the audit trail |
| **Early-termination / damage fee** | Optional amounts added to the balance (e.g. from the inspection) |
| **Fast-track inspection** | Check to accept the room as quickly inspected when no move-out inspection exists (or uncheck to force inspection first) |
| **Settlement mode** | `Direct pay` · `QR pay` · `Deposit offset` · `Combo` · `Zero due` |
| **Payment method** | `Cash` · `Bank transfer` · `QR` · `Card` · `Cheque` (ignored in QR mode) |
| **Amount paid** | Net payable, pre-filled from the preview (edit only to agree a change with the member) |

---

## 14.7 What the system does in the background (one checkout)

1. Verifies all **gates**: lease active/notice, no payment already open.
2. Issues the **final (pro-rated) invoice** — gapless numbering, PDF filed.
3. **Deducts the deposit** with an **evidence document** (photo/note) credited
   against the deduction. Deposit ledger stays append-only **[M10]**.
4. Records the **payment**, allocates it to the oldest open invoices, issues a
   **receipt**, posts to the **ledger** (💰 receivable closed, cash/bank in, tax
   handled) **[M09/M05]**.
5. **Terminates the lease:** room → **cleaning**, member → **moved_out**.
6. **Starts the deposit settlement** (refund of anything left after deductions)
   and writes the full event + audit trail **[M27]**.

---

## 14.8 Common mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Wrong departure date | Wrong pro-rated amount (too high or too low) | Set the real date; watch the preview |
| Picking **QR pay** then walking away before the scan | Lease stays on notice until payment confirms | Reopen the QR so the member can pay; it auto-closes on confirmation |
| Closing out before utility meters were read | Under-charged final bill; you cannot re-bill a terminated lease | Read meters and log usage **first**, then checkout |
| Ending a normal lease while money is still owed | System blocks the close | Clear dues via the checkout, or pay invoices first [M09] |
| Not agreeing damage findings before settle | Dispute after termination | Do the inspection first; apply damage fees as part of checkout |

---

## 14.9 Best practice

- **Confirm the departure date face to face** with the member before checkout.
- **Read all meters and log usage** before you open the checkout — the final
  invoice is that much more accurate.
- **Do the move-out inspection first**; the screenshot/evidence you attach makes
  any deposit deduction defensible.
- **Recap the numbers with the member**: gross owed → deposit → net to pay (or
  refund). Say it out loud before clicking **Execute**.
- For urgent/hotel-style departures, default to **QR pay** — the member pays
  themselves and there is no cash handling at the counter.
- After checkout, verify the lease shows **terminated**, the room **cleaning**,
  and the member **moved_out** before re-letting the room; run the **deposit
  refund** to close the deposit ledger.

---

## 14.10 See also

- [Part 3 §6 — Leases & Contracts](03-user-guide.md#6-leases--contracts-m05): lifecycle, occupancy rules, ending a lease
- [Part 3 §10 — Invoices & Monthly Billing](03-user-guide.md#10-invoices--monthly-billing-m07) **[M07]**
- [Part 3 §11 — Payments & Receipts](03-user-guide.md#11-payments--receipts-m09) / [§12 — QR](03-user-guide.md#12-qr-payments-m13--the-public-pay-page) **[M09/M13]**
- [Part 3 §13 — Deposits](03-user-guide.md#13-deposits-m10) **[M10]**
- [Part 3 §15 — Inspections](03-user-guide.md#15-inspections-m18) **[M18]**
- [Part 4 §4.1 — The tenant lifecycle](04-business-workflows.md#41-the-tenant-lifecycle-move-in--move-out) (move-in → move-out)
- Part 12 — Glossary: *deposit offset*, *pro-rata*, *gapless numbering*, *receipt*