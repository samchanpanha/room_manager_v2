# Backup & Restore Runbook (M27)

## What is backed up

The operational PostgreSQL database. Snapshots are **consistent full copies**
taken with `pg_dump` (custom format), which is safe against a **live** server
(readers/writers are never blocked or torn). Uploads (M17 documents) live in
object storage (S3-compatible when `S3_*` env credentials are set, dev disk
otherwise) — in production back up the bucket separately with the provider's
lifecycle tooling.

`pg_dump`/`pg_restore` come from `postgresql-client` — installed in the Docker
image; install the same package locally to run the job outside Docker.

## The job

```
POST /api/jobs/backup        # M27:update (Admin+/Super Admin)
→ { file, bytes, pruned }
```

- Writes `backups/backup-<ISO-timestamp>.dump` (or `$BACKUP_DIR`).
- Keeps the newest **7** snapshots, prunes the rest.
- Every run is audited (`M27 create backup`, hash-chained like all audit rows).
- **Nightly wiring** (Phase 22 deploy): cron/systemd timer hitting the
  endpoint with an Admin session or internal token, after the backup window.

## Restore runbook

1. **Stop the app** (or drain traffic): `docker compose stop rentmanager`
   (or scale to zero).
2. **Restore the snapshot** into a fresh database. The dump is in Postgres
   custom format — restore with `pg_restore`:
   ```
   # target DB must exist and be empty (drop/recreate it first if re-restoring):
   createdb rentmanager_restore
   pg_restore --dbname=rentmanager_restore backups/backup-<stamp>.dump
   ```
   Then point `DATABASE_URL` at the restored DB (or restore in place after
   dropping the current schema).
3. **Check migration state** (the snapshot may predate a migration):
   ```
   npx prisma migrate deploy
   ```
   Migrations are append-only (§3) — applying them to an older snapshot is
   always safe; rolling back is not attempted.
4. **Restart** and **verify** (order matters — each is an acceptance probe):
   ```
   GET /api/health                     → 200
   GET /api/audit/verify               → { ok: true }   # trail intact
   GET /api/reports/collections-arrears → summary.reconciles == "yes"
   ```
   The last two prove the restored books reconcile internally (§M26/§M27).
5. **Audit the restore itself**: the verification results land in the audit
   trail (`M27 verify` / report reads) — document the incident reference in
   the ticket.

## Retention & RPO

- Snapshot retention: 7 nightly copies (`KEEP_BACKUPS` in `src/lib/backup.ts`).
- RPO ≈ 24 h with the nightly job; run the job manually before risky
  operations (migration deploys, bulk imports).
- `backups/` is git-ignored. Never commit snapshots; they contain PII.