# RentManager — Deploy on macOS (step-by-step)

> Deploy and run RentManager on an Apple Mac. Two paths:
> **Path A — Docker (recommended):** the whole system (app + database + backend
> services) with one command. **Path B — Lightweight local dev:** app + database
> only, for everyday coding.
>
> After deploying, continue with [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) (first
> login, setup, security).

---

## 0. Requirements

### Hardware

| | Minimum | Recommended (full Docker stack) |
|---|---|---|
| Mac | Any Mac running macOS 12+ (Intel or Apple Silicon) | Apple Silicon (M1/M2/M3/M4) or modern Intel |
| RAM | 8 GB | **16 GB** (the full stack runs ~20 containers incl. Java services, Kafka, Keycloak) |
| CPU | 2 cores | 4+ cores |
| Disk | 20 GB free (Docker images + DB + files) | 40 GB+ free SSD |

> 💡 Short on RAM? Use **Path B** (app + PostgreSQL only ≈ 1 GB) — you still get
> the complete RentManager web app with demo data.

### Software

| # | Requirement | Version | How to get it |
|---|---|---|---|
| 1 | **macOS** | 12 (Monterey) or newer |  → System Settings → Software Update |
| 2 | **Docker Desktop for Mac** | 4.x latest | https://www.docker.com/products/docker-desktop (choose **Apple Silicon** or **Intel** chip) |
| 3 | **Git** | any recent | `xcode-select --install` (also gives you command-line tools) |
| 4 | **Homebrew** *(Path B only)* | latest | https://brew.sh |
| 5 | **Node.js** *(Path B only)* | **20 or 22 LTS** | `brew install node@22` (project builds with Node 20 in Docker; CI uses 22) |
| 6 | **PostgreSQL 16** *(Path B, if not using Docker for DB)* | 16 | `brew install postgresql@16` — or simply `docker compose up -d postgres` |

### Ports that must be free

`3000` (app) · `5432` (postgres) · `6379` (redis) · `8080–8088` (gateway +
services) · `8848/9848/9849` (nacos) · `7080` (keycloak) · `8090/8091`
(kafka ui/registry) · `9090` (grafana) · `9092` (kafka) · `9000/9001` (minio).
Path B needs only `3000` + `5432`.

### Knowledge assumed

Opening **Terminal**, copy-pasting commands, opening `http://localhost:…` in a
browser. No Docker experience needed — every command is given below.

---

## Path A — Full stack with Docker (recommended)

### Step 1 — Install Docker Desktop

1. Download from <https://www.docker.com/products/docker-desktop/> — pick
   **Mac with Apple Silicon** or **Mac with Intel chip** to match your Mac
   ( → About This Mac → Chip).
2. Open the `.dmg`, drag **Docker** to Applications, launch it.
3. Wait for the whale icon in the menu bar to stop animating (Docker is running).
4. Verify in Terminal:
   ```bash
   docker --version
   docker compose version
   ```
   Both should print version numbers.

5. **Give Docker enough memory** (important!): Docker Desktop → ⚙ Settings →
   **Resources** → set **Memory to at least 8 GB** (10–12 GB if you have 16 GB),
   CPUs ≥ 4 → **Apply & restart**.

### Step 2 — Install Git (command-line tools)

```bash
xcode-select --install
```
If it says "already installed", you're good. Verify: `git --version`.

### Step 3 — Clone the repository

```bash
cd ~
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
```
> Replace `<YOUR-REPO-URL>` with the repo's HTTPS or SSH URL
> (e.g. `https://github.com/<org>/room_manager_v2.git`).
> If you already have the folder, just `cd` into it and `git pull`.

### Step 4 — (Optional but recommended) set your secrets

For a local demo you can skip this — the compose file ships safe dev defaults.
For anything shared/production-like, create overrides **before** first boot:

```bash
cp .env.example .env   # local-run defaults; edit values inside as needed
```

Key secrets used by `docker-compose.yml` (each has a `:-default` fallback you
should override via environment):

```bash
export MINIO_ROOT_PASSWORD="change-me-minio-32chars-min"
export GRAFANA_ADMIN_PASSWORD="change-me-grafana"
# then run compose in the same shell (Step 5)
```

Full hardening list: `ADMIN_GUIDE.md` §11.

### Step 5 — Build & start everything (one command)

```bash
docker compose up --build -d
```

- First run **downloads images and builds the Java + Next.js apps** — expect
  **10–30 minutes** on first build (later starts take ~1–2 min).
- `-d` = run in background; your Terminal stays usable.
- Alternatively: `bash scripts/deploy-docker-local.sh` (prints all URLs at the end).

Watch progress:

```bash
docker compose ps              # status of every container
docker compose logs -f rentmanager   # app log: wait → migrate → seed → start
```

The app container automatically: **waits for PostgreSQL → runs Prisma
migrations → seeds demo data (idempotent) → starts on port 3000**.

### Step 6 — Wait for green, then verify

```bash
docker compose up -d --wait     # blocks until healthchecks pass (or timeout)
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

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

### Step 7 — Daily commands (cheat sheet)

```bash
docker compose ps              # status
docker compose logs -f rentmanager   # follow app logs (Ctrl+C to exit)
docker compose logs -f gateway       # follow API gateway logs
docker compose stop              # stop all (data kept)
docker compose start             # start again
docker compose down              # stop + remove containers (data kept in volumes)
docker compose down -v           # ⚠️ stop + DELETE all data volumes (fresh start)
npm run docker:status            # same as `docker compose ps`
```

### Step 8 — Updating to a new version

```bash
cd ~/room_manager_v2
git pull
docker compose up --build -d
curl -sf http://localhost:3000/api/health && echo " APP OK"
```

### Step 9 — Scheduled jobs (cron)

macOS has cron (or use `launchd`). Edit with `crontab -e` — example nightly
jobs (use a dedicated Admin service account cookie/token):

```bash
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup        -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

Full job table: `ADMIN_GUIDE.md` §9. Nightly **backup** is the one you must not skip.

### Step 10 — Stopping / uninstalling

- Stop: `docker compose down` (data kept; `down -v` wipes it).
- Remove Docker Desktop: drag out of Applications + `rm -rf ~/.docker`.
- Remove repo: `rm -rf ~/room_manager_v2` (after `down -v` if you want data gone).

---

## Path B — Lightweight local dev (app + database only)

Best for daily coding or weak machines. You run PostgreSQL in Docker and the
Next.js app directly with Node.

### Step 1 — Install Homebrew, Node, Git

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22 git
node --version   # expect v22.x (v20.x also fine)
```

### Step 2 — Clone + install dependencies

```bash
cd ~
git clone <YOUR-REPO-URL> room_manager_v2
cd room_manager_v2
npm install
```

### Step 3 — Start PostgreSQL (Docker, just the DB)

```bash
docker compose up -d postgres
```

Don't have Docker at all? `brew install postgresql@16 && brew services start postgresql@16`,
then create the DB/user to match `.env`:
```bash
createuser -s rentmanager
createdb -O rentmanager rentmanager
```

### Step 4 — Configure, migrate, seed, run

```bash
cp .env.example .env            # check DATABASE_URL points to localhost:5432
npx prisma generate
npx prisma migrate deploy       # or: npm run db:migrate
npm run db:seed                 # idempotent demo data
npm run dev                     # → http://localhost:3000
```

Login with `root@demo.test` / `Demo1234!`. Stop with `Ctrl+C`.

### Step 5 — Useful dev commands

```bash
npm run dev            # dev server with hot reload
npm run lint           # ESLint
npm run typecheck      # TypeScript check
npm test               # full Vitest suite (needs test DB; see package.json)
npm run db:seed:demo   # fuller demo dataset (SEED_FULL_DEMO=1)
```

---

## Troubleshooting (macOS)

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Open Docker Desktop and wait for the whale icon to settle; then retry |
| Build extremely slow / containers OOM-killed | Docker Settings → Resources → raise Memory to 8–12 GB, CPUs ≥ 4 → Apply & restart |
| `port is already allocated` | Something uses the port: `lsof -i :3000` (or `:5432`…) → `kill <PID>`; common culprits: another Postgres (`brew services stop postgresql@16`), old containers (`docker ps`) |
| Apple Silicon + image `platform` warning | Compose uses multi-arch images — no action needed. If one image lacks arm64, Docker emulates via Rosetta (slower first run). Optional: Docker Settings → General → enable **Rosetta for x86_64 emulation** |
| `permission denied` on `scripts/*.sh` | `chmod +x scripts/deploy-docker-local.sh` then retry |
| App container loops "waiting for database" | `docker compose ps` → is `postgres` healthy? Check `docker compose logs postgres`; ensure port 5432 isn't taken by a Homebrew Postgres |
| Login page loads but sign-in fails | Check `docker compose logs rentmanager` tail (seed may have failed); verify `/api/health` returns 200 |
| `xcode-select --install` fails/no network | Download "Command Line Tools for Xcode" manually from Apple Developer, or install Git via `brew install git` |
| Disk space warnings | `docker system df` → `docker system prune` (frees build cache); prune old `backups/*.dump` |

Still stuck? Collect `docker compose ps` + `docker compose logs --tail=100 rentmanager`
and share them with your admin — they pinpoint 90% of issues.

---

*Next: [`ADMIN_GUIDE.md`](./ADMIN_GUIDE.md) — first login, setup order, users, security.*
