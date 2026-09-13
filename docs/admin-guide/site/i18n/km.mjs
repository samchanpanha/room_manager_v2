// Admin-guide site i18n — Khmer. Mirrors en.mjs 1:1
// (same walk ids, same step counts, same diagram keys).

export const meta = {
  code: "km",
  native: "ខ្មែរ",
  htmlLang: "km"
};

export const GROUP_NAMES = [
  "ចាប់ផ្ដើម",
  "សិទ្ធិ និងមនុស្ស",
  "ការកំណត់",
  "ដំណើរការប្រព័ន្ធ",
  "Go-live"
];

export const PART_LABELS = {
  "01-what-rentmanager-is": "អ្វីជា RentManager",
  "02-architecture": "ស្ថាបត្យកម្ម និងសេវា",
  "03-first-login": "ការចូលលើកដំបូង និងគណនី",
  "04-rbdc": "តួនាទី, សិទ្ធិ និង RBDC",
  "05-user-management": "នីតិវិធីគ្រប់គ្រងអ្នកប្រើ",
  "06-organisation-setup": "ការរៀបចំអង្គភាព",
  "07-settings": "ឯកសារយោង Settings (M28)",
  "08-module-operations": "ប្រតិបត្តិការ admin តាម module",
  "09-scheduled-jobs": "ការងារតាមកាលវិភាគ",
  "10-backup-restore": "ការបម្រុងទុក និង restore",
  "11-security-hardening": "រឹតបន្តឹងសុវត្ថិភាព",
  "12-monitoring": "ការត្រួតពិនិត្យ និង logs",
  "13-updating": "ការអាប់ដេតប្រព័ន្ធ",
  "14-troubleshooting": "ការដោះស្រាយបញ្ហា",
  "15-go-live": "បញ្ជីត្រួតពិនិត្យ go-live"
};

export const UI = {
  title: "RentManager — មគ្គុទ្ទេសក៍អ្នកគ្រប់គ្រង",
  brandSub: "មគ្គុទ្ទេសក៍អ្នកគ្រប់គ្រង",
  side: {
    home: "🏠 ទំព័រដើម",
    walks: "🧭 លំហូរការងារ Admin",
    lang: "ភាសា",
    foot: "បានផ្ទៀងផ្ទាត់នឹងកូដកម្មវិធី · {n} ផ្នែក"
  },
  home: {
    heroTitle: "មគ្គុទ្ទេសក៍អ្នកគ្រប់គ្រង",
    heroSub:
      "ដំឡើង កំណត់រចនាសម្ព័ន្ធ ធានាសុវត្ថិភាព និងថែទាំ RentManager — មានដ្យាក្រាម និងលំហូរការងារ admin។ បុគ្គលិកប្រចាំថ្ងៃគួរប្រើ User Guide នៅ /guide។",
    btnWalks: "🧭 ចាប់ផ្ដើមលំហូរការងារ admin",
    btnQuick: "⚡ ការចូលលើកដំបូង",
    featStaffTitle: "អ្នកប្រើ និងតួនាទី",
    featStaffText:
      "បញ្ចូល/បញ្ឈប់បុគ្គលិក បង្កើតតួនាទីសិទ្ធិតិចបំផុត និងចាត់តាំងអចលនទ្រព្យ ដើម្បីឱ្យ RBDC កំណត់អ្វីដែលគេឃើញ។",
    featStaffLink: "បើកនីតិវិធីគ្រប់គ្រងអ្នកប្រើ →",
    featAdminTitle: "រឹតបន្តឹងមុន go-live",
    featAdminText:
      "ប្ដូរសម្ងាត់លំនាំដើមទាំងអស់ ចុះឈ្មោះ 2FA កំណត់ពេល backup រាល់យប់ និងបិទ port ខាងក្នុង មុនពេលមានលុយពិត។",
    featAdminLink: "បើកបញ្ជីរឹតបន្តឹង →",
    sections: "{n} ផ្នែក"
  },
  part: {
    notFound: "រកមិនឃើញផ្នែកនេះ។",
    onThisPage: "នៅលើទំព័រនេះ",
    crumb: "មគ្គុទ្ទេសក៍ Admin"
  },
  walks: {
    crumb: "លំហូរការងារ Admin",
    title: "🧭 លំហូរការងារ Admin",
    prev: "← ថយក្រោយ",
    restart: "↺ ចាប់ផ្ដើមឡើងវិញ",
    next: "ជំហានបន្ទាប់ →",
    finish: "បញ្ចប់ ✓",
    done: "✅ លំហូរការងារបានបញ្ចប់ — អ្នកអាចធ្វើបានដោយខ្លួនឯង។ ជ្រើសលំហូរបន្ទាប់ពីបញ្ជី។",
    shotCap: "🖼️ ការមើលអេក្រង់បង្ហាញ"
  }
};

export const WALKS = [
  {
    id: "first-login",
    title: "🔐 ការចូលលើកដំបូងជា Super Admin",
    role: "Super Admin",
    time: "~10 នាទី",
    intro: "ចូលប្រើបន្ទាប់ពីដំឡើងថ្មី ចុះឈ្មោះ 2FA និងបញ្ជាក់ថា audit trail កំពុងសរសេរ។",
    steps: [
      { t: "បើកទំព័រចូល", d: "ទៅ **http://localhost:3000/login** (ឬ `APP_BASE_URL` សាធារណៈ)។", menu: "Login" },
      { t: "ចូលជា root", d: "ប្រើ **root@demo.test** / **Demo1234!** លើប្រព័ន្ធដែលបាន seed។ លើផលិតកម្ម ប្រើ Super Admin ពិត។", menu: "Sign in" },
      { t: "ចុះឈ្មោះ 2FA", d: "Admin+ ត្រូវ enroll TOTP។ បើក **Account → Security** ស្កេន QR ជាមួយ authenticator បញ្ជាក់កូដ។", menu: "Account → Security", shot: "admin-security.png" },
      { t: "ពិនិត្យ Audit Log", d: "បើក **Admin → Audit Log** រួច **Verify audit chain**។ ត្រូវតែ ok។", menu: "Admin → Audit Log" },
      { t: "បើក Settings", d: "ទៅ **Admin → Settings** បញ្ជាក់ Org, Locale (រូបិយប័ណ្ណ/ម៉ោង/ភាសា) និង Billing មុនបង្កើតទិន្នន័យពិត។", menu: "Admin → Settings" }
    ]
  },
  {
    id: "real-admin",
    title: "👤 បង្កើត Super Admin ពិតរបស់អ្នក",
    role: "Super Admin",
    time: "~8 នាទី",
    intro: "កុំដំណើរការផលិតកម្មលើ *@demo.test។ បង្កើត admin ឈ្មោះពិត បន្ទាប់មកបិទគណនី demo។",
    steps: [
      { t: "Users → New user", d: "បើក **Admin → Users** បង្កើតអ្នកប្រើជាមួយអ៊ីមែលពិត និងពាក្យសម្ងាត់បណ្ដោះអាសន្ន។", menu: "Admin → Users → New" },
      { t: "ចាត់តាំង Super Admin", d: "ផ្ដល់តួនាទី **Super Admin** (GLOBAL)។ សិទ្ធិសរុប = សហភាពនៃតួនាទីទាំងអស់។", menu: "User → roles" },
      { t: "ចូលជាខ្លួនអ្នក", d: "ចេញ បន្ទាប់មកចូលជាអ្នកប្រើថ្មី ចុះឈ្មោះ **2FA** និងប្ដូរពាក្យសម្ងាត់បណ្ដោះអាសន្ន។", menu: "Login" },
      { t: "បិទគណនី demo", d: "បិទ ឬប្ដូរពាក្យសម្ងាត់គណនី `*@demo.test` ទាំងអស់។ ទិន្នន័យ demo សម្រាប់ហ្វឹកហាត់ប៉ុណ្ណោះ។", menu: "Admin → Users" },
      { t: "ដក sessions ដែលនៅសល់", d: "នៅ **Security** ដក sessions របស់អ្នកប្រើ demo ដើម្បីកុំឱ្យនៅចូល។", menu: "Admin → Security" }
    ]
  },
  {
    id: "cashier-role",
    title: "🛡️ បង្កើតតួនាទី Cashier",
    role: "Admin / Super Admin",
    time: "~10 នាទី",
    intro: "សិទ្ធិតិចបំផុត៖ cashier កត់ត្រាការទូទាត់ ប៉ុន្តែមិនអាចកែវិក្កយបត្រ។",
    steps: [
      { t: "Roles → New role", d: "ទៅ **Admin → Roles & Permissions** ដាក់ឈ្មោះតួនាទី **Cashier**។", menu: "Admin → Roles → New" },
      { t: "ធីកក្រឡាសិទ្ធិ", d: "ផ្ដល់ **M09 Payments** សរសេរប្រតិបត្តិការ នៅវិសាលភាព **PROPERTY**។ បិទ module ផ្សេងទាំងអស់។", menu: "Role → permission grid" },
      { t: "រក្សាទុកតួនាទី", d: "ការផ្លាស់ប្ដូរតួនាទី/សិទ្ធិត្រូវ **audit**។ តួនាទីកំពុងប្រើមិនអាចលុបបាន។", menu: "Role → Save" },
      { t: "ចាត់តាំងតួនាទី + អចលនទ្រព្យ", d: "បើកអ្នកប្រើ cashier ចាត់តាំង **Cashier** និង **អចលនទ្រព្យ** ដែលគេអាចប្រមូល។", menu: "Users → roles + properties" },
      { t: "ពិនិត្យអវិជ្ជមាន", d: "ចូលជា cashier៖ អាចកត់ការទូទាត់ ប៉ុន្តែបើកវិក្កយបត្រដើម្បីកែ ត្រូវបាន **403**។", menu: "Verify" }
    ]
  },
  {
    id: "onboard-employee",
    title: "🧑‍💼 បញ្ចូលបុគ្គលិកថ្មី",
    role: "Admin",
    time: "~8 នាទី",
    intro: "បង្កើតគណនី បង្ខំឱ្យប្ដូរពាក្យសម្ងាត់ ចាត់តាំងសិទ្ធិតិចបំផុតដែលត្រូវការ។",
    steps: [
      { t: "Users → New user", d: "បញ្ចូលឈ្មោះ **អ៊ីមែល** និងពាក្យសម្ងាត់បណ្ដោះអាសន្ន។ គណនីមាន **mustChangePassword**។", menu: "Admin → Users → New" },
      { t: "ចាត់តាំងតួនាទី", d: "ជ្រើសតួនាទីតូចបំផុតដែលដំណើរការ (Staff, Accountant, Property Manager…)។ សិទ្ធិ = **សហភាព**។", menu: "User → roles" },
      { t: "ចាត់តាំងអចលនទ្រព្យ", d: "ចាំបាច់សម្រាប់តួនាទី PROPERTY (Manager/Staff)។ តួនាទី GLOBAL ឃើញគ្រប់អចលនទ្រព្យ។", menu: "User → properties" },
      { t: "ប្រគល់ព័ត៌មានចូល", d: "ផ្ដល់ URL + ពាក្យសម្ងាត់បណ្ដោះអាសន្ន។ Admin+ ត្រូវចុះឈ្មោះ **2FA**។", menu: "Handover" },
      { t: "បញ្ជាក់ការចូលលើកដំបូង", d: "គេកំណត់ពាក្យសម្ងាត់ផ្ទាល់។ ពិនិត្យ **Audit Log** សម្រាប់ការបង្កើត + ការចូលដំបូង។", menu: "Admin → Audit Log" }
    ]
  },
  {
    id: "offboard-employee",
    title: "🚪 បញ្ឈប់បុគ្គលិក",
    role: "Admin",
    time: "~5 នាទី",
    intro: "ធ្វើគ្រប់ ៤ ជំហាន — ការបិទតែឯងមិនគ្រប់គ្រាន់ ប្រសិនបើ session ឬ 2FA នៅរស់។",
    steps: [
      { t: "បិទអ្នកប្រើ", d: "កំណត់ **status = disabled**។ ការចូលត្រូវបានទប់ស្កាត់ភ្លាម។", menu: "Admin → Users" },
      { t: "ដក sessions", d: "បង្ខំឱ្យចេញគ្រប់ឧបករណ៍ពី **Security** / កំណត់ត្រាអ្នកប្រើ។", menu: "Security → sessions" },
      { t: "កំណត់ 2FA ឡើងវិញ", d: "ប្រសិនបើអាចបើកគណនីនេះម្ដងទៀត សូម reset 2FA ឥឡូវ ដើម្បីឱ្យកូដចាស់ស្លាប់។", menu: "Security → 2FA reset" },
      { t: "ពិនិត្យ audit trail", d: "ត្រង **Audit Log** តាម actor នោះសម្រាប់ការពិនិត្យចុងក្រោយ។", menu: "Admin → Audit Log" }
    ]
  },
  {
    id: "org-setup",
    title: "🏢 ការរៀបចំអង្គភាព (លំដាប់មាស)",
    role: "Super Admin",
    time: "~45 នាទី",
    intro: "ជំហាននីមួយៗបើកជំហានបន្ទាប់។ កុំរំលង Locale/រូបិយប័ណ្ណ — មិនអាចប្ដូរបន្ទាប់ពីមានទិន្នន័យ។",
    steps: [
      { t: "Org + Locale", d: "Settings → **Org** (ឈ្មោះច្បាប់, និមិត្តសញ្ញា) និង **Locale** (រូបិយប័ណ្ណ, ម៉ោង, ភាសា)។ កំណត់ **រូបិយប័ណ្ណម្ដង**។", menu: "Settings → Org / Locale" },
      { t: "សារពើភ័ណ្ឌរូបវន្ត", d: "បង្កើត **properties → buildings → floors → rooms → beds** (M04)។", menu: "Portfolio → Properties" },
      { t: "តួនាទី និងអ្នកប្រើ", d: "បញ្ជាក់តួនាទីលំនាំដើម បន្ថែមអ្នកប្រើពិត ចាត់តាំងតួនាទី + អចលនទ្រព្យ។", menu: "Admin → Roles, Users" },
      { t: "Rent engine និង billing", d: "ផែនការ, late-fee, ពន្ធ, បុព្វបទវិក្កយបត្រ, ថ្ងៃ grace/dunning។", menu: "Rent Engine · Settings → Billing" },
      { t: "Secrets និងការទូទាត់", d: "រក្សាទុកសម្ងាត់អ្នកផ្ដល់ការទូទាត់ និង Telegram (sealed)។ Opening balances ប្រសិនបើកំពុងផ្លាស់ទី។", menu: "Settings → Secrets" },
      { t: "ម្ចាស់, Telegram, flags", d: "កិច្ចសន្យាម្ចាស់ + វិធីបង់; Telegram bot; feature flags + របាយការណ៍។", menu: "Owners · Telegram · Features" },
      { t: "សាកល្បង golden path", d: "Lease → invoice → payment → receipt។ បន្ទាប់មកកំណត់ពេល backup + ពិនិត្យ audit log។", menu: "End-to-end test" }
    ]
  },
  {
    id: "settings",
    title: "⚙️ កំណត់ Settings (M28)",
    role: "Admin / Super Admin",
    time: "~15 នាទី",
    intro: "ការផ្លាស់ប្ដូរទាំងអស់ត្រូវ audit។ ការកំណត់ហិរញ្ញវត្ថុអនុវត្តទៅមុខតែប៉ុណ្ណោះ — ប្រវត្តិដែលបានប្រកាសមិនសរសេរឡើងវិញ។",
    steps: [
      { t: "បើក Admin → Settings", d: "ក្រុមខាងក្រោមទាំងអស់នៅលើអេក្រង់នេះ។", menu: "Admin → Settings" },
      { t: "ម៉ាក Org", d: "ឈ្មោះច្បាប់, អាសយដ្ឋាន, លេខពន្ធ, និមិត្តសញ្ញា, footer វិក្កយបត្រ, គំរូ PDF។", menu: "Settings → Org" },
      { t: "Locale", d: "រូបិយប័ណ្ណ, ម៉ោង, ភាសា UI (en/km/zh)។ ⚠️ រូបិយប័ណ្ណ **កំណត់ម្ដង** នៅ go-live។", menu: "Settings → Locale" },
      { t: "Billing និង late fee", d: "បុព្វបទវិក្កយបត្រ, ថ្ងៃ grace (លំនាំដើម 3), dunning [3,7,14]។ Late fee បិទលំនាំដើម — តែងតែដាក់ **cap**។", menu: "Settings → Billing / Late fee" },
      { t: "Features, reports, templates", d: "លាក់ module ដែលមិនប្រើ (ទិន្នន័យនៅ), ចាត់តាំងរបាយការណ៍, កែពាក្យ Telegram។", menu: "Settings → Features / Reports / Templates" },
      { t: "Secrets", d: "ព័ត៌មានសម្ងាត់ការទូទាត់ និង token Telegram ត្រូវ **AES-256-GCM sealed** និងបង្ហាញលាក់។ កុំបិទភ្ជាប់សម្ងាត់ក្នុង chat។", menu: "Settings → Secrets" }
    ]
  },
  {
    id: "jobs",
    title: "⏰ កំណត់ពេលការងាររាល់យប់",
    role: "Admin / IT",
    time: "~15 នាទី",
    intro: "Jobs ជា HTTP endpoints។ ហៅតាមកាលវិភាគជាមួយ cookie គណនីសេវា — កុំប្រើ login ផ្ទាល់ខ្លួន។",
    steps: [
      { t: "បង្កើតគណនីសេវា", d: "តួនាទី Admin, ពាក្យសម្ងាត់ចៃដន្យវែង, 2FA, រក្សាទុកក្នុង vault។", menu: "Admin → Users" },
      { t: "សាកល្បង job នីមួយៗម្ដង", d: "POST `/api/jobs/billing-daily`, `backup`, `rent-alerts`, `invoice-generation`, `statement-generation`, `telegram-dispatch`, `sla-sweep`, `attendance-sweep`, `retention`។ ពិនិត្យ audit។", menu: "Jobs API" },
      { t: "បន្ថែម cron (Mac/Linux)", d: "ឧទាហរណ៍៖ `0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup -H \"Cookie: $RM_ADMIN_COOKIE\"`។", menu: "crontab" },
      { t: "ឬ Task Scheduler (Windows)", d: "រត់ស្គ្រីប PowerShell ជាមួយ `Invoke-RestMethod -Method Post` — មើល DEPLOY_WINDOWS.md។", menu: "Task Scheduler" },
      { t: "បញ្ជាក់ volume backup", d: "dump រាល់យប់នៅ `/app/backups` → volume `rentmanager-backups`។ រក្សា **7** ថ្មីបំផុត។", menu: "Backup dir" }
    ]
  },
  {
    id: "backup",
    title: "💾 Backup និងសាកល្បង restore",
    role: "Admin / IT",
    time: "~20 នាទី",
    intro: "Backup ដែលមិនបានសាកល្បង មិនមែនជា backup។ ធ្វើម្ដងមុន go-live និងរៀងរាល់ត្រីមាស។",
    steps: [
      { t: "រត់ job backup", d: "POST `/api/jobs/backup` (ត្រូវការ M27:update)។ បង្កើតឯកសារ `pg_dump` ទម្រង់ custom។", menu: "POST /api/jobs/backup" },
      { t: "បញ្ជាក់ឯកសារ", d: "រក `backups/backup-<timestamp>.dump` (ផ្លូវក្នុង container `/app/backups`)។", menu: "backups/" },
      { t: "បញ្ឈប់កម្មវិធី", d: "`docker compose stop rentmanager` ដើម្បីកុំឱ្យមានការសរសេរពេល restore។", menu: "docker compose stop" },
      { t: "Restore ទៅមូលដ្ឋានទិន្នន័យចំហៀង", d: "`createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump` បន្ទាប់មក `npx prisma migrate deploy`។", menu: "pg_restore" },
      { t: "ផ្ទៀងផ្ទាត់", d: "`GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · របាយការណ៍ប្រមូលត្រូវគ្នា។ Backup bucket MinIO/S3 ផ្សេងដែរ។", menu: "Health + audit verify" }
    ]
  },
  {
    id: "harden",
    title: "🔒 រឹតបន្តឹងសុវត្ថិភាពមុន go-live",
    role: "Super Admin / IT",
    time: "~30 នាទី",
    intro: "កូដមានមូលដ្ឋានរឹងមាំ។ ផលិតកម្មនៅតែត្រូវប្ដូរសម្ងាត់លំនាំដើម និងបើក HTTPS។",
    steps: [
      { t: "ប្ដូរសម្ងាត់ទាំងអស់", d: "ប្ដូរ `FILE_SIGNING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `SETTINGS_ENC_KEY` (៣២+ បៃ), ពាក្យសម្ងាត់ Telegram/DB/Redis/MinIO/Grafana/Nacos/Keycloak។", menu: "Environment" },
      { t: "បិទគណនី demo", d: "បិទ ឬប្ដូរពាក្យសម្ងាត់អ្នកប្រើ `*@demo.test`។ ចុះឈ្មោះ **2FA** សម្រាប់ Admin+ គ្រប់រូប។", menu: "Admin → Users" },
      { t: "HTTPS + cookie សុវត្ថិភាព", d: "កំណត់ `COOKIE_SECURE=true` ដាក់ reverse proxy TLS នៅមុខ កំណត់ `APP_BASE_URL` ជា https សាធារណៈ។", menu: "Proxy / env" },
      { t: "ចង port ខាងក្នុង", d: "PostgreSQL, Redis, Kafka, Nacos, Keycloak, MinIO API មិនត្រូវនៅលើអ៊ីនធឺណិតសាធារណៈ។", menu: "Firewall" },
      { t: "ផ្ទៀងផ្ទាត់ភាពត្រឹមត្រូវ", d: "រត់ **Verify audit chain** សាកល្បង webhook (ត្រូវបដិសេធ) កំណត់ពេល backup រាល់យប់ + restore ម្ដង។", menu: "Audit · webhooks · backup" }
    ]
  },
  {
    id: "audit",
    title: "📜 ផ្ទៀងផ្ទាត់ audit chain",
    role: "Admin / Super Admin",
    time: "~5 នាទី",
    intro: "ដានជា hash-chained និងមិនដែលលុប។ ការផ្ទៀងផ្ទាត់បរាជ័យគឺជាព្រឹត្តិការណ៍បញ្ឈប់។",
    steps: [
      { t: "បើក Audit Log", d: "ទៅ **Admin → Audit Log**។ ត្រងតាម actor, កាលបរិច្ឆេទ ឬ entity។", menu: "Admin → Audit Log" },
      { t: "រត់ Verify audit chain", d: "`GET /api/audit/verify` ត្រូវត្រឡប់ `{ ok: true }`។", menu: "Verify" },
      { t: "បើបរាជ័យ — បញ្ឈប់", d: "អាចមានការកែប្រែ។ កុំ restore ព្រងើយកន្តើយ៖ រកមូលហេតុសិន បន្ទាប់មក restore ពី backup ល្អ។", menu: "Incident" },
      { t: "កែដោយ reversal", d: "កុំកែវិក្កយបត្រ/ការទូទាត់/ledger ដោយដៃ។ ប្រើ credit note / void / refund។", menu: "Reversal, not edit" }
    ]
  },
  {
    id: "update",
    title: "🚀 អាប់ដេតប្រព័ន្ធ",
    role: "Admin / IT",
    time: "~20 នាទី",
    intro: "ថតចម្លងសិន។ Migrations គឺបន្ថែមតែប៉ុណ្ណោះ — ទៅមុខ ឬ restore ពី backup បើត្រូវថយក្រោយ។",
    steps: [
      { t: "ថតចម្លង", d: "រត់ job backup (ឬ snapshot volume Docker) មុនពេល pull។", menu: "POST /api/jobs/backup" },
      { t: "Pull + rebuild", d: "`git pull` បន្ទាប់មក `docker compose up --build -d`។ នៅផលិតកម្ម កំណត់ tag / SHA។", menu: "docker compose up --build -d" },
      { t: "មើល entrypoint", d: "Migrations + seed រត់ស្វ័យប្រវត្តិ។ តាម `docker compose logs -f rentmanager` នៅ boot ដំបូង។", menu: "logs -f rentmanager" },
      { t: "ពិនិត្យសុខភាព", d: "`curl -sf http://localhost:3000/api/health` និង `docker compose ps`។ បញ្ជាក់ `/admin-guide` នៅតែបើក។", menu: "GET /api/health" }
    ]
  }
];

export const DIAGRAMS = {
  "02-architecture": {
    "21-components": {
      cap: "របៀបភ្ជាប់ stack",
      nodes: [
        ["v-blue", "កម្មវិធីរុករក — បុគ្គលិក / portal"],
        ["rentmanager :3000 (Next.js + Prisma)"],
        ["PostgreSQL :5432"],
        ["gateway :8080 → សេវា Spring :8081–:8088"],
        ["v-teal", "Nacos · Keycloak · Kafka · Redis · MinIO · Grafana"]
      ]
    }
  },
  "04-rbdc": {
    "41-the-model-read-this-once-use-it-forever": {
      cap: "សិទ្ធិ = module × action × scope",
      nodes: [
        ["v-blue", "MODULE (M01–M33)"],
        ["ACTION — create read update delete approve void refund export config"],
        ["SCOPE — GLOBAL / PROPERTY / OWN"],
        ["v-green", "សិទ្ធិសរុប = សហភាពនៃតួនាទីទាំងអស់"],
        ["API ជាច្រកពិត — UI លាក់ប៊ូតុងប៉ុណ្ណោះ"]
      ]
    }
  },
  "06-organisation-setup": {
    "golden-setup-order": {
      cap: "លំដាប់រៀបចំសម្រាប់អង្គភាពថ្មី",
      nodes: [
        ["1 · Org / Locale (រូបិយប័ណ្ណម្ដង)"],
        ["2 · Properties → buildings → floors → rooms"],
        ["3 · Roles · 4 · Users (តួនាទី + អចលនទ្រព្យ)"],
        ["5 · Rent engine · 6 · Opening balances"],
        ["7 · វិធីទូទាត់ និង secrets · 8 · Billing / alerts"],
        ["9 · ម្ចាស់ + កិច្ចសន្យា · 10 · Telegram"],
        ["11 · សុវត្ថិភាព (2FA, sessions) · 12 · Feature flags"],
        ["v-green", "13 · សាកល្បង golden path · 14 · Audit + backup"]
      ]
    }
  },
  "10-backup-restore": {
    "backup-and-restore": {
      cap: "លំដាប់ restore (សំខាន់)",
      nodes: [
        ["v-amber", "1 · docker compose stop rentmanager"],
        ["2 · pg_restore ទៅមូលដ្ឋានទិន្នន័យចំហៀង"],
        ["3 · npx prisma migrate deploy (ទៅមុខតែប៉ុណ្ណោះ)"],
        ["v-green", "4 · health 200 · audit verify ok · របាយការណ៍ត្រូវគ្នា"]
      ]
    }
  },
  "11-security-hardening": {
    "before-production": {
      cap: "រឹតបន្តឹងមុនលុយពិត",
      nodes: [
        ["ប្ដូរសម្ងាត់លំនាំដើមទាំងអស់"],
        ["បិទ *@demo.test · ចុះឈ្មោះ 2FA សម្រាប់ Admin+"],
        ["HTTPS + COOKIE_SECURE=true"],
        ["ចង DB/Redis/Kafka/MinIO ក្នុងបណ្ដាញឯកជន"],
        ["v-teal", "Verify audit chain · backup រាល់យប់ · សាកល្បង restore"]
      ]
    }
  },
  "15-go-live": {
    "go-live-checklist": {
      cap: "Go-live ក្នុងរូបភាពមួយ",
      nodes: [
        ["Deploy បៃតង · រឹតបន្តឹង §11 រួច"],
        ["Org / Locale / Billing ចុងក្រោយ · បន្ទប់បានបញ្ចូល"],
        ["អ្នកប្រើពិត + តួនាទី · គណនី demo បិទ"],
        ["Jobs បានកំណត់ពេល និងសាកល្បង · backup បាន restore ម្ដង"],
        ["v-green", "បុគ្គលិកហ្វឹកហាត់ lease → invoice → payment → move-out"]
      ]
    }
  }
};
