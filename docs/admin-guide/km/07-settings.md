# 7. ឯកសារយោង Settings (M28)

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

## Environment variables (server-side)

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
