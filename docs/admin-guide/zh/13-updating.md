# 13. 系统更新


## 更新步骤

```bash
# 1. 先快照（backup 任务或卷备份）
# 2. 拉取 + 重建 + 重启
git pull
docker compose up --build -d
# 3. 迁移在 entrypoint 自动运行；验证：
curl -sf http://localhost:3000/api/health
docker compose ps
```

- 迁移**仅追加** — 可安全应用于旧快照；不做回滚
 （必须回退请从备份恢复）。
- 更新后首次启动盯着 `docker compose logs -f rentmanager`。
- 投产请 pin 镜像 tag / commit SHA，让更新都是有意的。

---
