# 1. អ្វីជា RentManager

> **សម្រាប់អ្នកណា៖** Super Admin, Admin, បុគ្គលិក IT និងម្ចាស់អាជីវកម្មដែលដំឡើង,
> កំណត់រចនាសម្ព័ន្ធ, ធានាសុវត្ថិភាព និងថែទាំ RentManager។
> **បុគ្គលិកធ្វើការងារប្រចាំថ្ងៃ** (front desk, cashier, manager) គួចាប់ផ្តើមជាមួយ
> **Help & Guide** ក្នុង app (`/guide`) ឬ [`docs/manual/`](../manual/README.md) ជំនួស។
>
> ឯកសារភ្ជាប់៖
> [`DEPLOY_MAC.md`](../DEPLOY_MAC.md) · [`DEPLOY_WINDOWS.md`](../DEPLOY_WINDOWS.md) ·
> [`BACKUP.md`](../BACKUP.md) · [`SECURITY.md`](../SECURITY.md) ·
> [`manual/08-administrator-guide.md`](../manual/08-administrator-guide.md) (ឯកសារយោង RBDC)

---



## ការពិតសំខាន់ៗនៃការរចនា

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
| ប្រភពការពិត | [`INTENT.md`](../../INTENT.md) + code + `prisma/schema.prisma`។ មគ្គុទ្ទេសក៍ក្នុង app រៀបរាប់តែអ្វីដែលមានពិត។ |

---
