# 14. 管理员故障排除


## 常见症状

| 症状 | 最可能原因 → 修复 |
|---|---|
| 应用 500 / 起不来 | DB 未就绪 → `docker compose ps` 看 `postgres` 是否健康；再看 `docker compose logs rentmanager`（entrypoint 会等待 + 迁移 + 种子 — 读日志尾） |
| 所有人登录失败 | Session/cookie 域或 `DATABASE_URL` 错误；检查 env + `/api/health` |
| 某操作 `403 FORBIDDEN` | 正确的 RBDC 拒绝 → 检查该用户的角色 + 范围 + 物业分配（§4–§5） |
| 菜单项缺失 | 该模块无 `read`，或设置 → Features 中功能开关关闭 |
| 发票任务没跑 | Cron/任务计划程序没触发或 cookie 过期 → 查任务审计行 + 调度器日志 |
| Webhook 重复入账 | 不应发生（幂等）→ 确认 `PAYMENT_WEBHOOK_SECRET` 与网关配置一致；查日志 |
| Telegram 无声 | bot token/secret 错误，或模板关闭 → 设置 → Secrets/Templates；查 `telegram-dispatch` 运行 |
| 审计校验失败 | **停下来调查** — 可能被篡改；查明根因后再从备份恢复 |
| 磁盘满 | Docker 卷（DB、MinIO、备份）→ 清旧备份，`docker system df`，扩容 |
| 首次构建慢 | 正常：Java 服务 + Next 构建本来就久；给 Docker ≥8GB 内存，别 pin 到单核（`NEXT_BUILD_CPUS`） |

平台相关安装问题 → `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`
的故障排除节。最终用户问题 → `manual/10-troubleshooting.md`。

---
