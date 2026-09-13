# 3. ការចូលលើកដំបូង និងគណនី admin

បន្ទាប់ពី deploy (មើល `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`) សូមបើក
**http://localhost:3000/login**។ Database ត្រូវបាន seed ដោយស្វ័យប្រវត្តិ
(idempotent — មានសុវត្ថិភាពពេល restart នីមួយៗ)។

## 3.1 គណនី seed (ពាក្យសម្ងាត់៖ `Demo1234!`)

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

## 3.2 រឿងដំបូងដែលត្រូវធ្វើជា Super Admin

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
