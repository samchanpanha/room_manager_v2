// Admin-guide site i18n — English (source of truth).
// Walkthroughs, diagrams and UI chrome. km/zh mirror this 1:1
// (same walk ids, same step counts, same diagram keys).

export const meta = {
  code: "en",
  native: "English",
  htmlLang: "en"
};

export const GROUP_NAMES = [
  "Start",
  "Access & people",
  "Configuration",
  "Run the system",
  "Go-live"
];

export const PART_LABELS = {
  "01-what-rentmanager-is": "What RentManager is",
  "02-architecture": "Architecture & services",
  "03-first-login": "First login & accounts",
  "04-rbdc": "Roles, permissions & RBDC",
  "05-user-management": "User management SOPs",
  "06-organisation-setup": "Organisation setup",
  "07-settings": "Settings reference (M28)",
  "08-module-operations": "Module admin operations",
  "09-scheduled-jobs": "Scheduled jobs",
  "10-backup-restore": "Backup & restore",
  "11-security-hardening": "Security hardening",
  "12-monitoring": "Monitoring & logs",
  "13-updating": "Updating the system",
  "14-troubleshooting": "Troubleshooting",
  "15-go-live": "Go-live checklist"
};

export const UI = {
  title: "RentManager — Administrator Guide",
  brandSub: "Administrator Guide",
  side: {
    home: "🏠 Home",
    walks: "🧭 Admin workflows",
    lang: "Language",
    foot: "Verified against the application source · {n} parts"
  },
  home: {
    heroTitle: "Administrator Guide",
    heroSub:
      "Install, configure, secure and maintain RentManager — with diagrams and click-through admin workflows. Staff doing daily work should use the User Guide at /guide.",
    btnWalks: "🧭 Start an admin workflow",
    btnQuick: "⚡ First login",
    featStaffTitle: "Users & roles",
    featStaffText:
      "Onboard and offboard staff, build least-privilege roles, and assign properties so RBDC actually scopes what people see.",
    featStaffLink: "Open user-management SOPs →",
    featAdminTitle: "Harden before go-live",
    featAdminText:
      "Rotate every default secret, enroll 2FA, schedule nightly backups and lock internal ports before real money hits the system.",
    featAdminLink: "Open the hardening checklist →",
    sections: "{n} sections"
  },
  part: {
    notFound: "Part not found.",
    onThisPage: "On this page",
    crumb: "Admin Guide"
  },
  walks: {
    crumb: "Admin workflows",
    title: "🧭 Admin workflows",
    prev: "← Back",
    restart: "↺ Restart",
    next: "Next step →",
    finish: "Finish ✓",
    done: "✅ Workflow complete — you can do this unaided. Pick the next workflow from the list.",
    shotCap: "🖼️ Illustrated screen preview"
  }
};

export const WALKS = [
  {
    id: "first-login",
    title: "🔐 First login as Super Admin",
    role: "Super Admin",
    time: "~10 min",
    intro: "Sign in on a fresh install, enroll 2FA, and confirm the audit trail is writing.",
    steps: [
      { t: "Open the login page", d: "Go to **http://localhost:3000/login** (or your public `APP_BASE_URL`).", menu: "Login" },
      { t: "Sign in as root", d: "Use **root@demo.test** / **Demo1234!** on a seeded system. On a fresh production org, use the Super Admin you created.", menu: "Sign in" },
      { t: "Enroll 2FA", d: "Admin+ must enroll TOTP. Open **Account → Security**, scan the QR with an authenticator app, confirm a code.", menu: "Account → Security", shot: "admin-security.png" },
      { t: "Check the audit log", d: "Open **Admin → Audit Log** and run **Verify audit chain**. It must return ok.", menu: "Admin → Audit Log" },
      { t: "Open Settings", d: "Go to **Admin → Settings** and confirm Org, Locale (currency/timezone/language) and Billing before you create real data.", menu: "Admin → Settings" }
    ]
  },
  {
    id: "real-admin",
    title: "👤 Create your real Super Admin",
    role: "Super Admin",
    time: "~8 min",
    intro: "Never run production on *@demo.test. Create a named admin, then disable the demo accounts.",
    steps: [
      { t: "Users → New user", d: "Open **Admin → Users** and create a user with your real email and a temporary password.", menu: "Admin → Users → New" },
      { t: "Assign Super Admin", d: "Give the new user the **Super Admin** role (GLOBAL). Effective access is the union of all roles.", menu: "User → roles" },
      { t: "Sign in as yourself", d: "Sign out, sign in as the new user, enroll **2FA**, and change the temporary password.", menu: "Login" },
      { t: "Disable demo accounts", d: "Disable or re-password every `*@demo.test` account. Demo data is for training only.", menu: "Admin → Users" },
      { t: "Revoke leftover sessions", d: "On **Security**, revoke sessions for the demo users so they cannot stay signed in.", menu: "Admin → Security" }
    ]
  },
  {
    id: "cashier-role",
    title: "🛡️ Build a Cashier role",
    role: "Admin / Super Admin",
    time: "~10 min",
    intro: "Least privilege: a cashier records payments but cannot edit invoices.",
    steps: [
      { t: "Open Roles → New role", d: "Go to **Admin → Roles & Permissions** and name the role **Cashier**.", menu: "Admin → Roles → New" },
      { t: "Tick the permission grid", d: "Grant **M09 Payments** operational write at **PROPERTY** scope. Leave every other module off.", menu: "Role → permission grid" },
      { t: "Save the role", d: "Role/permission changes are **audited**. A role in use cannot be deleted.", menu: "Role → Save" },
      { t: "Assign the role + property", d: "Open the cashier's user, assign **Cashier**, and assign the **property** they may collect for.", menu: "Users → roles + properties" },
      { t: "Negative-check", d: "Sign in as the cashier (or impersonate in a test): they can record a payment, but opening an invoice to edit returns **403**.", menu: "Verify" }
    ]
  },
  {
    id: "onboard-employee",
    title: "🧑‍💼 Onboard a new employee",
    role: "Admin",
    time: "~8 min",
    intro: "Create the account, force a password change, assign the least privilege they need.",
    steps: [
      { t: "Users → New user", d: "Enter name, **email**, and a temporary password. The account is created with **mustChangePassword**.", menu: "Admin → Users → New" },
      { t: "Assign role(s)", d: "Pick the smallest role that works (Staff, Accountant, Property Manager…). Access is the **union** of all roles.", menu: "User → roles" },
      { t: "Assign properties", d: "Required for PROPERTY-scoped roles (Manager/Staff). GLOBAL roles see every property.", menu: "User → properties" },
      { t: "Hand over credentials", d: "Give them the URL + temp password. Admin+ must also enroll **2FA** before other modules work.", menu: "Handover" },
      { t: "Confirm first sign-in", d: "They set their own password; check **Audit Log** for the create + first login.", menu: "Admin → Audit Log" }
    ]
  },
  {
    id: "offboard-employee",
    title: "🚪 Offboard an employee",
    role: "Admin",
    time: "~5 min",
    intro: "Do all four steps — disabling alone is not enough if sessions or 2FA survive.",
    steps: [
      { t: "Disable the user", d: "Set **status = disabled**. Sign-in is blocked immediately.", menu: "Admin → Users" },
      { t: "Revoke sessions", d: "Force sign-out on every device from **Security** / the user record.", menu: "Security → sessions" },
      { t: "Reset 2FA", d: "If you might re-enable this account later, reset 2FA now so old authenticator codes die.", menu: "Security → 2FA reset" },
      { t: "Review the audit trail", d: "Filter **Audit Log** by that actor for a final review of their last actions.", menu: "Admin → Audit Log" }
    ]
  },
  {
    id: "org-setup",
    title: "🏢 Organisation setup (golden order)",
    role: "Super Admin",
    time: "~45 min",
    intro: "Each step unlocks the next. Do not skip Locale/currency — it is not changeable after data exists.",
    steps: [
      { t: "Org + Locale", d: "Settings → **Org** (legal name, logo) and **Locale** (currency, timezone, language). Set **currency once**.", menu: "Settings → Org / Locale" },
      { t: "Physical inventory", d: "Create **properties → buildings → floors → rooms → beds** (M04).", menu: "Portfolio → Properties" },
      { t: "Roles & users", d: "Confirm default roles, add real users, assign roles + properties.", menu: "Admin → Roles, Users" },
      { t: "Rent engine & billing", d: "Plans, late-fee, tax, invoice prefix, grace/dunning days.", menu: "Rent Engine · Settings → Billing" },
      { t: "Secrets & payments", d: "Store payment-provider and Telegram secrets (sealed). Opening balances if you are migrating.", menu: "Settings → Secrets" },
      { t: "Owners, Telegram, flags", d: "Owner contracts + payout methods; Telegram bot; feature flags + report assignments.", menu: "Owners · Telegram · Features" },
      { t: "Golden-path test", d: "Lease → invoice → payment → receipt. Then schedule backup + review the audit log.", menu: "End-to-end test" }
    ]
  },
  {
    id: "settings",
    title: "⚙️ Configure Settings (M28)",
    role: "Admin / Super Admin",
    time: "~15 min",
    intro: "All changes are audited. Financial settings apply forward-only — posted history is never rewritten.",
    steps: [
      { t: "Open Admin → Settings", d: "Every group below lives on this screen.", menu: "Admin → Settings" },
      { t: "Org branding", d: "Legal name, address, tax ID, logo, invoice footer, PDF template. These print on every receipt.", menu: "Settings → Org" },
      { t: "Locale", d: "Currency, timezone, UI language (en/km/zh). ⚠️ Currency is **set once** at go-live.", menu: "Settings → Locale" },
      { t: "Billing & late fee", d: "Invoice prefix, grace days (default 3), dunning [3,7,14]. Late fee off by default — always set a **cap** if you turn it on.", menu: "Settings → Billing / Late fee" },
      { t: "Features, reports, templates", d: "Hide unused modules (data is kept), assign which reports roles see, override Telegram wording.", menu: "Settings → Features / Reports / Templates" },
      { t: "Secrets", d: "Payment credentials and the Telegram token are **AES-256-GCM sealed** and shown masked. Never paste secrets in chat.", menu: "Settings → Secrets" }
    ]
  },
  {
    id: "jobs",
    title: "⏰ Schedule nightly jobs",
    role: "Admin / IT",
    time: "~15 min",
    intro: "Jobs are HTTP endpoints. Call them on a schedule with a dedicated service-account cookie — never a personal login.",
    steps: [
      { t: "Create a service account", d: "Admin role, long random password, 2FA enrolled, credentials in the server vault.", menu: "Admin → Users" },
      { t: "Test-fire each job once", d: "POST `/api/jobs/billing-daily`, `backup`, `rent-alerts`, `invoice-generation`, `statement-generation`, `telegram-dispatch`, `sla-sweep`, `attendance-sweep`, `retention`. Check audit rows.", menu: "Jobs API" },
      { t: "Add cron (Mac/Linux)", d: "Example: `0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup -H \"Cookie: $RM_ADMIN_COOKIE\"`.", menu: "crontab" },
      { t: "Or Task Scheduler (Windows)", d: "Run a PowerShell script with `Invoke-RestMethod -Method Post` — see DEPLOY_WINDOWS.md.", menu: "Task Scheduler" },
      { t: "Confirm the backup volume", d: "Nightly dumps land in `/app/backups` → `rentmanager-backups` volume. Keep the newest **7**.", menu: "Backup dir" }
    ]
  },
  {
    id: "backup",
    title: "💾 Backup and test-restore",
    role: "Admin / IT",
    time: "~20 min",
    intro: "An untested backup is not a backup. Do this once before go-live and quarterly after.",
    steps: [
      { t: "Run the backup job", d: "POST `/api/jobs/backup` (needs M27:update). Produces a `pg_dump` custom-format file.", menu: "POST /api/jobs/backup" },
      { t: "Confirm the file", d: "Look for `backups/backup-<timestamp>.dump` (container path `/app/backups`).", menu: "backups/" },
      { t: "Stop the app", d: "`docker compose stop rentmanager` so nothing writes during restore.", menu: "docker compose stop" },
      { t: "Restore into a side database", d: "`createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump`, then `npx prisma migrate deploy`.", menu: "pg_restore" },
      { t: "Verify", d: "`GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · collections report reconciles. Also back up the MinIO/S3 bucket separately.", menu: "Health + audit verify" }
    ]
  },
  {
    id: "harden",
    title: "🔒 Security hardening before go-live",
    role: "Super Admin / IT",
    time: "~30 min",
    intro: "The build is a solid baseline. Production still needs every default secret rotated and HTTPS on.",
    steps: [
      { t: "Rotate every secret", d: "Change `FILE_SIGNING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `SETTINGS_ENC_KEY` (32+ random bytes), Telegram/DB/Redis/MinIO/Grafana/Nacos/Keycloak passwords.", menu: "Environment" },
      { t: "Kill demo accounts", d: "Disable or re-password all `*@demo.test` users. Enroll **2FA** for every Admin+.", menu: "Admin → Users" },
      { t: "HTTPS + secure cookies", d: "Set `COOKIE_SECURE=true`, put a TLS reverse proxy in front, set `APP_BASE_URL` to the public https URL.", menu: "Proxy / env" },
      { t: "Bind internal ports", d: "PostgreSQL, Redis, Kafka, Nacos, Keycloak, MinIO API must **not** be on the public internet.", menu: "Firewall" },
      { t: "Verify integrity", d: "Run **Verify audit chain**, spoof-test payment/Telegram webhooks (must reject), schedule nightly backup + one test restore.", menu: "Audit · webhooks · backup" }
    ]
  },
  {
    id: "audit",
    title: "📜 Verify the audit chain",
    role: "Admin / Super Admin",
    time: "~5 min",
    intro: "The trail is hash-chained and never purged. A failed verify is a stop-the-line event.",
    steps: [
      { t: "Open Audit Log", d: "Go to **Admin → Audit Log**. Filter by actor, date or entity when investigating.", menu: "Admin → Audit Log" },
      { t: "Run Verify audit chain", d: "`GET /api/audit/verify` must return `{ ok: true }`.", menu: "Verify" },
      { t: "If it fails — stop", d: "Possible tampering. Do **not** restore blindly: root-cause first, then restore from a known-good backup.", menu: "Incident" },
      { t: "Correct with reversals", d: "Never hand-edit posted invoices/payments/ledger. Use credit note / void / refund so the trail stays intact.", menu: "Reversal, not edit" }
    ]
  },
  {
    id: "update",
    title: "🚀 Update the system",
    role: "Admin / IT",
    time: "~20 min",
    intro: "Snapshot first. Migrations are append-only — roll forward, or restore from backup if you must go back.",
    steps: [
      { t: "Snapshot", d: "Run the backup job (or snapshot the Docker volumes) before you pull.", menu: "POST /api/jobs/backup" },
      { t: "Pull + rebuild", d: "`git pull` then `docker compose up --build -d`. Pin image tags / commit SHAs in production.", menu: "docker compose up --build -d" },
      { t: "Watch the entrypoint", d: "Migrations + seed run automatically. Follow `docker compose logs -f rentmanager` on first boot.", menu: "logs -f rentmanager" },
      { t: "Health-check", d: "`curl -sf http://localhost:3000/api/health` and `docker compose ps`. Confirm `/admin-guide` still loads.", menu: "GET /api/health" }
    ]
  }
];

export const DIAGRAMS = {
  "02-architecture": {
    "21-components": {
      cap: "How the stack is wired",
      nodes: [
        ["v-blue", "Browser — staff / portal"],
        ["rentmanager :3000 (Next.js + Prisma)"],
        ["PostgreSQL :5432"],
        ["gateway :8080 → Spring services :8081–:8088"],
        ["v-teal", "Nacos · Keycloak · Kafka · Redis · MinIO · Grafana"]
      ]
    }
  },
  "04-rbdc": {
    "41-the-model-read-this-once-use-it-forever": {
      cap: "Permission = module × action × scope",
      nodes: [
        ["v-blue", "MODULE (M01–M33)"],
        ["ACTION — create read update delete approve void refund export config"],
        ["SCOPE — GLOBAL / PROPERTY / OWN"],
        ["v-green", "Effective access = union of all the user's roles"],
        ["API is the real gate — the UI only hides buttons"]
      ]
    }
  },
  "06-organisation-setup": {
    "golden-setup-order": {
      cap: "Setup order for a new organisation",
      nodes: [
        ["1 · Org / Locale (currency once)"],
        ["2 · Properties → buildings → floors → rooms"],
        ["3 · Roles · 4 · Users (roles + properties)"],
        ["5 · Rent engine · 6 · Opening balances"],
        ["7 · Payment methods & secrets · 8 · Billing / alerts"],
        ["9 · Owners + contracts · 10 · Telegram"],
        ["11 · Security (2FA, sessions) · 12 · Feature flags"],
        ["v-green", "13 · Golden-path test · 14 · Audit + backup"]
      ]
    }
  },
  "10-backup-restore": {
    "backup-and-restore": {
      cap: "Restore order (it matters)",
      nodes: [
        ["v-amber", "1 · docker compose stop rentmanager"],
        ["2 · pg_restore into a side database"],
        ["3 · npx prisma migrate deploy (forward-only)"],
        ["v-green", "4 · health 200 · audit verify ok · reports reconcile"]
      ]
    }
  },
  "11-security-hardening": {
    "before-production": {
      cap: "Hardening before real money",
      nodes: [
        ["Rotate every default secret"],
        ["Disable *@demo.test · enroll 2FA for Admin+"],
        ["HTTPS + COOKIE_SECURE=true"],
        ["Bind DB/Redis/Kafka/MinIO to a private network"],
        ["v-teal", "Verify audit chain · nightly backup · test restore"]
      ]
    }
  },
  "15-go-live": {
    "go-live-checklist": {
      cap: "Go-live in one picture",
      nodes: [
        ["Deploy green · §11 hardening done"],
        ["Org / Locale / Billing final · rooms entered"],
        ["Real users + roles · demo accounts disabled"],
        ["Jobs scheduled and test-fired · backup restored once"],
        ["v-green", "Staff trained on lease → invoice → payment → move-out"]
      ]
    }
  }
};
