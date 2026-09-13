# 10. Backup & restore


## Backup and restore

Full runbook: [`BACKUP.md`](./BACKUP.md). Summary for admins:

- **What:** consistent full PostgreSQL dump via `pg_dump` (custom format),
  safe on a live server. Uploads live in object storage — **back up the
  bucket separately** with provider tooling.
- **Where:** `backups/backup-<timestamp>.dump` (or `$BACKUP_DIR`); container
  path `/app/backups` → `rentmanager-backups` volume. Keeps newest **7**.
- **Restore (order matters):**
  1. `docker compose stop rentmanager`
  2. `createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump`, point `DATABASE_URL` at it
  3. `npx prisma migrate deploy` (forward-only, always safe)
  4. Restart, then verify: `GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · collections report reconciles
- **RPO/RTO:** nightly snapshots ⇒ ≤24h RPO. Test-restore quarterly; an
  untested backup is not a backup.

---
