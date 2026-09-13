# 9. ការងារតាមកាលវិភាគ (cron)


## កាតាឡុកការងារ

Job endpoints មានរាងជា cron — ហៅវាតាមកាលវិភាគក្នុង production ជាមួយ
Admin session/token។ Runs ទាំងអស់ត្រូវបាន audit។

| ការងារ | Endpoint | កាលវិភាគធម្មតា | ត្រូវការ |
|---|---|---|---|
| `invoice-generation` | `POST /api/jobs/invoice-generation` | ប្រចាំខែ តាម billing day | M07:create |
| `billing-daily` | `POST /api/jobs/billing-daily` | ប្រចាំថ្ងៃ ~01:00 | M06:update |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | ប្រចាំថ្ងៃ ~06:00 | M33:update |
| `statement-generation` | `POST /api/jobs/statement-generation` | ប្រចាំខែ តាម payout day | GLOBAL M24:update |
| `telegram-dispatch` | `POST /api/jobs/telegram-dispatch` | ប្រចាំថ្ងៃ (ឬម៉ោង) | M21:update |
| `sla-sweep` | `POST /api/jobs/sla-sweep` | ប្រចាំថ្ងៃ | M19:update |
| `attendance-sweep` | `POST /api/jobs/attendance-sweep` | ប្រចាំថ្ងៃ | M23:update |
| `retention` | `POST /api/jobs/retention` | ប្រចាំថ្ងៃ/សប្តាហ៍ | M28:update |
| `backup` | `POST /api/jobs/backup` | **រៀងរាល់យប់** | M27:update |

ឧទាហរណ៍ (macOS/Linux cron — server ត្រូវ reachable፤ ប្រើ service account
cookie/token)៖

```bash
# RentManager nightly jobs (server-local cron)
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup          -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts     -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

លើ Windows ប្រើ **Task Scheduler** → "Run a program" →
`powershell.exe -File C:\RentManager\jobs\invoke-jobs.ps1` ជាមួយ
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`
សមមូល។ មើល `DEPLOY_WINDOWS.md` §"Scheduled jobs"។

> ចូលចិត្ត **dedicated service account** (role Admin, ពាក្យសម្ងាត់ចៃដន្យវែង,
> 2FA បានចុះឈ្មោះ, credentials ក្នុង server vault) ជាងគណនីផ្ទាល់ខ្លួនណា។

---
