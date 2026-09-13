# Part 15 — Deployment Guide (macOS & Windows)

This part explains how to **install and run RentManager** on an Apple Mac or a
Windows PC. There is one recommended path — **Docker** (the whole system with
one command) — plus a **lightweight** path (app + database only) for small
machines and daily coding.

> After deploying, continue with **Part 8 (Administrator Guide)**: first login,
> organisation setup, users, security and backups. A printable one-page summary
> of this part ships with the guide: [Admin cheat sheet](cheat-sheet.html).

---

## 15.1 Requirements

### Hardware

| | Minimum | Recommended (full Docker stack) |
|---|---|---|
| RAM | 8 GB | **16 GB** (the stack runs ~20 containers: Java services, Kafka, Keycloak…) |
| CPU | 2 cores | 4+ cores (Windows: virtualization VT-x/AMD-V enabled in BIOS) |
| Disk | 20 GB free | 40 GB+ free SSD (25–50 GB on Windows: WSL2 disk + images + DB) |

> 💡 Short on RAM? Use the **lightweight option (§15.4)** — app + PostgreSQL
> only (≈1 GB). You still get the complete RentManager web app with demo data.

### Software

| # | Requirement | macOS | Windows |
|---|---|---|---|
| 1 | OS | macOS 12 (Monterey) or newer | Windows 10 64-bit 21H2+ / Windows 11 |
| 2 | **Docker Desktop 4.x** | Apple Silicon **or** Intel build from docker.com | Windows installer + **WSL 2 + Ubuntu** (`wsl --install`) |
| 3 | **Git** | `xcode-select --install` | Git for Windows (gives you Git Bash too) |
| 4 | Node.js 20/22 *(lightweight only)* | `brew install node@22` | LTS installer from nodejs.org |
| 5 | PostgreSQL 16 *(lightweight only)* | `brew install postgresql@16` — or `docker compose up -d postgres` | EDB installer — or `docker compose up -d postgres` |

### Ports that must be free

`3000` (app) · `5432` (postgres) · `6379` (redis) · `8080–8088` (gateway +
services) · `8848/9848/9849` (nacos) · `7080` (keycloak) · `8090/8091`
(kafka ui/registry) · `9090` (grafana) · `9092` (kafka) · `9000/9001` (minio).
The lightweight option needs only `3000` + `5432`.

### Knowledge assumed

Opening **Terminal** (Mac) or **PowerShell** (Windows), copy-pasting commands,
and opening `http://localhost:…` in a browser. No Docker experience needed.

---

## 15.2 Deploy on macOS (Docker — recommended)

### Step 1 — Install Docker Desktop

1. Download from **docker.com/products/docker-desktop** — pick **Mac with
   Apple Silicon** or **Mac with Intel chip** to match your Mac ( → About This Mac → Chip).
2. Open the `.dmg`, drag **Docker** to Applications, launch it, and wait for
   the whale icon in the menu bar to settle.
3. Verify in Terminal:
   ```bash
   docker --version
   docker compose version
   ```
4. **Give Docker enough memory (important!):** Docker Desktop → ⚙ Settings →
   **Resources** → **Memory ≥ 8 GB** (10–12 GB if you have 16 GB), CPUs ≥ 4 →
   **Apply & restart**.

### Step 2 — Install Git

```bash
xcode-select --install
git --version
```

### Step 3 — Clone the repository

```bash
cd ~
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```

### Step 4 — (Recommended) set your secrets

For a local demo you can skip this — safe dev defaults are built in. For
anything shared, override the defaults **before** first boot:

```bash
cp .env.example .env   # edit values inside as needed
export MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
export GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# then run Step 5 in the same shell
```

### Step 5 — Build & start everything (one command)

```bash
docker compose up --build -d
```

- First run downloads images and builds the Java + Next.js apps — expect
  **10–30 minutes** (later starts take ~1–2 min). `-d` = run in background.
- Watch progress: `docker compose ps` and `docker compose logs -f rentmanager`.
- The app container automatically **waits for PostgreSQL → runs migrations →
  seeds demo data (idempotent) → starts on port 3000**.

Continue with **§15.5 Verify the installation**.

---

## 15.3 Deploy on Windows (Docker — recommended)

> 🗒️ Commands below are **PowerShell**. Run as **Administrator** only where
> marked **[ADMIN]**. Git Bash and WSL Ubuntu work too — pick one terminal.

### Step 1 — Enable WSL 2 [ADMIN]

1. Start menu → type `PowerShell` → right-click → **Run as administrator**.
2. Install WSL + Ubuntu (restart when asked, then open **Ubuntu** once to
   create your Linux username/password):
   ```powershell
   wsl --install
   ```
3. Verify version 2: `wsl --list --verbose` (must show `VERSION 2`; if it
   shows 1: `wsl --set-version Ubuntu 2`). If it fails with a virtualization
   error, enable **VT-x / AMD-V** in BIOS/UEFI and retry.

### Step 2 — Install Docker Desktop

1. Run the **Windows** installer from docker.com (keep **"Use WSL 2 instead
   of Hyper-V"** ticked), restart if asked, launch Docker Desktop.
2. Wait for the whale icon (system tray) to settle, then verify:
   ```powershell
   docker --version
   docker compose version
   ```
3. Docker Desktop → ⚙ Settings → **Resources** → **Memory ≥ 8 GB**,
   CPUs ≥ 4 → **Apply & restart**.

### Step 3 — Install Git for Windows

Install from git-scm.com (keep defaults), then in a **new** PowerShell window:
`git --version`.

### Step 4 — Clone the repository

```powershell
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```

> ⚠️ Clone to a **short, space-free path** like `C:\Users\<you>\room_manager_v2`
> (long paths + spaces cause weird failures).

### Step 5 — (Recommended) set your secrets

```powershell
Copy-Item .env.example .env
$env:MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
$env:GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# then run Step 6 in the SAME window
```

### Step 6 — Build & start everything (one command)

```powershell
docker compose up --build -d
```

- First build takes **15–40 minutes**; later starts ~1–2 min.
- Watch: `docker compose ps` and `docker compose logs -f rentmanager`
  (wait → migrate → seed → start, fully automatic).

Continue with **§15.5 Verify the installation**.

---

## 15.4 Lightweight option: app + database only

Best for daily coding or weak machines: PostgreSQL runs in Docker (or native)
and the Next.js app runs directly with Node. You get the **complete web app
with demo data** — only the Java microservices/Kafka/Keycloak extras are absent.

### macOS

```bash
brew install node@22 git
git clone <YOUR-REPO-URL> room_manager_v2 && cd room_manager_v2
npm install
docker compose up -d postgres   # just the database
cp .env.example .env            # check DATABASE_URL → localhost:5432
npx prisma generate
npx prisma migrate deploy
npm run db:seed                 # idempotent demo data
npm run dev                     # → http://localhost:3000
```

(No Docker at all? `brew install postgresql@16 && brew services start
postgresql@16`, then `createuser -s rentmanager` + `createdb -O rentmanager
rentmanager`.)

### Windows (PowerShell)

```powershell
# 1. Install Node.js LTS from nodejs.org, then in a NEW window:
node --version                  # expect v20.x or v22.x
# 2. Install PostgreSQL 16 (EDB installer, port 5432), then create role + DB:
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER rentmanager WITH PASSWORD 'rentmanager' SUPERUSER;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE rentmanager OWNER rentmanager;"
# (Alternative: skip the installer — `docker compose up -d postgres`)
# 3. Clone + run:
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2; cd room_manager_v2
npm install
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev                     # → http://localhost:3000
```

Stop the dev server with `Ctrl+C`. Useful commands: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run db:seed:demo` (fuller demo data).

---

## 15.5 Verify the installation

```bash
docker compose up -d --wait     # blocks until healthchecks pass
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

(Windows PowerShell: `curl.exe -sf http://localhost:3000/api/health` —
a JSON `{"status":"ok",…}` means healthy.)

| What | URL | Login (defaults — change before production!) |
|---|---|---|
| **RentManager app** | http://localhost:3000 | `root@demo.test` / `Demo1234!` |
| API docs (Swagger) | http://localhost:8080/swagger-ui.html | — |
| Nacos | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO files | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana | http://localhost:9090 | `admin` / `admin` |

✅ **Success =** the login page loads, `root@demo.test` signs in, and the
dashboard shows demo properties.

---

## 15.6 First login & next steps

1. Open **http://localhost:3000/login**, sign in as `root@demo.test`
   (password `Demo1234!`). Other demo accounts: `admin@`, `pm@`,
   `accountant@`, `staff@`, `owner@`, `owner2@`, `member@demo.test` — same password.
2. Enroll **2FA** (mandatory for Admin+): Account → Security.
3. Create a **real Super Admin** for yourself, then **disable or re-password
   all `*@demo.test` accounts** before any production use.
4. Follow **Part 8 §8.7 (Admin golden path)**: org/locale → properties →
   users/roles → billing → owners → Telegram → security → backups.
5. Schedule the **nightly backup** (§15.8) — do this on day one.

> ⚠️ Demo data is for training. Never run real money on top of it — deploy
> fresh for production and change **every** default secret (Part 9 + Admin
> Guide §11).

---

## 15.7 Daily commands

```bash
docker compose ps                    # status of every container
docker compose logs -f rentmanager   # follow app logs (Ctrl+C to exit)
docker compose logs -f gateway       # follow API gateway logs
docker compose stop                  # stop all (data kept)
docker compose start                 # start again
docker compose down                  # stop + remove containers (data kept)
docker compose down -v               # ⚠️ stop + DELETE all data (fresh start)
```

(Same commands in macOS Terminal, PowerShell, Git Bash and WSL.)

---

## 15.8 Scheduled jobs

The app exposes cron-shaped job endpoints — call them on a schedule with an
Admin session/token. The three you must schedule from day one:

| Job | Endpoint | Typical schedule |
|---|---|---|
| `billing-daily` | `POST /api/jobs/billing-daily` | Daily ~01:00 |
| `backup` | `POST /api/jobs/backup` (**nightly — don't skip!**) | Daily ~02:00 |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | Daily ~06:00 |

Plus monthly `invoice-generation` (billing day) and `statement-generation`
(payout day); daily/hourly `telegram-dispatch`; daily `sla-sweep`,
`attendance-sweep`, `retention`. Full table: Admin Guide §9.

**macOS/Linux cron** (`crontab -e`, use a dedicated Admin service account):

```bash
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup        -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

**Windows Task Scheduler:** save a `invoke-jobs.ps1` using
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`,
then Create Basic Task → Daily 02:00 → Start a program `powershell.exe` with
`-ExecutionPolicy Bypass -File C:\RentManager\jobs\invoke-jobs.ps1`.

---

## 15.9 Updating & uninstalling

### Updating to a new version

```bash
cd ~/room_manager_v2        # Windows: cd $HOME\room_manager_v2
git pull
docker compose up --build -d
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

Migrations run automatically on boot and are **append-only** (safe to apply to
older snapshots; rollbacks are not attempted — restore from backup instead).

### Uninstalling

- Stop: `docker compose down` (data kept in volumes; `down -v` wipes it).
- Remove Docker Desktop via the normal OS uninstall; delete the repo folder.
- macOS: `rm -rf ~/room_manager_v2` (+ `~/.docker` if removing Docker data).

---

## 15.10 Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Open Docker Desktop and wait for the whale icon to settle; Windows: Settings → General → ✅ **Use the WSL 2 based engine** |
| Build very slow / containers OOM-killed | Docker Settings → Resources → Memory **≥ 8 GB**, CPUs ≥ 4 → Apply & restart; close heavy apps while building |
| `port is already allocated` | Mac: `lsof -i :3000` → `kill <PID>`. Windows: `netstat -ano \| findstr :3000` → `taskkill /PID <pid> /F`. Common culprit: a second Postgres (Mac: `brew services stop postgresql@16`; Windows: Services → `postgresql-x64-16` → Stop) |
| WSL errors / VERSION 1 (Windows) | Enable VT-x/AMD-V in BIOS; [ADMIN] `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` + restart; `wsl --update`; `wsl --set-version Ubuntu 2` |
| App loops "waiting for database" | `docker compose ps` → is `postgres` healthy? Check `docker compose logs postgres`; ensure port 5432 isn't taken |
| Login page loads but sign-in fails | Read `docker compose logs --tail=100 rentmanager` (seed may have failed); verify `/api/health` returns 200 |
| Apple Silicon image warning | Images are multi-arch — no action needed; optionally enable **Rosetta for x86_64 emulation** in Docker Settings |
| `npm install` EPERM / path errors (Windows) | Move repo to a short path (`C:\Users\<you>\room_manager_v2`); exclude it from antivirus real-time scan |
| Disk full | `docker system df` → `docker system prune`; prune old `backups/*.dump`; Windows: `wsl --shutdown` then compact the Docker `.vhdx` |
| Clock skew breaks sessions (WSL after sleep) | `wsl --shutdown`, reopen Docker |

Still stuck? Collect `docker compose ps` + `docker compose logs --tail=100
rentmanager` — they pinpoint 90% of issues. End-user problems → **Part 10**.
