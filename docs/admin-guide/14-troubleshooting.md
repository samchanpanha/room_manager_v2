# 14. Troubleshooting for admins


## Common symptoms

| Symptom | Most likely cause → fix |
|---|---|
| App 500s / won't start | DB not ready → `docker compose ps`, check `postgres` healthy; then `docker compose logs rentmanager` (entrypoint waits + migrates + seeds — read the log tail) |
| Login fails for everyone | Session/cookie domain or `DATABASE_URL` wrong; check env + `/api/health` |
| `403 FORBIDDEN` on an action | Correct RBDC denial → check user's roles + scopes + property assignments (§4–§5) |
| Missing menu item | No `read` on that module, or feature flag off in Settings → Features |
| Invoice job didn't run | Cron/Task Scheduler didn't fire or used an expired cookie → check job audit rows + scheduler logs |
| Webhook double-posted | Shouldn't happen (idempotent) → verify `PAYMENT_WEBHOOK_SECRET` matches gateway config; check logs |
| Telegram silent | Wrong bot token/secret, or template disabled → Settings → Secrets/Templates; check `telegram-dispatch` runs |
| Audit verify fails | **Stop and investigate** — possible tampering; restore from backup only after root-causing |
| Disk full | Docker volumes (DB, MinIO, backups) → prune old backups, `docker system df`, expand volume |
| Slow first build | Normal: Java services + Next build take a while; give Docker ≥8GB RAM, don't pin to 1 CPU (`NEXT_BUILD_CPUS`) |

Platform-specific install issues → `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`
troubleshooting sections. End-user issues → `manual/10-troubleshooting.md`.

---
