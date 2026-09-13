# 8. ប្រតិបត្តិការអ្នកគ្រប់គ្រងតាម module

របៀបធ្វើប្រចាំថ្ងៃនៅក្នុង `manual/03-user-guide.md`፤ នេះជា**ទស្សនៈ admin**៖
អ្វីត្រូវកំណត់, អនុម័ត និងតាមដានតាម module។

## M04 Properties & rooms
- រៀបចំ rooms ឲ្យត្រឹមត្រូវតាំងពីដំបូង (type, floor, rent)។ **Status machine
  របស់ room ត្រូវបានអនុវត្ត** (available → occupied → cleaning → available…)፤
  staff មិនអាចរំលង states — moves/leases ប្តូរ statuses ដោយស្វ័យប្រវត្តិ។
- Buildings អាចមាន **map coordinates + geofence radius** សម្រាប់ kiosk attendance។

## M05 Leases · M16 Room moves
- Lease activation បញ្ចេញ **deposit invoice** ដោយស្វ័យប្រវត្តិ (M10)។
- **Move-out inspection (M18) ជា hard gate** សម្រាប់បញ្ចប់ lease។
- Room move = request → approve → execute៖ lease ចាស់បញ្ចប់, lease ថ្មីចាប់ផ្តើម,
  deposit តាម member, **adjustment invoice តែមួយ** net ភាពខុសគ្នា prorated។
  កុំកែ leases ពីរដោយដៃដើម្បីក្លែង move។

## M06 Rent engine · M07 Invoices
- Job `invoice-generation` ប្រចាំខែ (តាម billing day) + `billing-daily`
  catch-up ប្រចាំថ្ងៃ។ Suspends ពាក់កណ្តាលខែ **prorate**፤ fixed services ជិះតាម engine។
- លេខ Invoice មកពី `number_sequences` + Settings prefix — gaps ជារឿងធម្មតា
  (idempotent retries), duplicates មិនអាចកើត។

## M08 Ledger
- Accountants ជាម្ចាស់។ ព្រឹត្តិការណ៍លុយនីមួយៗ post entries មានតុល្យភាព፤ voids
  និង refunds post **reversals** មិនកែទេ។ P&L និងរបាយការណ៍អាន ledger,
  ដូច្នេះ "register ↔ ledger" ត្រូវ reconcile ពិតប្រាកដ — បើរបាយការណ៍មិនត្រូវគ្នា
  សូមស៊ើបអង្កេត postings មិនមែនរបាយការណ៍។

## M09 Payments · M13 QR
- វិធី៖ cash / bank transfer / QR / card / cheque។ Machine៖
  `pending → confirmed → refunded | failed`។
- **Allocations ជា oldest-first** (due date បន្ទាប់មក period) និង immutable፤
  overpayments ក្លាយជា **member credit** (Accountant អាច refund ជាមួយ payout
  ledger-reversed)។
- Webhooks **បានចុះហត្ថលេខា + idempotent** — gateway notifications ស្ទួនត្រូវបាន
  មិនអើពើ មិន post ទ្វេដងឡើយ។ បង្កាន់ដៃ (`RCP-…`) auto-file ជា PDFs។
- ទំព័រ `/pay` សាធារណៈ៖ exact-due-only, rate-limited, គ្មាន login។

## M10 Deposits
- បញ្ចេញពេល lease activation፤ deductions ត្រូវបានស្នើពី move-out
  inspection findings និង **អនុម័តក្នុង M10**፤ payouts reverse តាម ledger។

## M11 Utilities · M12 Services
- Meters តាម room (electric/water/gas) ភាពជាក់លាក់ milli-unit፤ estimated =
  មធ្យម 3 លើកចុងក្រោយ፤ គាំទ្រ CSV import។ Tiered tariffs፤ charges ភ្ជាប់ទៅ
  **cycle បន្ទាប់ដោយស្វ័យប្រវត្តិ**፤ spikes >2×-average flag ជា anomalies។
- Services៖ fixed-monthly (prorate ពេល suspend) vs per-use (one-time lines)។
  Parking slots ជា unique፤ WiFi accounts តាម lease។

## M14 POS · M15 Stock · M29 Purchase orders
- POS sessions៖ opening float → expected = float + Σ cash → counted
  variance ពេល close។ **Charge-to-room** ចេញ one-time invoice + AR posting។
- Stock movements ជា **append-only** (purchase/sale/consumption/
  maintenance_use/adjustment/transfer) ជាមួយ moving-average cost។
  **Stocktakes post variance adjustments** — នោះជាផ្លូវកែតម្រូវ មិនមែន edits។
- Low-stock alerts ទៅ staff (និង Telegram បើបានភ្ជាប់)។

## M18 Inspections · M19 Maintenance · M22 Complaints
- Checklist templates តាម room type፤ move-out inspection gate ការបញ្ចប់ lease፤
  damage findings → deposit deductions ឬ tickets។
- Tickets៖ open → assigned → in_progress → resolved → verified/closed ជាមួយ
  SLA តាម priority (urgent 4h … low 168h) + daily breach sweep។ Costs ទៅ
  expense ឬ owner P&L។
- Complaints៖ thread + SLA + member-confirmed close ជាមួយ rating 1–5፤
  ប្តូរទៅ ticket ដោយមួយចុច។

## M20 Expenses & P&L
- Vendor expenses + receipt attachments፤ **អនុម័តលើស threshold ដែលអាចកំណត់**
  (auto-approve ខាងក្រោម፤ Accountant+ gate)፤ voids reverse។
  Monthly budgets ជាមួយ variance፤ recurring templates፤ P&L តាម property និង
  consolidated ពី ledger។

## M23 Attendance
- Kiosk-PIN + mobile clock in/out, optional property geofence, shift
  templates ជាមួយ grace + OT multipliers፤ exceptions (late/early/missed
  punch/overtime/geofence) ជាមួយ audited resolution፤ monthly summary + CSV
  payroll export។

## M24 Owner statements
- Monthly generation job (payout day, force bypass, idempotent តាម
  contract+month)។ រូបមន្ត៖ collected × share | fixed master rent −
  management fee − pass-through − owner maintenance ± audited adjustments។
- `draft → approved → paid`፤ approval accrues DR 3900 / CR 2200, payout
  DR 2200 / CR cash|bank។ PDFs auto-file፤ owners អានវាក្នុង portal។
  Generation gate ទៅ Accountant+ (GLOBAL M24:update)។

## M25 Tenant portal · M21 Telegram
- Portal (`/portal`, mobile PWA)៖ OTP login (hashed single-use codes,
  lockout) materializes member's User (role MEMBER) — scope **OWN ដាច់ខាត**
  លើ module APIs ដដែល។ គ្មាន business logic ស្ទួន។
- Telegram៖ signed webhook (spoofs ត្រូវបានបដិសេធ), one-time link codes, commands
  `/status /dues /pay /help` (own data តែប៉ុណ្ណោះ), event→template dispatcher ជាមួយ
  per-user toggles។ Dev token = mocked sender ជាមួយ full outbox។

## M26 Reports
- 12 របាយការណ៍ + dashboard KPI strip (occupancy %, billed vs collected,
  arrears, open tickets, cash position)។ របាយការណ៍នីមួយៗប្រកាស source
  line របស់វា፤ arrears aging ត្រូវស្មើ outstanding invoice totals។ CSV (RFC-4180)
  + branded PDF export፤ filter តាម date + property។

---
