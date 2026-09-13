# RentManager — មគ្គុទ្ទេសក៍អ្នកគ្រប់គ្រង

> **សម្រាប់អ្នកណា៖** Super Admin, Admin, បុគ្គលិក IT និងម្ចាស់អាជីវកម្មដែលដំឡើង,
> កំណត់រចនាសម្ព័ន្ធ, ធានាសុវត្ថិភាព និងថែទាំ RentManager។
> **បុគ្គលិកធ្វើការងារប្រចាំថ្ងៃ** (front desk, cashier, manager) គួចាប់ផ្តើមជាមួយ
> **Help & Guide** ក្នុង app (`/guide`) ឬ [`docs/manual/`](./manual/README.md) ជំនួស។
>
> ឯកសារភ្ជាប់៖
> [`DEPLOY_MAC.md`](./DEPLOY_MAC.md) · [`DEPLOY_WINDOWS.md`](./DEPLOY_WINDOWS.md) ·
> [`BACKUP.md`](./BACKUP.md) · [`SECURITY.md`](./SECURITY.md) ·
> [`manual/08-administrator-guide.md`](./manual/08-administrator-guide.md) (ឯកសារយោង RBDC)

---

## តារាងមាតិកា

1. [អ្វីជា RentManager](#1-អ្វីជា-rentmanager)
2. [ស្ថាបត្យកម្មប្រព័ន្ធ និងសេវា](#2-ស្ថាបត្យកម្មប្រព័ន្ធ-និងសេវា)
3. [ការចូលលើកដំបូង និងគណនី admin](#3-ការចូលលើកដំបូង-និងគណនី-admin)
4. [តួនាទី, សិទ្ធិ និង RBDC](#4-តួនាទី-សិទ្ធិ-និង-rbdc)
5. [នីតិវិធីគ្រប់គ្រងអ្នកប្រើប្រាស់](#5-នីតិវិធីគ្រប់គ្រងអ្នកប្រើប្រាស់)
6. [ការរៀបចំអង្គភាព (លំដាប់មាស)](#6-ការរៀបចំអង្គភាព-លំដាប់មាស)
7. [ឯកសារយោង Settings (M28)](#7-ឯកសារយោង-settings-m28)
8. [ប្រតិបត្តិការអ្នកគ្រប់គ្រងតាម module](#8-ប្រតិបត្តិការអ្នកគ្រប់គ្រងតាម-module)
9. [ការងារតាមកាលវិភាគ (cron)](#9-ការងារតាមកាលវិភាគ-cron)
10. [ការបម្រុងទុក និង restore](#10-ការបម្រុងទុក-និង-restore)
11. [បញ្ជីត្រួតពិនិត្យរឹតបន្តឹងសុវត្ថិភាព](#11-បញ្ជីត្រួតពិនិត្យរឹតបន្តឹងសុវត្ថិភាព)
12. [ការត្រួតពិនិត្យ និង logs](#12-ការត្រួតពិនិត្យ-និង-logs)
13. [ការអាប់ដេតប្រព័ន្ធ](#13-ការអាប់ដេតប្រព័ន្ធ)
14. [ការដោះស្រាយបញ្ហាសម្រាប់ admin](#14-ការដោះស្រាយបញ្ហាសម្រាប់-admin)
15. [បញ្ជីត្រួតពិនិត្យ go-live](#15-បញ្ជីត្រួតពិនិត្យ-go-live)

---

## 1. អ្វីជា RentManager

RentManager ជា **វេទិកាប្រតិបត្តិការអចលនទ្រព្យជួល និង co-living**៖ ប្រព័ន្ធតែមួយ
សម្រាប់បន្ទប់, កិច្ចសន្យាជួល, ការបញ្ចេញវិក្កយបត្រ, ការទូទាត់, ប្រាក់កក់,
ទឹកអគ្គិសនី, ការជួសជុល, ចំណាយ, POS/ហាង, ស្តុក, វត្តមាន, របាយការណ៍ម្ចាស់,
របាយការណ៍ និង portals សម្រាប់អ្នកជួល/ម្ចាស់ — ជាមួយការជូនដំណឹង Telegram។

ការពិតសំខាន់ៗដែល admin ត្រូវដឹង៖

| ការពិត | ព័ត៌មានលម្អិត |
|---|---|
| គំរូអង្គភាព | អង្គភាពតែមួយ, **multi-property** (Property → Building → Floor → Room → Bed)។ Property ជាឯកតាកំណត់វិសាលភាព — គ្មាន entity "សាខា" ដាច់ដោយឡែកទេ។ |
| លុយ | រូបិយប័ណ្ណអង្គភាពតែមួយ រក្សាទុកជា **integer minor units** (សេន)។ កំណត់រូបិយប័ណ្ណម្តងនៅពេល go-live — មិនគាំទ្រការផ្លាស់ប្តូរពេលក្រោយទេ។ |
| សៀវភៅកត់ត្រា (Ledger) | គណនេយ្យ double-entry፤ លុយធ្វើចលនាតែតាមការ post មានតុល្យភាព។ ការកែតម្រូវប្រើ **reversals** (credit note / void / refund) — ប្រវត្តិមិនត្រូវបានសរសេរជាន់ទេ។ |
| សិទ្ធិ | **RBDC**៖ ទំព័រនីមួយៗ *និង* API call នីមួយៗត្រូវបានពិនិត្យលើ server ដោយ resolver តែមួយ៖ `can(user, action, module, resource?)`។ UI លាក់ប៊ូតុង ប៉ុន្តែ API ជាច្រកពិត។ |
| Audit | **រាល់ mutation** សរសេរ audit row មាន hash-chain (អ្នកធ្វើ, ពេលវេលា, before/after JSON, IP)។ Trail អាចផ្ទៀងផ្ទាត់បាន និង **មិនត្រូវបានលុបចោលឡើយ**។ |
| ភាសា | UI ប្តូរបានរវាង **អង់គ្លេស, ខ្មែរ, ចិន (中文)** តាម browser (ប៊ូតុង 🌐) ជាមួយលំនាំដើមអង្គភាពក្នុង Settings → Locale។ |
| ប្រភពការពិត | [`INTENT.md`](../INTENT.md) + code + `prisma/schema.prisma`។ មគ្គុទ្ទេសក៍ក្នុង app រៀបរាប់តែអ្វីដែលមានពិត។ |

---

## 2. ស្ថាបត្យកម្មប្រព័ន្ធ និងសេវា

### 2.1 សមាសធាតុ

```
                    ┌──────────────────────────────┐
                    │  Browser: staff / portal     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
  :3000             │  rentmanager (Next.js 15)    │  ← app មេ, UI + APIs ទាំងអស់
                    │  Prisma → PostgreSQL         │
                    └──────┬───────────────┬───────┘
                           │               │ /api/* (migrated prefixes)
                           ▼               ▼
                    ┌────────────┐  ┌──────────────────────┐
                    │ PostgreSQL │  │ gateway :8080        │  ← Spring Cloud
                    │ :5432      │  │ 8 Spring Boot svcs   │
                    └────────────┘  │ :8081–:8088          │
                           ┌────────┴──────────────────────┤
                           │ Nacos :8848 · Keycloak :7080  │
                           │ Kafka :9092 · Redis :6379    │
                           │ MinIO :9000/:9001 (files)    │
                           │ Grafana :9090 · Kafka UI     │
                           └───────────────────────────────┘
```

### 2.2 ផែនទី port ពេញលេញ (លំនាំដើម `docker-compose.yml`)

| សេវា | URL | Login (លំនាំដើម — ប្តូរក្នុង prod!) |
|---|---|---|
| **App (Next.js)** | http://localhost:3000 | គណនីសាកល្បងខាងក្រោម (§3) |
| API Gateway | http://localhost:8080 | — |
| Swagger (APIs ទាំងអស់) | http://localhost:8080/swagger-ui.html | — |
| Identity :8081 · Property :8082 · Billing :8083 · Ops :8084 · Staff :8085 · Commerce :8086 · Notification :8087 · Report :8088 | `http://localhost:808x/actuator/health` | — |
| Nacos console | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak admin | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO console (files) | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana dashboards | http://localhost:9090 | `admin` / `admin` |
| PostgreSQL | `localhost:5432` | `rentmanager` / `rentmanager` |
| Redis | `localhost:6379` | ពាក្យសម្ងាត់ `rentmanager-redis-secret` |

> ឯកសារ compose កំណត់ secrets សម្រាប់ demo/dev តាម environment ជាមួយ fallback
> `-default`។ សម្រាប់ការប្រើប្រាស់លើសពី demo ក្នុងម៉ាស៊ីន សូមប្តូរ secret
> **ទាំងអស់** — មើល §11។

### 2.3 ទិន្នន័យនៅទីណា

| ទិន្នន័យ | ទីតាំង |
|---|---|
| ទិន្នន័យអាជីវកម្មទាំងអស់ | PostgreSQL (DB `rentmanager`)។ Migrations ជា **additive-only**፤ snapshots អាច migrate ទៅមុខជានិច្ច។ |
| ឯកសារ/បង្កាន់ដៃ/PDF | Object storage អនុលោម S3 (MinIO ក្នុង Docker፤ S3 ណាក៏បានពេលកំណត់ `S3_*` env፤ ថាសក្នុងម៉ាស៊ីនបើមិនដូច្នោះ)។ **បម្រុងទុក bucket ដាច់ដោយឡែក** ក្នុង production។ |
| ការបម្រុងទុក DB | `/app/backups` ក្នុង container → Docker volume `rentmanager-backups` (ផ្លូវ host គ្រប់គ្រងដោយ Docker)។ |
| Sessions | ក្នុង DB, អាច revoke បាន, httpOnly cookies (`SESSION_TTL_DAYS` លំនាំដើម 30)។ |
| Secrets ដែលបានបិទ | Settings → Providers secrets ត្រូវបានអ៊ិនគ្រីប AES-256-GCM (`SETTINGS_ENC_KEY`)፤ env vars ជា fallback។ |

---

## 3. ការចូលលើកដំបូង និងគណនី admin

បន្ទាប់ពី deploy (មើល `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`) សូមបើក
**http://localhost:3000/login**។ Database ត្រូវបាន seed ដោយស្វ័យប្រវត្តិ
(idempotent — មានសុវត្ថិភាពពេល restart នីមួយៗ)។

### 3.1 គណនី seed (ពាក្យសម្ងាត់៖ `Demo1234!`)

| អ៊ីមែល | តួនាទី | ប្រើដើម្បីរៀន |
|---|---|---|
| `root@demo.test` | **Super Admin** | ទាំងអស់រួមទាំង deletes, voids, RBDC config |
| `admin@demo.test` | **Admin** | អង្គភាពទាំងមូល፤ គ្មានសកម្មភាពបំផ្លិចបំផ្លាញ/config |
| `pm@demo.test` | **Property Manager** | បានចាត់ឲ្យ **BLR តែមួយ** — មើល scoping លាក់ properties ផ្សេង |
| `accountant@demo.test` | **Accountant** | modules ហិរញ្ញវត្ថុ (rent engine, ledger, payments, statements) |
| `staff@demo.test` | **Staff** | សរសេរប្រតិបត្តិការ front-desk |
| `owner@demo.test` | **Owner** | មាន Building A (BLR) — ឃើញតែ property/records ខ្លួនឯង |
| `owner2@demo.test` | **Owner** | មាន Villa Main (RV) — សាកល្បង cross-owner denial |
| `member@demo.test` | Member | tenant portal (`/portal`, OTP login) |

### 3.2 រឿងដំបូងដែលត្រូវធ្វើជា Super Admin

1. ចូលជា `root@demo.test`។
2. ចុះឈ្មោះ **2FA** (តម្រូវសម្រាប់ Admin+)៖ Account → Security → រៀបចំ TOTP
   ជាមួយ authenticator app។ មាន login-challenge flow ដែលបានចុះហត្ថលេខាផង។
3. បង្កើត **Super Admin ពិត** សម្រាប់ខ្លួនអ្នក (Admin → Users → New user),
   ចូលជាអ្នកប្រើនោះ ហើយ **បិទ ឬប្តូរពាក្យសម្ងាត់គណនីសាកល្បង**
   មុនប្រើ production។
4. ទៅ **Admin → Settings** ហើយកំណត់ Org, Locale (currency/timezone/
   language), Billing និង Secrets (§7)។
5. ផ្ទៀងផ្ទាត់ថា **Admin → Audit Log** កំពុងកត់ត្រា ហើយដំណើរការ **Verify audit chain**។

> ⚠️ **ទិន្នន័យសាកល្បងសម្រាប់តែការបណ្តុះបណ្តាល។** សម្រាប់ production សូម deploy
> ថ្មី, ប្តូរ secrets ទាំងអស់ (§11), ហើយលុប rows សាកល្បង ឬ seed org ទទេ — កុំ
> ដំណើរការលុយពិតលើទិន្នន័យ `*@demo.test`។

---

## 4. តួនាទី, សិទ្ធិ និង RBDC

### 4.1 គំរូ (អានម្តង ប្រើជារៀងរហូត)

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

### 4.2 តួនាទីលំនាំដើម និងម៉ាទ្រីស

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

### 4.3 បង្កើត custom role (ឧទាហរណ៍៖ Cashier)

1. **Admin → Roles → New role** → ដាក់ឈ្មោះ `Cashier`។
2. ធីក grid៖ **M09 (Payments)** → សរសេរប្រតិបត្តិការនៅ scope **PROPERTY**፤ ទុកអ្វីផ្សេងទៀតបិទ។
3. ចាត់ role ទៅអ្នកប្រើ cashier + ចាត់ **property** របស់ពួកគេ។
4. លទ្ធផល៖ ពួកគេអាចកត់ត្រាការទូទាត់ ប៉ុន្តែ **មិនអាចបើក invoices ដើម្បីកែ** —
   API ត្រឡប់ `403`។ (ករណីពិតប្រាកដនេះត្រូវបានគ្របដណ្តប់ដោយ CI negative tests។)

### 4.4 សិទ្ធិរបាយការណ៍

របាយការណ៍ជា **M26**។ បន្ថែមទៀត, **Settings → Reports** គ្រប់គ្រង៖
`enabledKeys` (របាយការណ៍ណាខ្លះមាន), `assignments` (roles/users ណាឃើញមួយណា),
`designs` (columns/branding)។ ទិន្នន័យរបាយការណ៍មិនអាចកែបានឡើយ។

### 4.5 វិធានសុវត្ថិភាព

- Least privilege តាមលំនាំដើម፤ សិទ្ធិមានប្រសិទ្ធភាពជាសហភាពនៃ roles ទាំងអស់។
- Role ដែល**កំពុងប្រើមិនអាចលុបបាន**፤ role Super Admin ត្រូវបានការពារ។
- រាល់ការផ្លាស់ប្តូរ role/permission ត្រូវ**បាន audit**፤ ម៉ាទ្រីសក៏ត្រូវ
  snapshot-test ក្នុង CI ដូច្នេះសិទ្ធិមិនអាចពង្រីកដោយស្ងាត់ស្ងៀម។

---

## 5. នីតិវិធីគ្រប់គ្រងអ្នកប្រើប្រាស់

**ទីតាំង៖** Admin → Users (M01)។

### 5.1 ទទួលបុគ្គលិកថ្មី

1. **Users → New user** → ឈ្មោះ, **អ៊ីមែល**, ពាក្យសម្ងាត់បណ្តោះអាសន្ន។
2. គណនីត្រូវបានបង្កើតជាមួយ `mustChangePassword = true` → បង្ខំឲ្យផ្លាស់ប្តូរពេលចូលលើកដំបូង។
3. ចាត់ **role(s)** (least privilege፤ §4)។
4. ចាត់ **properties** (តម្រូវសម្រាប់ PROPERTY-scoped roles)។
5. ប្រាប់ពួកគេ URL + ពាក្យសម្ងាត់បណ្តោះអាសន្ន፤ Admin+ ត្រូវចុះឈ្មោះ **2FA** ផង។

### 5.2 បញ្ចប់បុគ្គលិក (ធ្វើទាំងបួន)

1. **បិទ** អ្នកប្រើ (`status = disabled`) — រារាំងការចូលភ្លាមៗ។
2. **Revoke sessions** — បង្ខំឲ្យចេញពី devices ទាំងអស់។
3. **Reset 2FA** ប្រសិនបើអ្នកបើកឡើងវិញសម្រាប់ handover (ដើម្បីឲ្យ codes ចាស់ស្លាប់)។
4. ពិនិត្យ **Audit Log** filter តាម actor នោះសម្រាប់ការពិនិត្យចុងក្រោយ។

### 5.3 "ភ្លេចពាក្យសម្ងាត់" / បាត់ទូរស័ព្ទ

- **គ្មាន** self-service email reset ក្នុង build នេះ — admin កំណត់ពាក្យសម្ងាត់បណ្តោះអាសន្ន (បើក must-change ម្តងទៀត)។
- បាត់ authenticator៖ admin ធ្វើ **2FA reset** (M27) ដើម្បីឲ្យអ្នកប្រើចុះឈ្មោះឡើងវិញ។

---

## 6. ការរៀបចំអង្គភាព (លំដាប់មាស)

អនុវត្តតាមលំដាប់នេះសម្រាប់ property/company ថ្មី — ជំហាននីមួយៗបើកជំហានបន្ទាប់៖

| # | ជំហាន | ទីតាំង |
|---|---|---|
| 1 | Company/org៖ ឈ្មោះផ្លូវច្បាប់, រូបិយប័ណ្ណ, timezone, ភាសា | Settings → Org / Locale |
| 2 | រចនាសម្ព័ន្ធ៖ **properties → buildings → floors → rooms → beds** | Properties (M04) |
| 3 | Roles & users፤ ចាត់ roles + properties | Admin → Roles, Users (M01) |
| 4 | Rent engine៖ plans, late-fee, tax, discounts | Rent Engine (M06), Settings → Billing/Late fee |
| 5 | សមតុល្យបើកគណនេយ្យ (បើ migrating ចូល) | Settings → Opening balances (ការ post `opening` មានតុល្យភាព) |
| 6 | វិធីទូទាត់ + provider secrets | Settings → Secrets |
| 7 | Billing/dunning + rent alerts | Settings → Billing, Alerts (M33) |
| 8 | Owners + owner contracts + payout methods | Owners (M03), Owner Contracts, M24 |
| 9 | ការជូនដំណឹង៖ templates + Telegram bot token + linking | Settings → Templates/Telegram, Telegram (M21) |
| 10 | សុវត្ថិភាព៖ 2FA សម្រាប់ Admin+, sessions, rate limits | Account → Security, §11 |
| 11 | Feature flags + report assignments | Settings → Features / Reports |
| 12 | សាកល្បង end-to-end (lease → invoice → payment → receipt) | — |
| 13 | ពិនិត្យ audit + កំណត់កាលវិភាគ **backup** | Admin → Audit, §9–§10 |

ព័ត៌មានលម្អិតតាមផ្នែកនៅក្នុង `docs/manual/` ផ្នែក 3–7។

---

## 7. ឯកសារយោង Settings (M28)

**ទីតាំង៖** Admin → Settings។ ការផ្លាស់ប្តូរទាំងអស់ត្រូវ**បាន audit**፤ settings
ហិរញ្ញវត្ថុអនុវត្ត **forward-only** (ប្រវត្តិដែលបាន post មិនត្រូវបានសរសេរជាន់ឡើយ)។

| ក្រុម | គ្រប់គ្រង | កំណត់ចំណាំ admin |
|---|---|---|
| **Org** | ឈ្មោះផ្លូវច្បាប់, អាសយដ្ឋាន, ទូរស័ព្ទ, អ៊ីមែល, website, tax ID, logo, invoice footer, PDF template (classic/modern) | Branding លើ PDF/បង្កាន់ដៃនីមួយៗ។ រក្សាឈ្មោះផ្លូវច្បាប់ & tax ID ឲ្យត្រឹមត្រូវ។ |
| **Locale** | រូបិយប័ណ្ណ, timezone, ភាសា UI (en/km/zh) | ⚠️ កំណត់ **រូបិយប័ណ្ណម្តង** នៅ go-live፤ មិនអាចផ្លាស់ប្តូរបន្ទាប់ពីមានទិន្នន័យ។ |
| **Billing** | Invoice prefix, grace days (លំនាំដើម **3**), dunning days (**[3,7,14]**) | ជំរុញ numbering + ពេល reminders/late fees ចាប់ផ្តើម។ Forward-only។ |
| **Late fee** | Mode none/flat/percent, ចំនួន flat, % ប្រចាំខែ (bp), cap | បិទតាមលំនាំដើម។ ពេលបើក ត្រូវកំណត់ **cap** ជានិច្ច — fees មិនលើសចំនួនជំពាក់។ |
| **Retention** | outbox 90d, events 365d, OTP 7d, session 30d | **Audit trail មិនត្រូវបានលុបឡើយ។** |
| **Features** | Flags តាម module (POS, Stock, Telegram, PO បើកតាមលំនាំដើម) | បិទលាក់ menu + gate access፤ **ទិន្នន័យនៅដដែល**។ |
| **Reports** | enabledKeys, assignments, designs | អ្នកណាឃើញរបាយការណ៍ណា፤ ទិន្នន័យនៅ source-backed។ |
| **Templates** | Telegram overrides, 5 events, `{placeholders}` | ពាក្យ issued / receipt / dunning / reminder / overdue។ |
| **Printers** | 58/80mm, auto-print, copies, barcode default | បោះពុម្ព POS receipt/label។ |
| **Telegram** | ឈ្មោះ Bot, សារស្វាគមន៍, member self-link | ឥរិយាបថ tenant bot។ |
| **Menu** | Sidebar ខាង (left/right) | ចំណូលចិត្ត layout តែប៉ុណ្ណោះ — ភាពមើលឃើញមកពីសិទ្ធិ។ |
| **Units / Table** | Units ស្តុក፤ page size លំនាំដើម (25) | ដង់ស៊ីតេ list + units items។ |
| **Alerts (M33)** | ahead days (3), overdue days (1) | Windows due-soon/overdue របស់ dashboard។ |
| **Secrets** | Payment creds, Telegram token | **បិទទុក AES-256-GCM**, masked reads፤ env vars = fallback។ កុំ paste secrets ក្នុង chat។ |
| **Opening balances** | ការ post ledger `opening` មានតុល្យភាព | សម្រាប់ migration ចូល RentManager፤ ត្រូវមានតុល្យភាព។ |

### Environment variables (server-side)

| Variable | គោលបំណង | លំនាំដើម (dev) |
|---|---|---|
| `DATABASE_URL` | ការតភ្ជាប់ PostgreSQL | `postgresql://rentmanager:rentmanager@localhost:5432/rentmanager` |
| `SESSION_TTL_DAYS` | អាយុ Session | `30` |
| `FILE_SIGNING_SECRET` | Signed file URLs | តម្លៃ dev ចៃដន្យក្នុង `.env` |
| `PAYMENT_WEBHOOK_SECRET` | Gateway webhook HMAC | `dev-webhook-secret-change-me` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `TELEGRAM_BOT_USERNAME` | Telegram bot | placeholders `dev-*` |
| `SETTINGS_ENC_KEY` | អ៊ិនគ្រីប sealed-settings (32-byte) | ត្រូវកំណត់ក្នុង prod |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage | MinIO ក្នុង Docker |
| `APP_BASE_URL` | Public base URL (links ក្នុង PDFs/messages) | `http://localhost:3000` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO console + S3 | `rentmanager` / `rentmanager-s3-secret` |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana | `admin` / `admin` |
| `COOKIE_SECURE` | Secure cookies | `false` ក្នុងម៉ាស៊ីន → **`true`** ក្រោយ HTTPS |
| `SEED_FULL_DEMO` | Seed ទិន្នន័យសាកល្បងពេញលេញ | `1` ក្នុង Docker |

ចម្លង `.env.example` → `.env` សម្រាប់ local runs፤ ក្នុង Docker ឯកសារ compose
បញ្ចូលតម្លៃ production-style — override secrets តាម shell env ឬ
`docker-compose.override.yml` (កុំ commit secrets ពិត)។

---

## 8. ប្រតិបត្តិការអ្នកគ្រប់គ្រងតាម module

របៀបធ្វើប្រចាំថ្ងៃនៅក្នុង `manual/03-user-guide.md`፤ នេះជា**ទស្សនៈ admin**៖
អ្វីត្រូវកំណត់, អនុម័ត និងតាមដានតាម module។

### M04 Properties & rooms
- រៀបចំ rooms ឲ្យត្រឹមត្រូវតាំងពីដំបូង (type, floor, rent)។ **Status machine
  របស់ room ត្រូវបានអនុវត្ត** (available → occupied → cleaning → available…)፤
  staff មិនអាចរំលង states — moves/leases ប្តូរ statuses ដោយស្វ័យប្រវត្តិ។
- Buildings អាចមាន **map coordinates + geofence radius** សម្រាប់ kiosk attendance។

### M05 Leases · M16 Room moves
- Lease activation បញ្ចេញ **deposit invoice** ដោយស្វ័យប្រវត្តិ (M10)។
- **Move-out inspection (M18) ជា hard gate** សម្រាប់បញ្ចប់ lease។
- Room move = request → approve → execute៖ lease ចាស់បញ្ចប់, lease ថ្មីចាប់ផ្តើម,
  deposit តាម member, **adjustment invoice តែមួយ** net ភាពខុសគ្នា prorated។
  កុំកែ leases ពីរដោយដៃដើម្បីក្លែង move។

### M06 Rent engine · M07 Invoices
- Job `invoice-generation` ប្រចាំខែ (តាម billing day) + `billing-daily`
  catch-up ប្រចាំថ្ងៃ។ Suspends ពាក់កណ្តាលខែ **prorate**፤ fixed services ជិះតាម engine។
- លេខ Invoice មកពី `number_sequences` + Settings prefix — gaps ជារឿងធម្មតា
  (idempotent retries), duplicates មិនអាចកើត។

### M08 Ledger
- Accountants ជាម្ចាស់។ ព្រឹត្តិការណ៍លុយនីមួយៗ post entries មានតុល្យភាព፤ voids
  និង refunds post **reversals** មិនកែទេ។ P&L និងរបាយការណ៍អាន ledger,
  ដូច្នេះ "register ↔ ledger" ត្រូវ reconcile ពិតប្រាកដ — បើរបាយការណ៍មិនត្រូវគ្នា
  សូមស៊ើបអង្កេត postings មិនមែនរបាយការណ៍។

### M09 Payments · M13 QR
- វិធី៖ cash / bank transfer / QR / card / cheque។ Machine៖
  `pending → confirmed → refunded | failed`។
- **Allocations ជា oldest-first** (due date បន្ទាប់មក period) និង immutable፤
  overpayments ក្លាយជា **member credit** (Accountant អាច refund ជាមួយ payout
  ledger-reversed)។
- Webhooks **បានចុះហត្ថលេខា + idempotent** — gateway notifications ស្ទួនត្រូវបាន
  មិនអើពើ មិន post ទ្វេដងឡើយ។ បង្កាន់ដៃ (`RCP-…`) auto-file ជា PDFs។
- ទំព័រ `/pay` សាធារណៈ៖ exact-due-only, rate-limited, គ្មាន login។

### M10 Deposits
- បញ្ចេញពេល lease activation፤ deductions ត្រូវបានស្នើពី move-out
  inspection findings និង **អនុម័តក្នុង M10**፤ payouts reverse តាម ledger។

### M11 Utilities · M12 Services
- Meters តាម room (electric/water/gas) ភាពជាក់លាក់ milli-unit፤ estimated =
  មធ្យម 3 លើកចុងក្រោយ፤ គាំទ្រ CSV import។ Tiered tariffs፤ charges ភ្ជាប់ទៅ
  **cycle បន្ទាប់ដោយស្វ័យប្រវត្តិ**፤ spikes >2×-average flag ជា anomalies។
- Services៖ fixed-monthly (prorate ពេល suspend) vs per-use (one-time lines)។
  Parking slots ជា unique፤ WiFi accounts តាម lease។

### M14 POS · M15 Stock · M29 Purchase orders
- POS sessions៖ opening float → expected = float + Σ cash → counted
  variance ពេល close។ **Charge-to-room** ចេញ one-time invoice + AR posting។
- Stock movements ជា **append-only** (purchase/sale/consumption/
  maintenance_use/adjustment/transfer) ជាមួយ moving-average cost។
  **Stocktakes post variance adjustments** — នោះជាផ្លូវកែតម្រូវ មិនមែន edits។
- Low-stock alerts ទៅ staff (និង Telegram បើបានភ្ជាប់)។

### M18 Inspections · M19 Maintenance · M22 Complaints
- Checklist templates តាម room type፤ move-out inspection gate ការបញ្ចប់ lease፤
  damage findings → deposit deductions ឬ tickets។
- Tickets៖ open → assigned → in_progress → resolved → verified/closed ជាមួយ
  SLA តាម priority (urgent 4h … low 168h) + daily breach sweep។ Costs ទៅ
  expense ឬ owner P&L។
- Complaints៖ thread + SLA + member-confirmed close ជាមួយ rating 1–5፤
  ប្តូរទៅ ticket ដោយមួយចុច។

### M20 Expenses & P&L
- Vendor expenses + receipt attachments፤ **អនុម័តលើស threshold ដែលអាចកំណត់**
  (auto-approve ខាងក្រោម፤ Accountant+ gate)፤ voids reverse។
  Monthly budgets ជាមួយ variance፤ recurring templates፤ P&L តាម property និង
  consolidated ពី ledger។

### M23 Attendance
- Kiosk-PIN + mobile clock in/out, optional property geofence, shift
  templates ជាមួយ grace + OT multipliers፤ exceptions (late/early/missed
  punch/overtime/geofence) ជាមួយ audited resolution፤ monthly summary + CSV
  payroll export។

### M24 Owner statements
- Monthly generation job (payout day, force bypass, idempotent តាម
  contract+month)។ រូបមន្ត៖ collected × share | fixed master rent −
  management fee − pass-through − owner maintenance ± audited adjustments។
- `draft → approved → paid`፤ approval accrues DR 3900 / CR 2200, payout
  DR 2200 / CR cash|bank។ PDFs auto-file፤ owners អានវាក្នុង portal។
  Generation gate ទៅ Accountant+ (GLOBAL M24:update)។

### M25 Tenant portal · M21 Telegram
- Portal (`/portal`, mobile PWA)៖ OTP login (hashed single-use codes,
  lockout) materializes member's User (role MEMBER) — scope **OWN ដាច់ខាត**
  លើ module APIs ដដែល។ គ្មាន business logic ស្ទួន។
- Telegram៖ signed webhook (spoofs ត្រូវបានបដិសេធ), one-time link codes, commands
  `/status /dues /pay /help` (own data តែប៉ុណ្ណោះ), event→template dispatcher ជាមួយ
  per-user toggles។ Dev token = mocked sender ជាមួយ full outbox។

### M26 Reports
- 12 របាយការណ៍ + dashboard KPI strip (occupancy %, billed vs collected,
  arrears, open tickets, cash position)។ របាយការណ៍នីមួយៗប្រកាស source
  line របស់វា፤ arrears aging ត្រូវស្មើ outstanding invoice totals។ CSV (RFC-4180)
  + branded PDF export፤ filter តាម date + property។

---

## 9. ការងារតាមកាលវិភាគ (cron)

Job endpoints មានរាងជា cron — ហៅវាតាមកាលវិភាគក្នុង production ជាមួយ
Admin session/token។ Runs ទាំងអស់ត្រូវបាន audit។

| ការងារ | Endpoint | កាលវិភាគធម្មតា | ត្រូវការ |
|---|---|---|---|
| `invoice-generation` | `POST /api/jobs/invoice-generation` | ប្រចាំខែ តាម billing day | M07:create |
| `billing-daily` | `POST /api/jobs/billing-daily` | ប្រចាំថ្ងៃ ~01:00 | M06:update |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | ប្រចាំថ្ងៃ ~06:00 | M33:update |
| `statement-generation` | `POST /api/jobs/statement-generation` | ប្រចាំខែ តាម payout day | GLOBAL M24:update |
| `telegram-dispatch` | `POST /api/jobs/telegram-dispatch` | ប្រចាំថ្ងៃ (ឬម៉ោង) | M21:update |
| `sla-sweep` | `POST /api/jobs/sla-sweep` | ប្រចាំថ្ងៃ | M19:update |
| `attendance-sweep` | `POST /api/jobs/attendance-sweep` | ប្រចាំថ្ងៃ | M23:update |
| `retention` | `POST /api/jobs/retention` | ប្រចាំថ្ងៃ/សប្តាហ៍ | M28:update |
| `backup` | `POST /api/jobs/backup` | **រៀងរាល់យប់** | M27:update |

ឧទាហរណ៍ (macOS/Linux cron — server ត្រូវ reachable፤ ប្រើ service account
cookie/token)៖

```bash
# RentManager nightly jobs (server-local cron)
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup          -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts     -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

លើ Windows ប្រើ **Task Scheduler** → "Run a program" →
`powershell.exe -File C:\RentManager\jobs\invoke-jobs.ps1` ជាមួយ
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`
សមមូល។ មើល `DEPLOY_WINDOWS.md` §"Scheduled jobs"។

> ចូលចិត្ត **dedicated service account** (role Admin, ពាក្យសម្ងាត់ចៃដន្យវែង,
> 2FA បានចុះឈ្មោះ, credentials ក្នុង server vault) ជាងគណនីផ្ទាល់ខ្លួនណា។

---

## 10. ការបម្រុងទុក និង restore

Runbook ពេញលេញ៖ [`BACKUP.md`](./BACKUP.md)។ សង្ខេបសម្រាប់ admins៖

- **អ្វី៖** full PostgreSQL dump ស៊ីសង្វាក់គ្នាតាម `pg_dump` (custom format),
  មានសុវត្ថិភាពលើ live server។ Uploads នៅ object storage — **បម្រុងទុក
  bucket ដាច់ដោយឡែក** ជាមួយ provider tooling។
- **ទីណា៖** `backups/backup-<timestamp>.dump` (ឬ `$BACKUP_DIR`)፤ ផ្លូវ container
  `/app/backups` → volume `rentmanager-backups`។ រក្សា **7** ថ្មីបំផុត។
- **Restore (លំដាប់សំខាន់)៖**
  1. `docker compose stop rentmanager`
  2. `createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump` ចង្អុល `DATABASE_URL` ទៅវា
  3. `npx prisma migrate deploy` (forward-only, មានសុវត្ថិភាពជានិច្ច)
  4. Restart បន្ទាប់មកផ្ទៀងផ្ទាត់៖ `GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · របាយការណ៍ collections reconcile
- **RPO/RTO៖** nightly snapshots ⇒ RPO ≤24h។ Test-restore ប្រចាំត្រីមាស፤
  backup ដែលមិនបានសាកល្បងមិនមែន backup ទេ។

---

## 11. បញ្ជីត្រួតពិនិត្យរឹតបន្តឹងសុវត្ថិភាព

មូលដ្ឋានមានក្នុង build រួចហើយ៖ scrypt passwords, DB revocable sessions,
httpOnly cookies, rate-limited login, TOTP 2FA (តម្រូវ Admin+), signed
login challenges, tamper-evident audit hash chain ជាមួយ PII masking, CSP +
security headers, sealed provider secrets, S3 signed URLs ជាមួយ short TTL។
(មើល `manual/09-security-guide.md` + `SECURITY.md`។)

មុន production, admin ត្រូវ៖

- [ ] ប្តូរ default secret **ទាំងអស់**៖ `FILE_SIGNING_SECRET`,
      `PAYMENT_WEBHOOK_SECRET`, `SETTINGS_ENC_KEY` (32+ random bytes),
      `TELEGRAM_WEBHOOK_SECRET`, DB password, Redis password,
      MinIO root password, Grafana admin, Nacos/Keycloak admins។
- [ ] បិទ ឬប្តូរពាក្យសម្ងាត់ **គណនី `*@demo.test` ទាំងអស់**፤ បង្កើត real
      admins፤ ចុះឈ្មោះ **2FA** សម្រាប់ Admin+ នីមួយៗ។
- [ ] កំណត់ `COOKIE_SECURE=true` និង serve **HTTPS តែប៉ុណ្ណោះ** (reverse proxy៖
      Caddy/Nginx/Traefik ជាមួយ TLS፤ `APP_BASE_URL` = public https URL)។
- [ ] Bind internal ports (5432, 6379, 8848, 7080, 9092, 9000…) ទៅ
      localhost ឬ private network — កុំ expose DB/Redis/Kafka ទៅ internet។
- [ ] ផ្ទៀងផ្ទាត់ **rate limits** លើ auth + webhooks፤ បញ្ជាក់ថា Telegram/Payment
      webhooks បដិសេធ signatures មិនត្រឹមត្រូវ (spoof test)។
- [ ] ដំណើរការ **Verify audit chain**፤ បញ្ជាក់ PII masking ក្នុង logs។
- [ ] កំណត់កាលវិភាគ **nightly backup** + offsite copy፤ test-restore ម្តងមុន go-live។
- [ ] កំណត់ retention policy፤ បញ្ជាក់ថា audit មិនរាប់ក្នុង purge។
- [ ] ពិនិត្យ **permission matrix** (§4.2) ធៀប org chart របស់អ្នក፤ លុប
      role grants ដែលមិនប្រើ (least privilege)។
- [ ] Penetration self-check៖ cross-property IDOR, privilege escalation,
      webhook spoofing, URL guessing, public `/pay` exact-due enforcement។

---

## 12. ការត្រួតពិនិត្យ និង logs

| សញ្ញា | របៀប |
|---|---|
| App health | `GET /api/health` → 200 + DB `SELECT 1` (ប្រើដោយ Docker healthcheck) |
| Backend health | `GET http://localhost:808x/actuator/health` តាម service፤ gateway aggregates |
| Audit integrity | `GET /api/audit/verify` → `{ ok: true }` |
| Books reconcile | របាយការណ៍ collections/arrears `summary.reconciles == "yes"` |
| Dashboards | Grafana http://localhost:9090 (provisioned per-service dashboards) |
| Container status | `docker compose ps` · `npm run docker:status` |
| Logs | `docker compose logs -f rentmanager` · `docker compose logs -f gateway` |
| Kafka | Kafka UI http://localhost:8090 |
| Files | MinIO console http://localhost:9001 |

ស៊ើបអង្កេតប្រតិបត្តិការខុស៖ **Audit Log** → filter actor/date/entity →
ប្រៀបធៀប before/after → trace invoice/ledger ដែលភ្ជាប់ → កែជាមួយ
**reversal** ត្រឹមត្រូវ (credit note / void / refund)។ កុំកែ records
ដែលបាន post ដោយដៃ។

---

## 13. ការអាប់ដេតប្រព័ន្ធ

```bash
# 1. Snapshot ជាមុន (backup job ឬ volume backup)
# 2. Pull + rebuild + restart
git pull
docker compose up --build -d
# 3. Migrations ដំណើរការដោយស្វ័យប្រវត្តិក្នុង entrypoint፤ ផ្ទៀងផ្ទាត់៖
curl -sf http://localhost:3000/api/health
docker compose ps
```

- Migrations ជា **append-only** — មានសុវត្ថិភាពពេលអនុវត្តលើ snapshots ចាស់ៗ፤
  rollbacks មិនត្រូវបានព្យាយាម (restore ពី backup បើអ្នកត្រូវត្រឡប់)។
- មើល `docker compose logs -f rentmanager` លើ boot លើកដំបូងបន្ទាប់ពី update។
- Pin image tags / commit SHAs សម្រាប់ production ដើម្បីឲ្យ updates មានចេតនា។

---

## 14. ការដោះស្រាយបញ្ហាសម្រាប់ admin

| រោគសញ្ញា | មូលហេតុដែលទំនងបំផុត → ដំណោះស្រាយ |
|---|---|
| App 500s / មិនចាប់ផ្តើម | DB មិនទាន់រួចរាល់ → `docker compose ps` ពិនិត្យ `postgres` healthy፤ បន្ទាប់មក `docker compose logs rentmanager` (entrypoint រង់ចាំ + migrates + seeds — អាន log tail) |
| Login បរាជ័យសម្រាប់អ្នកទាំងអស់ | Session/cookie domain ឬ `DATABASE_URL` ខុស፤ ពិនិត្យ env + `/api/health` |
| `403 FORBIDDEN` លើសកម្មភាព | RBDC denial ត្រឹមត្រូវ → ពិនិត្យ roles + scopes + property assignments របស់អ្នកប្រើ (§4–§5) |
| Menu item បាត់ | គ្មាន `read` លើ module នោះ ឬ feature flag បិទក្នុង Settings → Features |
| Invoice job មិនដំណើរការ | Cron/Task Scheduler មិន fire ឬប្រើ cookie ផុតកំណត់ → ពិនិត្យ job audit rows + scheduler logs |
| Webhook double-posted | មិនគួរកើត (idempotent) → ផ្ទៀងផ្ទាត់ `PAYMENT_WEBHOOK_SECRET` ត្រូវនឹង gateway config፤ ពិនិត្យ logs |
| Telegram ស្ងាត់ | Bot token/secret ខុស ឬ template បិទ → Settings → Secrets/Templates፤ ពិនិត្យ `telegram-dispatch` runs |
| Audit verify បរាជ័យ | **ឈប់ហើយស៊ើបអង្កេត** — អាចមាន tampering፤ restore ពី backup តែបន្ទាប់ពីរក root cause |
| ថាសពេញ | Docker volumes (DB, MinIO, backups) → prune backups ចាស់ៗ, `docker system df`, ពង្រីក volume |
| Build លើកដំបូងយឺត | ធម្មតា៖ Java services + Next build ត្រូវពេលយូរ፤ ឲ្យ Docker RAM ≥8GB, កុំ pin ទៅ 1 CPU (`NEXT_BUILD_CPUS`) |

បញ្ហាដំឡើងតាម platform → ផ្នែក troubleshooting នៃ `DEPLOY_MAC.md` /
`DEPLOY_WINDOWS.md`។ បញ្ហាអ្នកប្រើប្រាស់ → `manual/10-troubleshooting.md`។

---

## 15. បញ្ជីត្រួតពិនិត្យ go-live

- [ ] Deployment ពណ៌បៃតងលើម៉ាស៊ីនគោលដៅ (ជំហានផ្ទៀងផ្ទាត់ `DEPLOY_*.md` ជោគជ័យ)
- [ ] Items រឹតបន្តឹង §11 ទាំងអស់រួចរាល់
- [ ] Org/Locale/Billing/Late-fee/Alerts បានកំណត់፤ រូបិយប័ណ្ណចុងក្រោយ
- [ ] Properties → buildings → floors → rooms → beds បានបញ្ចូល
- [ ] Real users + roles + property assignments፤ គណនីសាកល្បងបានបិទ
- [ ] Opening balances បាន post (បើ migrating)፤ payment methods + secrets បានកំណត់
- [ ] Owners + contracts + payout methods፤ Telegram បានភ្ជាប់ + ទទួលសារសាកល្បង
- [ ] Jobs §9 ទាំងអស់បានកំណត់កាលវិភាគ និង **test-fire ម្តង** (ពិនិត្យ audit rows)
- [ ] Nightly backup បានកំណត់ + test restore មួយរួចរាល់
- [ ] Staff បានបណ្តុះបណ្តាលលើ golden path៖ lease → invoice → QR/cash payment → receipt → move-out settlement (`manual/13` + `manual/14`)
- [ ] បានបោះពុម្ព៖ admin contact list, backup/restore one-pager, incident process

---

*ចប់មគ្គុទ្ទេសក៍អ្នកគ្រប់គ្រង។ រក្សាឯកសារនេះនៅជាប់នឹងមគ្គុទ្ទេសក៍ deployment
ហើយពិនិត្យវាឡើងវិញបន្ទាប់ពី update ធំនីមួយៗ។*
