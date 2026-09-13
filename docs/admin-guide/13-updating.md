# 13. Updating the system


## Update procedure

```bash
# 1. Snapshot first (backup job or volume backup)
# 2. Pull + rebuild + restart
git pull
docker compose up --build -d
# 3. Migrations run automatically in the entrypoint; verify:
curl -sf http://localhost:3000/api/health
docker compose ps
```

- Migrations are **append-only** — safe to apply to older snapshots; rollbacks
  are not attempted (restore from backup if you must go back).
- Watch `docker compose logs -f rentmanager` on first boot after an update.
- Pin image tags / commit SHAs for production so updates are deliberate.

---
