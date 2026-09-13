# 4. តួនាទី, សិទ្ធិ និង RBDC

## 4.1 គំរូ (អានម្តង ប្រើជារៀងរហូត)

```
Permission = MODULE × ACTION × SCOPE
```

- **Modules** M01–M33 (Users, Members, Owners, Properties, Leases, Rent
  Engine, Invoices, Ledger, Payments, Deposits, Utilities, Services, QR,
  POS, Stock, Room Moves, Documents, Inspections, Maintenance,
  Expenses/P&L, Telegram, Complaints, Attendance, Owner Statements, Tenant
  Portal, Reports, Security, Settings, Purchase Orders, Short Stays,
  Rent Alerts…)។
- **9 actions៖** `create · read · update · delete · approve · void · refund · export · config`។
- **3 scopes៖**
  - `GLOBAL` — properties ទាំងអស់។
  - `PROPERTY` — តែ properties ដែល**បានចាត់**ឲ្យអ្នកប្រើ។
  - `OWN` — តែ records ខ្លួនឯងរបស់អ្នកប្រើ។
- អ្នកប្រើអាចមាន **តួនាទីច្រើន**፤ សិទ្ធិមានប្រសិទ្ធភាព = **សហភាព**។
- **ភាពមើលឃើញ menu កើតចេញពីសិទ្ធិ** — គ្មាន menu builder ដាច់ដោយឡែកទេ។
  ដើម្បីបង្ហាញ/លាក់ menu item សូមផ្លាស់ប្តូរសិទ្ធិរបស់ role (និង **feature flag**
  របស់ module ក្នុង Settings → Features)។ Modules ពីរ (M13 QR,
  M17 Documents) អត់មាន top-level menu ដោយចេតនា — វានៅក្នុង
  invoices/member records។
- Permission ids មើលទៅដូចជា `M07:approve` (module:action)។

## 4.2 តួនាទីលំនាំដើម និងម៉ាទ្រីស

| តួនាទី | វិសាលភាព | មួយឃ្លា |
|---|---|---|
| **Super Admin** | GLOBAL | ពេញលេញ (`F`) គ្រប់ទីកន្លែងរួមទាំង config/delete/void។ **បានការពារ — មិនអាចលុបបាន។** |
| **Admin** | GLOBAL | គ្រប់គ្រង (`M` = create/read/update) គ្រប់ modules፤ គ្មាន full delete/config |
| **Property Manager** | PROPERTY | ដំណើរការ properties ដែលបានចាត់៖ rooms, leases, ops, ops-reports |
| **Accountant** | GLOBAL | លុយ៖ rent engine, invoices, ledger, payments, deposits, statements, P&L |
| **Staff** | PROPERTY | សរសេរប្រតិបត្តិការ (`W`) លើ properties ដែលបានចាត់፤ ត្រូវបានរារាំងពី finance mutations |
| **Owner** | OWN | អានតែលើ buildings, statements, documents **ខ្លួនឯង** |
| **Member** | OWN | អ្នកជួល៖ records ខ្លួនឯងតាម `/portal` តែប៉ុណ្ណោះ |

អក្សរម៉ាទ្រីស៖ `F` ពេញលេញ · `M` គ្រប់គ្រង (CRU) · `R` អាន · `W` អាន +
សរសេរប្រតិបត្តិការ · `O` records ខ្លួនឯង · `–` គ្មាន។

| Module | Super | Admin | PM | Acct | Staff | Owner | Member |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| M01 Users/RBDC | F | M | R | R | – | – | – |
| M02 Members | F | M | M | R | W | R | O |
| M03 Owners | F | M | R | R | – | O | – |
| M04 Properties/Rooms | F | M | M | R | R | R* | – |
| M05 Leases | F | M | M | R | R | R | O |
| M06 Rent Engine | F | M | R | M | – | – | – |
| M07 Invoices | F | M | M | M | R | R | O |
| M08 Ledger | F | R | – | M | – | O† | O† |
| M09 Payments | F | M | M | M | W | R | O |
| M10 Deposits | F | M | M | M | R | R | O |
| M11 Utilities | F | M | M | R | W | R | O |
| M12 Services | F | M | M | R | W | – | O |
| M13 QR Payments | F | M | R | M | W | – | O |
| M14 POS | F | M | M | R | W | – | – |
| M15 Stock | F | M | M | R | W | – | – |
| M16 Room Moves | F | M | M | R | W | – | O |
| M17 Documents | F | M | M | R | R | O | O |
| M18 Inspections | F | M | M | – | W | R | O |
| M19 Maintenance | F | M | M | – | W | W | O |
| M20 Expenses/P&L | F | M | R | M | W | R | – |
| M21 Telegram | F | M | – | – | – | O | O |
| M22 Complaints | F | M | M | – | W | R | O |
| M23 Attendance | F | M | M | R | O | – | – |
| M24 Owner Statements | F | M | R | M | – | O | – |
| M25 Tenant Portal | F | M | – | – | – | – | O |
| M26 Reports | F | M | M(ops) | M(fin) | R | R(own) | – |
| M27 Security | F | M(audit) | – | – | – | – | – |
| M28 Settings | F | M | R | R | – | – | – |
| M29 Purchase Orders | F | M | M | R | W | – | – |
| M32 Short Stays | F | M | M | R | W | – | – |
| M33 Rent Alerts | F | M | M | M | R | – | – |

\* Owners អាន buildings ខ្លួនឯង (own-scope)។ † OWN scope លើ statements/own data តែប៉ុណ្ណោះ។

## 4.3 បង្កើត custom role (ឧទាហរណ៍៖ Cashier)

1. **Admin → Roles → New role** → ដាក់ឈ្មោះ `Cashier`។
2. ធីក grid៖ **M09 (Payments)** → សរសេរប្រតិបត្តិការនៅ scope **PROPERTY**፤ ទុកអ្វីផ្សេងទៀតបិទ។
3. ចាត់ role ទៅអ្នកប្រើ cashier + ចាត់ **property** របស់ពួកគេ។
4. លទ្ធផល៖ ពួកគេអាចកត់ត្រាការទូទាត់ ប៉ុន្តែ **មិនអាចបើក invoices ដើម្បីកែ** —
   API ត្រឡប់ `403`។ (ករណីពិតប្រាកដនេះត្រូវបានគ្របដណ្តប់ដោយ CI negative tests។)

## 4.4 សិទ្ធិរបាយការណ៍

របាយការណ៍ជា **M26**។ បន្ថែមទៀត, **Settings → Reports** គ្រប់គ្រង៖
`enabledKeys` (របាយការណ៍ណាខ្លះមាន), `assignments` (roles/users ណាឃើញមួយណា),
`designs` (columns/branding)។ ទិន្នន័យរបាយការណ៍មិនអាចកែបានឡើយ។

## 4.5 វិធានសុវត្ថិភាព

- Least privilege តាមលំនាំដើម፤ សិទ្ធិមានប្រសិទ្ធភាពជាសហភាពនៃ roles ទាំងអស់។
- Role ដែល**កំពុងប្រើមិនអាចលុបបាន**፤ role Super Admin ត្រូវបានការពារ។
- រាល់ការផ្លាស់ប្តូរ role/permission ត្រូវ**បាន audit**፤ ម៉ាទ្រីសក៏ត្រូវ
  snapshot-test ក្នុង CI ដូច្នេះសិទ្ធិមិនអាចពង្រីកដោយស្ងាត់ស្ងៀម។

---
