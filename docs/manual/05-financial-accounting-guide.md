# Part 5 — Financial & Accounting Guide

Written for people who run the money — and for managers who want to understand
it. No accounting background needed: every term is explained in plain language.

---

## 5.1 The one idea behind the ledger

Every time money moves, the system writes **two balanced entries** (double-entry,
"light" version). The rule that never breaks:

> **Total debits = Total credits, always.** This is enforced by the database,
> the service code, and automated tests. An unbalanced posting is rejected.

The ledger is **append-only** — you cannot update or delete a posted entry
(the database raises an error). Mistakes are fixed with a **reversal** entry that
links back to the original, so the full history always tells the truth.

### Plain-language terms
| Term | What it means here |
|---|---|
| **Debit / Credit** | The two sides of every entry. Don't think "good/bad" — think "left/right". Money in vs money owed/earned. |
| **Account** | A bucket the system tracks (Cash, Bank, Rent Receivable, Revenue…). |
| **Ledger** | The book of all entries across all accounts. |
| **Journal** | The chronological list of entries (browser at **Finance → Ledger**). |
| **Trial balance** | A check that all debits equal all credits (should net to zero). |
| **Receivable** | Money members **owe** you (an asset) until they pay. |
| **Revenue** | Money **earned** (rent, services, utilities, late fees). |
| **Expense** | Money **spent** to operate. |
| **Asset** | What you hold (cash, bank, what members owe). |
| **Liability** | What you **owe others** (deposits held, owner payouts due, tax). |
| **Equity** | Owners' stake / owner distributions. |

---

## 5.2 The chart of accounts (fixed system codes)

These are the only accounts in the system (you don't create arbitrary ones):

| Code | Account | Type | What it holds |
|---|---|---|---|
| 1100 | **Cash** | Asset | Cash on hand |
| 1200 | **Bank** | Asset | Money in the bank |
| 1300 | **Rent Receivable** | Asset | What members currently owe |
| 2100 | **Deposit Liability** | Liability | Security deposits you hold |
| 2200 | **Owner Payable** | Liability | Owner payouts due |
| 2300 | **Tax Payable** | Liability | Tax collected, not yet remitted |
| 3900 | **Owner Distributions** | Equity | Owner distribution accruals (balance-sheet only) |
| 4000 | **Rent Revenue** | Income | Rent earned |
| 4100 | **Service Revenue** | Income | WiFi/parking/laundry services |
| 4200 | **Utility Revenue** | Income | Electric/water/gas charges |
| 4300 | **Late Fee Revenue** | Income | Late fees |
| 4900 | **Other Revenue** | Income | One-time charges, deposit deductions for damage/cleaning |
| 5000 | **Operating Expenses** | Expense | Day-to-day costs |
| 5100 | **Bank Fees** | Expense | Bank charges |

> Asset and expense accounts "grow" with debits; liability, income and equity
> accounts grow with credits.

---

## 5.3 What each money event posts

### (a) Invoice is issued
The member is billed. You are now **owed** that money, and you have **earned**
the revenue:

| | Debit | Credit |
|---|---|---|
| Rent Receivable (1300) | ↑ total billed | |
| Revenue account (4000 rent / 4100 service / 4200 utility / 4300 late fee / 4900 one-time) | | ↑ earned |
| Tax Payable (2300) — if tax | | ↑ tax |
| **Deposit invoices** instead credit **Deposit Liability (2100)** — deposits are *not* revenue. |

```
DR 1300 Rent Receivable      350.00
   CR 4000 Rent Revenue              300.00
   CR 4100 Service Revenue            15.00
   CR 4200 Utility Revenue            35.00
```

### (b) Member pays the invoice
Cash/Bank goes up; the receivable is cleared:

```
DR 1100 Cash (or 1200 Bank)  350.00
   CR 1300 Rent Receivable           350.00
```

**In plain language:** *Cash in hand goes up; the amount the member owed goes down.*

### (c) Late fee applied (after grace)
```
DR 1300 Rent Receivable       10.00
   CR 4300 Late Fee Revenue           10.00
```

### (d) Deposit collected
The deposit is held money (liability), **not** income:
```
DR 1100 Cash                 300.00
   CR 2100 Deposit Liability          300.00
```
At move-out, deductions (damage/cleaning) release part to **4900 Other Revenue**
or clear unpaid receivables; the refund **debits 2100** and **credits Cash/Bank**.
For a closed lease, 2100 for that lease must net to **0**.

### (e) Expense recorded & paid
```
DR 5000 Operating Expenses    80.00
   CR 1100 Cash (or 1200 Bank)        80.00
```

### (f) Owner statement approved then paid
Approval accrues the amount owed to the owner:
```
DR 3900 Owner Distributions   500.00
   CR 2200 Owner Payable              500.00
```
Paying the owner clears the payable:
```
DR 2200 Owner Payable         500.00
   CR 1100/1200 Cash/Bank             500.00
```
(Owner Payable nets back to its prior balance after payment.)

### Corrections
- **Void an expense** → reversal entries (the original stays, the reversal undoes it).
- **Credit note on an invoice** → reverses the billed amount (auto-settles at zero).
- **Refund a payment** → reverses cash and receivable (Accountant+ approval).
- Posted rows can never be edited/deleted — the database blocks it.

---

## 5.4 Where to see the accounting
- **Finance → Ledger [M08]:** the **journal browser** (filter by account, date,
  reference, property/member) and **trial balance**. Admin/Accountant access.
- **Member statement** (`Members → [member] → statement`, or the portal): a
  running **receivable balance** for one member. Members only see their own.
- **Opening balances:** set in **Settings → Opening balances** as balanced
  `opening` postings when you first migrate into the system.

> Money integrity rules (from the product spec): integer minor units, one
> currency per org, Σ debits = Σ credits, no deletes, allocations sum to the
> payment, idempotent webhooks, and financial settings apply **forward-only**
> (posted history is never rewritten).

---

## 5.5 Profit & Loss (P&L)

**Purpose:** show whether the business made or lost money in a period.

```
REVENUE (income accounts 4000–4900)
   Rent + Services + Utilities + Late fees + Other (incl. POS sales)
− EXPENSES (accounts 5000–5100, operating costs)
− OWNER PAYOUTS  (per contract model)
= NET PROFIT / LOSS
```

- Found in **Finance → Expenses & P&L [M20]** and as the **Profit & Loss** report [M26].
- Available **per property** or **consolidated**.
- It **reads the ledger** and reconciles register↔ledger exactly (the P&L totals
  match the ledger totals by construction).
- Compare **current vs previous period**; pair it with the **Expense vs budget**
  report to see over/under-budget categories.

**Simple example (one property, one month):**

| | Amount |
|---|---|
| Rent revenue | 9,000.00 |
| Service revenue | 450.00 |
| Utility revenue | 800.00 |
| Late fees | 60.00 |
| **Total revenue** | **10,310.00** |
| Operating expenses | −2,100.00 |
| Bank fees | −40.00 |
| Owner payout (revenue-share building) | −4,500.00 |
| **Net profit** | **3,670.00** |

---

## 5.6 Balance Sheet

> 🚫 **Not confirmed as a dedicated report screen in the current system.**
> There is no "Balance Sheet" menu item among the 13 reports. However, the
> **underlying balances are all available** from the ledger at
> **Finance → Ledger → Trial balance**, using the fixed account codes. You can
> read the balance sheet position from the trial balance as follows:

```
ASSETS
   1100 Cash            + 1200 Bank           (cash position — also a dashboard KPI)
 + 1300 Rent Receivable (money members owe)
= TOTAL ASSETS

LIABILITIES
   2100 Deposit Liability  (deposits held)
 + 2200 Owner Payable      (owners due)
 + 2300 Tax Payable        (tax collected)
= TOTAL LIABILITIES

EQUITY
   3900 Owner Distributions  (debit-balance equity account)
 + retained earnings (revenue 4xxx − expenses 5xxx to date)
= TOTAL EQUITY

Why it balances: every entry posts equal debits and credits, so
TOTAL ASSETS = TOTAL LIABILITIES + TOTAL EQUITY  — always.
The trial balance nets to zero, which is the same statement.
```

- **Cash position** (1100 + 1200) is a live **dashboard KPI**.
- **Arrears** on the dashboard ≈ 1300 Rent Receivable currently open.
- **Deposit Liability (2100)** should trend to zero for every closed lease.

---

## 5.7 Owner Statements (M24) — owner payouts

**Purpose:** tell each landlord, per month, what was earned from their building
and what they are paid.

**Calculation (plain language):**
1. Start with money **actually collected** for the owner's units.
2. Apply the contract model:
   - **REVENUE_SHARE:** multiply collected by the owner's **share %** (e.g. 60%).
   - **FIXED_RENT:** use the agreed **monthly master rent**.
3. **Subtract** the **management fee**, **pass-through expenses**, and
   **owner-borne maintenance** (from tickets routed to the owner).
4. **Add/subtract approved adjustments** (audited).
5. Result = **net owner payout**.

```
Collected rent for owner's units
   × share %   (or fixed master rent)
 − management fee
 − pass-through expenses
 − owner-borne maintenance
 ± audited adjustments
 = NET OWNER PAYOUT
```

**Flow:** generated (idempotent per contract+month; respects the payout day) →
`draft → approved → paid`. Approval posts DR 3900 / CR 2200; payment posts
DR 2200 / CR cash|bank. A statement **PDF** is auto-filed and appears in the
owner portal. Generation requires **Accountant+ (GLOBAL M24:update)**.

---

## 5.8 Money handling rules to remember
1. **Never delete** posted invoices, payments, expenses or ledger entries — void/refund/reverse.
2. **Deposits are not revenue** until a deduction legitimately releases them.
3. **Overpayments become member credit**, not income.
4. **Issued invoices are immutable** — correct with credit notes; only Super Admin voids (with reason).
5. **Refunds need Accountant+ approval** and reverse the ledger.
6. **Financial settings apply forward-only** — changing late fee/tax/billing rules never rewrites posted bills.
7. When figures look wrong, **don't adjust by hand** — trace via the **Audit log** and the **Ledger journal**, then use the proper reversal.
