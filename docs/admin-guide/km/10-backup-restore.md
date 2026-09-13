# 10. ការបម្រុងទុក និង restore


## ការបម្រុងទុក និង restore

Runbook ពេញលេញ៖ [`BACKUP.md`](./BACKUP.md)។ សង្ខេបសម្រាប់ admins៖

- **អ្វី៖** full PostgreSQL dump ស៊ីសង្វាក់គ្នាតាម `pg_dump` (custom format),
  មានសុវត្ថិភាពលើ live server។ Uploads នៅ object storage — **បម្រុងទុក
  bucket ដាច់ដោយឡែក** ជាមួយ provider tooling។
- **ទីណា៖** `backups/backup-<timestamp>.dump` (ឬ `$BACKUP_DIR`)፤ ផ្លូវ container
  `/app/backups` → volume `rentmanager-backups`។ រក្សា **7** ថ្មីបំផុត។
- **Restore (លំដាប់សំខាន់)៖**
  1. `docker compose stop rentmanager`
  2. `createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump` ចង្អុល `DATABASE_URL` ទៅវា
  3. `npx prisma migrate deploy` (forward-only, មានសុវត្ថិភាពជានិច្ច)
  4. Restart បន្ទាប់មកផ្ទៀងផ្ទាត់៖ `GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · របាយការណ៍ collections reconcile
- **RPO/RTO៖** nightly snapshots ⇒ RPO ≤24h។ Test-restore ប្រចាំត្រីមាស፤
  backup ដែលមិនបានសាកល្បងមិនមែន backup ទេ។

---
