# 9. Scheduled jobs (cron)


## Job catalogue

Job endpoints are cron-shaped — call them on a schedule in production with an
Admin session/token. All runs are audited.

| Job | Endpoint | Typical schedule | Needs |
|---|---|---|---|
| `invoice-generation` | `POST /api/jobs/invoice-generation` | Monthly, on billing day | M07:create |
| `billing-daily` | `POST /api/jobs/billing-daily` | Daily ~01:00 | M06:update |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | Daily ~06:00 | M33:update |
| `statement-generation` | `POST /api/jobs/statement-generation` | Monthly, payout day | GLOBAL M24:update |
| `telegram-dispatch` | `POST /api/jobs/telegram-dispatch` | Daily (or hourly) | M21:update |
| `sla-sweep` | `POST /api/jobs/sla-sweep` | Daily | M19:update |
| `attendance-sweep` | `POST /api/jobs/attendance-sweep` | Daily | M23:update |
| `retention` | `POST /api/jobs/retention` | Daily/weekly | M28:update |
| `backup` | `POST /api/jobs/backup` | **Nightly** | M27:update |

Example (macOS/Linux cron — server must be reachable; use a service account
cookie/token):

```bash
# RentManager nightly jobs (server-local cron)
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup          -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts     -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

On Windows use **Task Scheduler** → "Run a program" →
`powershell.exe -File C:\RentManager\jobs\invoke-jobs.ps1` with an equivalent
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`.
See `DEPLOY_WINDOWS.md` §"Scheduled jobs".

> Prefer a **dedicated service account** (Admin role, long random password,
> 2FA enrolled, credentials in the server vault) over any personal account.

---
