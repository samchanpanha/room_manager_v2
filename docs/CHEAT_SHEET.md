# RentManager — Admin Cheat Sheet (one page)

> Print tip: open `cheat-sheet.html` next to the built guide (`/guide/cheat-sheet.html`
> in-app, or `docs/manual/site/cheat-sheet.html` in the repo) and press **Print → Save as PDF**.

## URLs & logins

| Service | URL | Login |
|---|---|---|
| App | http://localhost:3000 | `root@demo.test` / `Demo1234!` |
| Swagger APIs | http://localhost:8080/swagger-ui.html | — |
| Nacos / Keycloak | :8848/nacos · :7080 | `nacos/nacos` · `admin/admin` |
| Consul | :8500 | — (services/health via UI) |
| Kafka UI / MinIO / Grafana | :8090 · :9001 · :9090 | — · `rentmanager/…-s3-secret` · `admin/admin` |

Demo accounts, all password `Demo1234!`: `root@` Super Admin · `admin@` Admin ·
`pm@` Property Mgr (BLR only) · `accountant@` · `staff@` · `owner@` · `owner2@` · `member@`.

## Deploy (Docker — Mac & Windows)

```bash
git clone <URL> room_manager_v2 && cd room_manager_v2
docker compose up --build -d        # first build 10–40 min
docker compose up -d --wait         # wait for green
curl -sf http://localhost:3000/api/health   # → {"status":"ok"}
```

Windows first: `wsl --install` (Admin) → Docker Desktop with WSL 2 backend.
Docker Settings → Resources → **RAM ≥ 8 GB**, CPUs ≥ 4.

## Daily commands

```bash
docker compose ps | logs -f rentmanager | stop | start | down   # down -v = ⚠️ wipe data
git pull && docker compose up --build -d                        # update
```

## Must-schedule jobs (Admin token)

| Job | Endpoint | When |
|---|---|---|
| billing | `POST /api/jobs/billing-daily` | daily 01:00 |
| **backup** | `POST /api/jobs/backup` | **daily 02:00 — never skip** |
| alerts | `POST /api/jobs/rent-alerts` | daily 06:00 |
| invoices / statements | `…/invoice-generation` / `…/statement-generation` | monthly |

Mac: `crontab -e` + `curl -X POST … -H "Cookie: $RM_ADMIN_COOKIE"`.
Windows: Task Scheduler → `powershell.exe -ExecutionPolicy Bypass -File C:\RentManager\jobs\invoke-jobs.ps1`.

## First-login checklist

1. Sign in `root@demo.test` → enroll **2FA** (Account → Security)
2. Create your **real Super Admin** → disable all `*@demo.test`
3. Settings: Org · Locale (currency final!) · Billing · Secrets
4. Properties → Buildings → Floors → Rooms → users/roles
5. Schedule jobs (§ above) + test-restore the backup once

## Fast fixes

| Symptom | Check |
|---|---|
| Daemon error | Open Docker Desktop, wait for whale; Win: WSL 2 backend on |
| Port allocated | Mac `lsof -i :3000`; Win `netstat -ano \| findstr :3000` → kill it |
| DB wait loop | `docker compose ps` → postgres healthy? `logs postgres` |
| Can't sign in | `logs --tail=100 rentmanager`; `/api/health` = 200? |
| 403 on action | Correct RBDC denial → roles/scopes/property assignment |
| No menu item | Missing `read` on module, or feature flag off |

Health: `/api/health` · audit: `/api/audit/verify` → `{ok:true}` · reconcile: collections report.
Backups: `backups/*.dump` (keep 7) — restore runbook in `docs/BACKUP.md`.
