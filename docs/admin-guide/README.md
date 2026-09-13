# RentManager — Administrator Guide (in-app)

Trilingual administrator manual (English / Khmer / Chinese) built into a
self-contained site and served in-app at **`/admin-guide`**.

Staff doing daily work should use the User Guide at `/guide` instead.

## Parts

| Part | File | Group |
|---|---|---|
| 1 · What RentManager is | [01-what-rentmanager-is.md](./01-what-rentmanager-is.md) | Start |
| 2 · Architecture & services | [02-architecture.md](./02-architecture.md) | Start |
| 3 · First login | [03-first-login.md](./03-first-login.md) | Start |
| 4 · Roles, permissions & RBDC | [04-rbdc.md](./04-rbdc.md) | Access & people |
| 5 · User management SOPs | [05-user-management.md](./05-user-management.md) | Access & people |
| 6 · Organisation setup | [06-organisation-setup.md](./06-organisation-setup.md) | Access & people |
| 7 · Settings (M28) | [07-settings.md](./07-settings.md) | Configuration |
| 8 · Module admin operations | [08-module-operations.md](./08-module-operations.md) | Configuration |
| 9 · Scheduled jobs | [09-scheduled-jobs.md](./09-scheduled-jobs.md) | Run the system |
| 10 · Backup & restore | [10-backup-restore.md](./10-backup-restore.md) | Run the system |
| 11 · Security hardening | [11-security-hardening.md](./11-security-hardening.md) | Run the system |
| 12 · Monitoring & logs | [12-monitoring.md](./12-monitoring.md) | Run the system |
| 13 · Updating the system | [13-updating.md](./13-updating.md) | Go-live |
| 14 · Troubleshooting | [14-troubleshooting.md](./14-troubleshooting.md) | Go-live |
| 15 · Go-live checklist | [15-go-live.md](./15-go-live.md) | Go-live |

Khmer: [`km/`](./km/) · Chinese: [`zh/`](./zh/).

The long-form Markdown originals remain at [`../ADMIN_GUIDE.md`](../ADMIN_GUIDE.md)
([ខ្មែរ](../ADMIN_GUIDE_KM.md) · [中文](../ADMIN_GUIDE_ZH.md)).

## Rebuild

```bash
node docs/admin-guide/site/build.mjs
```

This writes `docs/admin-guide/site/index.html` and publishes to
`public/admin-guide/` (in-app at `/admin-guide`).
