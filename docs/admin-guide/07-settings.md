# 7. Settings reference (M28)

**Where:** Admin → Settings. All changes are **audited**; financial settings
apply **forward-only** (posted history is never rewritten).

| Group | Controls | Admin notes |
|---|---|---|
| **Org** | Legal name, address, phone, email, website, tax ID, logo, invoice footer, PDF template (classic/modern) | Branding on every PDF/receipt. Keep legal name & tax ID accurate. |
| **Locale** | Currency, timezone, UI language (en/km/zh) | ⚠️ Set **currency once** at go-live; not changeable after data exists. |
| **Billing** | Invoice prefix, grace days (default **3**), dunning days (**[3,7,14]**) | Drives numbering + when reminders/late fees start. Forward-only. |
| **Late fee** | Mode none/flat/percent, flat amount, monthly % (bp), cap | Off by default. Always set a **cap** — fees never exceed amount due. |
| **Retention** | outbox 90d, events 365d, OTP 7d, session 30d | **Audit trail is never purged.** |
| **Features** | Per-module flags (POS, Stock, Telegram, PO default ON) | Off hides menu + gates access; **data is kept**. |
| **Reports** | enabledKeys, assignments, designs | Who sees which reports; data stays source-backed. |
| **Templates** | Telegram overrides, 5 events, `{placeholders}` | issued / receipt / dunning / reminder / overdue wording. |
| **Printers** | 58/80mm, auto-print, copies, barcode default | POS receipt/label printing. |
| **Telegram** | Bot display name, welcome msg, member self-link | Tenant bot behaviour. |
| **Menu** | Sidebar side (left/right) | Layout preference only — visibility comes from permissions. |
| **Units / Table** | Stock units; default page size (25) | List density + item units. |
| **Alerts (M33)** | ahead days (3), overdue days (1) | Dashboard due-soon/overdue windows. |
| **Secrets** | Payment creds, Telegram token | **AES-256-GCM sealed**, masked reads; env vars = fallback. Never paste secrets in chat. |
| **Opening balances** | Balanced `opening` ledger postings | For migration into RentManager; must balance. |

## Environment variables (server-side)

| Variable | Purpose | Default (dev) |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://rentmanager:rentmanager@localhost:5432/rentmanager` |
| `SESSION_TTL_DAYS` | Session lifetime | `30` |
| `FILE_SIGNING_SECRET` | Signed file URLs | random dev value in `.env` |
| `PAYMENT_WEBHOOK_SECRET` | Gateway webhook HMAC | `dev-webhook-secret-change-me` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `TELEGRAM_BOT_USERNAME` | Telegram bot | `dev-*` placeholders |
| `SETTINGS_ENC_KEY` | Sealed-settings encryption (32-byte) | must set in prod |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage | MinIO in Docker |
| `APP_BASE_URL` | Public base URL (links in PDFs/messages) | `http://localhost:3000` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO console + S3 | `rentmanager` / `rentmanager-s3-secret` |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana | `admin` / `admin` |
| `COOKIE_SECURE` | Secure cookies | `false` locally → **`true`** behind HTTPS |
| `SEED_FULL_DEMO` | Seed full demo dataset | `1` in Docker |

Copy `.env.example` → `.env` for local runs; in Docker the compose file
injects production-style values — override secrets via shell env or a
`docker-compose.override.yml` (never commit real secrets).

---
