# 10. 备份与恢复


## 备份与恢复

完整手册：[`BACKUP.md`](./BACKUP.md)。管理员摘要：

- **备份什么：** 用 `pg_dump`（custom 格式）做一致性全量 PostgreSQL
 转储，可在**生产**服务器上执行。上传文件在对象存储中 —
 请用 provider 工具**单独备份存储桶**。
- **存哪里：** `backups/backup-<timestamp>.dump`（或 `$BACKUP_DIR`）；容器
 路径 `/app/backups` → `rentmanager-backups` 卷。保留最新 **7** 份。
- **恢复（顺序重要）：**
 1. `docker compose stop rentmanager`
 2. `createdb rentmanager_restore && pg_restore --dbname=rentmanager_restore backups/<file>.dump`，将 `DATABASE_URL` 指向它
 3. `npx prisma migrate deploy`（仅向前，永远安全）
 4. 重启并验证：`GET /api/health` → 200 · `GET /api/audit/verify` → `{ok:true}` · 对账报表对平
- **RPO/RTO：** 每夜快照 ⇒ RPO ≤24h。每季度试恢复一次；
 未经测试的备份不是备份。

---
