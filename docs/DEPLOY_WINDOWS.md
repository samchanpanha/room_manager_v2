# RentManager — Deploy on Windows (step-by-step)

> Deploy and run RentManager on Windows 10/11. Two paths:
> **Path A — Docker (recommended):** the whole system (app + database + backend
> services) with one command. **Path B — Native local dev:** app + database
> installed directly on Windows, for everyday coding.
>
> After deploying, continue with [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) (first
> login, setup, security).

---

## 0. Requirements

### Hardware

| | Minimum | Recommended (full Docker stack) |
|---|---|---|
| PC | 64-bit Windows 10 21H2+ / Windows 11 | Modern desktop/laptop, SSD strongly recommended |
| RAM | 8 GB | **16 GB** (the full stack runs ~20 containers incl. Java services, Kafka, Keycloak) |
| CPU | 2 cores, virtualization (VT-x/AMD-V) enabled in BIOS | 4+ cores |
| Disk | 25 GB free (WSL2 virtual disk + Docker images + DB) | 50 GB+ free |

> 💡 Short on RAM? Use **Path B** (app + PostgreSQL ≈ 1 GB) — you still get the
> complete RentManager web app with demo data.

### Software

| # | Requirement | Version | How to get it |
|---|---|---|---|
| 1 | **Windows** | 10 64-bit 21H2+ / 11 64-bit | Settings → Windows Update |
| 2 | **WSL 2 + Ubuntu** *(Path A)* | WSL 2 (kernel 5.x) | `wsl --install` in Admin PowerShell (Step 1) |
| 3 | **Docker Desktop for Windows** *(Path A)* | 4.x latest | https://www.docker.com/products/docker-desktop (uses the WSL 2 backend) |
| 4 | **Git for Windows** | latest | https://git-scm.com/download/win (gives you Git + **Git Bash**) |
| 5 | **Node.js LTS** *(Path B only)* | **20 or 22 LTS** | https://nodejs.org → LTS installer (project builds with Node 20 in Docker; CI uses 22) |
| 6 | **PostgreSQL 16** *(Path B, if not using Docker for DB)* | 16 | https://www.postgresql.org/download/windows/ (EDB installer) — or `docker compose up -d postgres` |

> 🗒️ **Which terminal?** Path A commands work in **PowerShell**, **Git Bash**,
> or WSL Ubuntu — pick one and stick with it. This guide shows **PowerShell**.
> Run PowerShell as **Administrator** only where marked [ADMIN].

### Ports that must be free

`3000` (app) · `5432` (postgres) · `6379` (redis) · `8080–8088` (gateway +
services) · `8848/9848/9849` (nacos) · `7080` (keycloak) · `8090/8091`
(kafka ui/registry) · `9090` (grafana) · `9092` (kafka) · `9000/9001` (minio).
Path B needs only `3000` + `5432`.

### Knowledge assumed

Opening PowerShell, copy-pasting commands, opening `http://localhost:…` in a
browser. No Docker/WSL experience needed — every command is given below.

---

## Path A — Full stack with Docker (recommended)

### Step 1 — Enable WSL 2 [ADMIN]

1. Open **PowerShell as Administrator**: Start menu → type `PowerShell` →
   right-click → **Run as administrator**.
2. Install WSL + Ubuntu:
   ```powershell
   wsl --install
   ```
   (On older Windows 10 this enables WSL/Virtual Machine Platform and installs
   Ubuntu. **Restart** when asked, then open **Ubuntu** once to create your
   Linux username/password.)
3. Verify you're on WSL 2:
   ```powershell
   wsl --list --verbose
   ```
   The Ubuntu line must show `VERSION 2`. If it shows 1: `wsl --set-version Ubuntu 2`.
4. If `wsl --install` fails with a virtualization error → reboot into
   **BIOS/UEFI** and enable **VT-x / AMD-V** (sometimes called SVM / VT-d),
   then retry.

### Step 2 — Install Docker Desktop

1. Download from <https://www.docker.com/products/docker-desktop/> (**Windows**
   installer) and run it. ✅ Keep **"Use WSL 2 instead of Hyper-V"** ticked.
2. Restart if asked, launch **Docker Desktop**, accept the agreement, skip/close
   the tutorial.
3. Wait for the whale icon (system tray, bottom-right) to settle, then verify
   in PowerShell:
   ```powershell
   docker --version
   docker compose version
   ```
4. **Give Docker enough memory** (important!): Docker Desktop → ⚙ Settings →
   **Resources** → **Memory ≥ 8 GB** (10–12 GB if you have 16 GB), CPUs ≥ 4 →
   **Apply & restart**.

### Step 3 — Install Git for Windows

1. Install from <https://git-scm.com/download/win> (keep all installer defaults).
2. Verify in a **new** PowerShell window:
   ```powershell
   git --version
   ```

### Step 4 — Clone the repository

```powershell
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```
> Replace `<YOUR-REPO-URL>` with the repo URL
> (e.g. `https://github.com/<org>/room_manager_v2.git`).
> If you already have the folder, just `cd` into it and run `git pull`.
>
> ⚠️ Clone to a **short, space-free path** like `C:\Users\<you>\room_manager_v2`
> (long paths + spaces cause weird failures). If you work inside WSL Ubuntu,
> clone under `~` there instead for much faster file I/O.

### Step 5 — (Optional but recommended) set your secrets

For a local demo you can skip this — the compose file ships safe dev defaults.
For anything shared/production-like, set overrides **before** first boot:

```powershell
Copy-Item .env.example .env   # local-run defaults; edit values inside as needed
$env:MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
$env:GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# then run compose in the SAME window (Step 6)
```

Full hardening list: `ADMIN_GUIDE.md` §11.

### Step 6 — Build & start everything (one command)

```powershell
docker compose up --build -d
```

- First run **downloads images and builds the Java + Next.js apps** — expect
  **15–40 minutes** on first build (later starts take ~1–2 min).
- `-d` = run in background; your terminal stays usable.
- (In **Git Bash** you can instead run `bash scripts/deploy-docker-local.sh`,
  which prints all URLs at the end.)

Watch progress:

```powershell
docker compose ps                    # status of every container
docker compose logs -f rentmanager   # app log: wait → migrate → seed → start
```

The app container automatically: **waits for PostgreSQL → runs Prisma
migrations → seeds demo data (idempotent) → starts on port 3000**.

### Step 7 — Wait for green, then verify

```powershell
docker compose up -d --wait     # blocks until healthchecks pass (or timeout)
curl.exe -sf http://localhost:3000/api/health
```

(`curl.exe` is built into Windows 10/11. A JSON `{"status":"ok",…}` = healthy.)

Then open in your browser:

| What | URL | Login |
|---|---|---|
| **RentManager app** | http://localhost:3000 | `root@demo.test` / `Demo1234!` |
| API docs (Swagger) | http://localhost:8080/swagger-ui.html | — |
| Nacos | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO (files) | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana | http://localhost:9090 | `admin` / `admin` |

✅ **Success =** login page loads, `root@demo.test` signs in, dashboard shows
demo properties. Continue with `ADMIN_GUIDE.md` §3 (first-login tasks).

### Step 8 — Daily commands (cheat sheet)

```powershell
docker compose ps                    # status
docker compose logs -f rentmanager   # follow app logs (Ctrl+C to exit)
docker compose logs -f gateway       # follow API gateway logs
docker compose stop                  # stop all (data kept)
docker compose start                 # start again
docker compose down                  # stop + remove containers (data kept in volumes)
docker compose down -v               # ⚠️ stop + DELETE all data volumes (fresh start)
```

### Step 9 — Updating to a new version

```powershell
cd $HOME\room_manager_v2
git pull
docker compose up --build -d
curl.exe -sf http://localhost:3000/api/health
```

### Step 10 — Scheduled jobs (Task Scheduler)

Windows equivalent of cron. Example: nightly backup + billing jobs.

1. Save this as `C:\RentManager\jobs\invoke-jobs.ps1` (create the folder first):
   ```powershell
   # RentManager nightly jobs — fill in a dedicated Admin session cookie/token
   $Headers = @{ Cookie = $env:RM_ADMIN_COOKIE }
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/billing-daily -Headers $Headers
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup        -Headers $Headers
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/rent-alerts   -Headers $Headers
   ```
2. Open **Task Scheduler** → **Create Basic Task…** → name `RentManager nightly` →
   Trigger **Daily 02:00** → Action **Start a program**:
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File C:\RentManager\jobs\invoke-jobs.ps1`
3. Tick **"Run whether user is logged on or not"** for a server-style machine.

Full job table: `ADMIN_GUIDE.md` §9. Nightly **backup** is the one you must not skip.

### Step 11 — Stopping / uninstalling

- Stop: `docker compose down` (data kept; `down -v` wipes it).
- Uninstall Docker Desktop: Settings → Apps → Docker Desktop → Uninstall.
- Remove repo: delete the `room_manager_v2` folder (after `down -v` if you want data gone).

---

## Path B — Native local dev (no Docker for the app)

Best for daily coding or weak machines. You install Node + PostgreSQL on
Windows and run the Next.js app directly.

### Step 1 — Install Node.js LTS

1. Download the **LTS** installer from <https://nodejs.org/> and run it
   (keep defaults — it adds Node to PATH).
2. In a **new** PowerShell window:
   ```powershell
   node --version   # expect v20.x or v22.x
   npm --version
   ```

### Step 2 — Install PostgreSQL 16

1. Run the EDB installer from <https://www.postgresql.org/download/windows/>.
   - Remember the `postgres` superuser password you set.
   - Keep port **5432**, locale default. (Stack Builder step: uncheck everything.)
2. Open **pgAdmin** (installed with it) or `psql`, and create the app role + DB
   to match `.env`:
   ```sql
   CREATE USER rentmanager WITH PASSWORD 'rentmanager' SUPERUSER;
   CREATE DATABASE rentmanager OWNER rentmanager;
   ```
   Or via PowerShell (`psql` is in `C:\Program Files\PostgreSQL\16\bin`):
   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER rentmanager WITH PASSWORD 'rentmanager' SUPERUSER;"
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE rentmanager OWNER rentmanager;"
   ```

> Alternative: skip the installer and run just the DB in Docker:
> `docker compose up -d postgres` (needs Path A Steps 1–2 done).

### Step 3 — Clone + install dependencies

```powershell
cd $HOME
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
npm install
```

### Step 4 — Configure, migrate, seed, run

```powershell
Copy-Item .env.example .env   # check DATABASE_URL points to localhost:5432
npx prisma generate
npx prisma migrate deploy     # or: npm run db:migrate
npm run db:seed               # idempotent demo data
npm run dev                   # → http://localhost:3000
```

Login with `root@demo.test` / `Demo1234!`. Stop with `Ctrl+C`.

### Step 5 — Useful dev commands

```powershell
npm run dev            # dev server with hot reload
npm run lint           # ESLint
npm run typecheck      # TypeScript check
npm test               # full Vitest suite (needs test DB; see package.json)
npm run db:seed:demo   # fuller demo dataset (SEED_FULL_DEMO=1)
```

---

## Troubleshooting (Windows)

| Problem | Fix |
|---|---|
| `wsl --install` fails / "Virtual Machine Platform" error | Enable virtualization in **BIOS** (VT-x/AMD-V/SVM); then [ADMIN] `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` + restart + retry |
| WSL shows VERSION 1 | [ADMIN] `wsl --set-version Ubuntu 2`; if it fails, install the WSL2 kernel update package from Microsoft (`wsl --update`) |
| `Cannot connect to the Docker daemon` / Docker won't start | Open Docker Desktop, wait for whale icon to settle; Settings → General → ✅ **Use the WSL 2 based engine**; Resources → WSL Integration → ✅ enable your Ubuntu |
| Containers OOM / build very slow | Docker Settings → Resources → Memory **≥ 8 GB**, CPUs ≥ 4 → Apply & restart. Close Chrome/Teams while building |
| `port is already allocated` | Find it: `netstat -ano \| findstr :3000` → `taskkill /PID <pid> /F`. Common: a local Postgres service (Services → `postgresql-x64-16` → Stop, or set it to Manual) |
| `curl` works but browser can't open localhost:3000 | Check Windows Firewall / third-party antivirus isn't blocking; ensure containers are `healthy` (`docker compose ps`) |
| Line-ending weirdness in `.sh` scripts | Run shell scripts from **Git Bash** (`bash scripts/deploy-docker-local.sh`), not PowerShell; or just use `docker compose …` directly |
| `npm install` fails with EPERM / path errors | Move repo to a short path (`C:\Users\<you>\room_manager_v2`); exclude the folder from Windows Defender real-time scan; close editors locking files |
| `prisma migrate` can't reach DB (Path B) | Is Postgres running? Services → `postgresql-x64-16` → Running. Check `DATABASE_URL` password matches what you set; default `.env` expects user/password `rentmanager` |
| Login page loads but sign-in fails | `docker compose logs --tail=100 rentmanager` — seed may have failed; verify `/api/health` returns 200 |
| Disk space warnings (WSL2 `.vhdx` grows) | `docker system df` → `docker system prune`; compact WSL disk: `wsl --shutdown` then `Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx" -Mode Full` [ADMIN] |
| Clock skew breaks auth/sessions (WSL) | After sleep, run `wsl --shutdown` and reopen Docker — resyncs the WSL clock |

Still stuck? Collect `docker compose ps` + `docker compose logs --tail=100 rentmanager`
and share them with your admin — they pinpoint 90% of issues.

---

*Next: [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) — first login, setup order, users, security.*
