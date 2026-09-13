# 14. ការដោះស្រាយបញ្ហាសម្រាប់ admin


## រោគសញ្ញាទូទៅ

| រោគសញ្ញា | មូលហេតុដែលទំនងបំផុត → ដំណោះស្រាយ |
|---|---|
| App 500s / មិនចាប់ផ្តើម | DB មិនទាន់រួចរាល់ → `docker compose ps` ពិនិត្យ `postgres` healthy፤ បន្ទាប់មក `docker compose logs rentmanager` (entrypoint រង់ចាំ + migrates + seeds — អាន log tail) |
| Login បរាជ័យសម្រាប់អ្នកទាំងអស់ | Session/cookie domain ឬ `DATABASE_URL` ខុស፤ ពិនិត្យ env + `/api/health` |
| `403 FORBIDDEN` លើសកម្មភាព | RBDC denial ត្រឹមត្រូវ → ពិនិត្យ roles + scopes + property assignments របស់អ្នកប្រើ (§4–§5) |
| Menu item បាត់ | គ្មាន `read` លើ module នោះ ឬ feature flag បិទក្នុង Settings → Features |
| Invoice job មិនដំណើរការ | Cron/Task Scheduler មិន fire ឬប្រើ cookie ផុតកំណត់ → ពិនិត្យ job audit rows + scheduler logs |
| Webhook double-posted | មិនគួរកើត (idempotent) → ផ្ទៀងផ្ទាត់ `PAYMENT_WEBHOOK_SECRET` ត្រូវនឹង gateway config፤ ពិនិត្យ logs |
| Telegram ស្ងាត់ | Bot token/secret ខុស ឬ template បិទ → Settings → Secrets/Templates፤ ពិនិត្យ `telegram-dispatch` runs |
| Audit verify បរាជ័យ | **ឈប់ហើយស៊ើបអង្កេត** — អាចមាន tampering፤ restore ពី backup តែបន្ទាប់ពីរក root cause |
| ថាសពេញ | Docker volumes (DB, MinIO, backups) → prune backups ចាស់ៗ, `docker system df`, ពង្រីក volume |
| Build លើកដំបូងយឺត | ធម្មតា៖ Java services + Next build ត្រូវពេលយូរ፤ ឲ្យ Docker RAM ≥8GB, កុំ pin ទៅ 1 CPU (`NEXT_BUILD_CPUS`) |

បញ្ហាដំឡើងតាម platform → ផ្នែក troubleshooting នៃ `DEPLOY_MAC.md` /
`DEPLOY_WINDOWS.md`។ បញ្ហាអ្នកប្រើប្រាស់ → `manual/10-troubleshooting.md`។

---
