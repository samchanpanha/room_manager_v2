# ផ្នែក ៤ — ដំណើរការអាជីវកម្ម

ផ្នែកនេះភ្ជាប់ម៉ូឌូលទាំងអស់ ទៅជា **ដំណើរការពីដើមទៅចុង**។ ដំណើរការ foreach
បង្ហាញអ្នកណាសកម្ម តាមលំដាប់ណា កំណត់រឿងអ្វីត្រូវបានបង្កើត ហើយផលប៉ះពាល់
ហិរញ្ញវត្ថុជាអ្វី។ រូបសង្ខេបប្រើស្លាកឆ្វេងសាមញ្ញ។

---

## 4.1 វដ្តជីវិតអ្នកជួល (ចូល → ចាកចេញ)

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

**ការគ្រប់គ្រងសំខាន់ៗ កនុងវដ្តជីវិតនេះ**
- សមាជិកមិនអាច **verified** បាន ដោយគ្មាន KYC ពេញលេញទេ។
- បន្ទប់មិនអាចមាន **កិច្ចសន្យាជួលសកម្មពីរ** បានទេ (មួយក្នុងមួយគ្រែ; គ្រប់គ្រងតាមទំហំ)។
- កិច្ចសនយាជួលមិនអាច **បញ្ចប់** ជាមួយលំណូល ឬដោយគ្មានការត្រួតពិនិត្យចាកចេញ បានទេ។
- ប្រាក់រំលងប្រាក់កក់ ត្រូវស្គរសូន្យ **មុន** ការបិទកិច្ចសន្យាជួលពេញលេញ។

---

## 4.2 ដំណើរការការគណនាប្រាក់ (វដ្តបិទខែ)

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

**អ្នកណាធ្វើអ្វី** គណនី/Manager ដំណើរការការបង្កើត និង issue។ ការងារ
គណនាប្រាក់ប្រចាំថ្ងៃ (ឬការចាប់ផ្ដើមដែលមានអនុសាស) អនុវត្តប្រាក់សោភ័ណ/
overdue/ការជ្រើស។ កម្មករកត់ត្រាការទូទាត់។

---

## 4.3 ដំណើរការការទូទាត់

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
ការត្រឡប់ ត្រឡប់រូបរាងនេះត្រឡប់មកវិញ៖ **ការអនុម័ត Accountant+** ការបង់
ដែលរំលំតាមរយៈ ledger ការត្រឡប់ credit សមាជិក។ ការទូទាត់រលំបាត់ មិនចុះអ្វីទេ។

---

## 4.4 ដំណើរការកិច្ចសនយា

**កិច្ចសន្យាជួលសមាជិក៖**
```
Create (draft) → review terms → Activate → (notice) → Terminate/Complete
                     │
   snapshot of rent/cycle/proration/deposit/services is locked at activation
   (changes after activation use renewals / room moves / notices — never rewrite)
```

**កិច្ចសនយាម្ចាស់៖**
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

> ដើម្បី**ផ្លាស់ប្ដូរកិច្ចសន្យាសកម្មមានរួចហើយ ដោយសុវត្ថិភាព**៖ កុំកែ
> លក្ខខណ្ឌដែលបានចុះហើយ។ បញ្ចប់/terminate មួយបច្ចុប្បន្ ហើយបងកើតកិច្ចសនយាថ្មី
> (ឬ សម្រាប់កិច្ចសន្យាជួលសមាជិក ប្រើការចុះវិញ / ការផ្លាស់បន្ទប់)។ ការផ្លាស់ប្ដូរ foreach ត្រូវបានត្រាត្រួតពិនិត្យ។

---

## 4.5 ដំណើរការចំណាយ

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
ចំណាយដែលកើតឡើងម្ដងទៀត អាចត្រូវបានកំណត់ជា **templates** ហើយ **ដំណើរការ**
រាល់រយៈពេល។ **Budgets** ក្នុងមួយអចលនទ្រព្យ/ប្រភេទ/ខែ បង្ហាញ variance នៅលើ
របាយការណ៍ P&L។

---

## 4.6 ដំណើរការការជួសជុល / ការតវ៉ា

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

**ការត្រួតពិនិត្យក៏ចូលនឹងនេះដែរ៖** ការរកឃើញចាកចេញ អាចបើកសំបុត្រ
ឬអនុសាសការកាត់ប្រាក់កក់ (ផ្នែក 3.15)។

---

## 4.7 ដំណើរការការផ្លាស់បន្ទប់

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

## 4.8 ដំណើរការរបាយការណ៍ម្ាស់

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
ការបង្កើតត្រូវបានរឹត ដល់ **Accountant+ (GLOBAL M24:update)**។ ការបង្កើតម្ដងទៀត
មិនដោរសារប្រវត្តិឡើងវិញទេ — រយៈពេលថ្មីត្រូវបានបន្ថែម ទៅមុខតែ; ការកែតម្រូវ
ប្រើ**ការកែសម្រួលដែលត្រូវបានត្រាតរួតពិនិតយ**។

---

## 4.9 ខ្លោងទ្វារអ្នកជួល (M25) — ការសេវាខ្លួនឯងរបស់សមាជិក

Web app ដែលទទួល mobile ជាមុន ប្រសើរ នៅ **`/portal`**។ សមាជិកចូលដោយ
**ពាក្យសមងាត់មួយដង (OTP)** ដែលផ្ញើទៅអ៊ីមែល/ទូរស័ព្ទរបស់ពួកគេ
(hashed, ប្រើម្ដង, បិទបន្ទាប់ពី ៥ ដង)។ ការចូល បង្កើត user **MEMBER** របស់ពួកគេ
ដើម្បីយខ្លោងទ្វារ ដំណើរការលើ APIs ម៉ូឌូលតែមួយ ជាមួយ **OWN-scope** តឹងរ៉ឹង
(ពួកគេប៉ះតែកំណត់រឿងផទាល់ខ្លួន ជានិច្ច)។

ពីខ្លោងទ្វារ សមាជិកអាច៖
- មើល**ផ្ទាំងគ្រប់គរង**របស់ពួកគេ៖ បន្ទប់ កិច្ចសន្យាជួល **តម្លៃដែលត្រូវបង់**។
- មើល**វិក្កយបត្រ** និង**បង់តាម QR** (M13)។
- មើលស្ថានភាព**ប្រាក់កក់** និង**statement** គណនីរបស់ពួកគេ។
- លើកសំណើ**ការជួសជុល** និង**ការតវ៉ា** តាមដានពួកគេ វាយតម្លៃការដោះស្រាយ។
- ស្នើ**ការផ្លាស់បន្ទប់** និងផ្ដល់**ដំណឹងចាកចេញ** (logic កិច្ចសន្យាជួលរួម)។
- ឡូត**ឯកសារ / KYC** និងមើលឯកសារ/ការជូនដំណឹង។

**Golden path សម្រាប់សមាជិក៖** បើកវិក្កយបត្រ → បង់តាម QR →
(ការទូទាត់បានបញ្ជាក់ ប័ណ្ណនៅ Telegram/portal) → លើកការតវ៉ា → តាមដានសំបុត្រ
— គ្រប់យ៉ាង ដោយគ្មានជំនួយកម្មករ។

---

## 4.10 ការអនុម័ត — អ្នកណាអាចអនុម័តអ្វី

| ដំណើរការ | អ្នកដែលអាចបង្កើត | អ្នកដែលអនុម័ត |
|---|---|---|
| ចំណាយ | Staff/Manager | ដ្រត្រា បើក្រោមអង្គុយ; **គណនី/Manager** បើលើស |
| ការ void វិក្កយបត្រ | — | **Super Admin តែប៉ុណ្ណោះ** (មូលហេតុ + audit) |
| Credit notes | គណនី/Manager | ចុះពេលបង្កើត (≤ ត្រូវបង់) |
| ការត្រឡប់ការទូទាត់ | — | **Accountant+** |
| ការត្រឡប់/ការកាត់ប្រាក់កក់ | គណនី/Manager | **ការអនុម័តគណនី** ការកាត់ត្រូវការភស្តុតាង |
| ការផ្លាស់បន្ទប់ | Staff/Member (សំណើ) | **Manager** អនុម័ត មុនពេលអនុវត្ត |
| របាយការណ៍ម្ចាស់ | — | បង្កើត = **Accountant+** អនុម័ត/បង់ = ហិរញ្ញវតថុ |
| ការផ្លាស់ប្ដូរតួនាទី/សិទ្ធិ | **Super Admin/Admin** | ត្រាត្រួតពិនិត្យ |

> ការអនុម័ត និងការផ្លាស់ប្ដូរស្ថានភាព foreach សរសេរជួរ **audit log** មួយ
> ជាមួយតម្លៃមុន/បន្ទាប់ និង IP (ផ្នែក 9)។
