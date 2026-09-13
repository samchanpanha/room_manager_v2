# 9. 定时任务（cron）


## 任务目录

任务接口为 cron 风格 — 投产后用 Admin 会话/令牌按计划调用。
所有运行都被审计。

| 任务 | 接口 | 典型计划 | 需要 |
|---|---|---|---|
| `invoice-generation` | `POST /api/jobs/invoice-generation` | 每月，账单日 | M07:create |
| `billing-daily` | `POST /api/jobs/billing-daily` | 每天约 01:00 | M06:update |
| `rent-alerts` | `POST /api/jobs/rent-alerts` | 每天约 06:00 | M33:update |
| `statement-generation` | `POST /api/jobs/statement-generation` | 每月，付款日 | GLOBAL M24:update |
| `telegram-dispatch` | `POST /api/jobs/telegram-dispatch` | 每天（或每小时） | M21:update |
| `sla-sweep` | `POST /api/jobs/sla-sweep` | 每天 | M19:update |
| `attendance-sweep` | `POST /api/jobs/attendance-sweep` | 每天 | M23:update |
| `retention` | `POST /api/jobs/retention` | 每天/每周 | M28:update |
| `backup` | `POST /api/jobs/backup` | **每夜** | M27:update |

示例（macOS/Linux cron — 服务器须可达；使用服务账号
cookie/token）：

```bash
# RentManager nightly jobs (server-local cron)
0 1 * * * curl -sf -X POST http://localhost:3000/api/jobs/billing-daily   -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 2 * * * curl -sf -X POST http://localhost:3000/api/jobs/backup          -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
0 6 * * * curl -sf -X POST http://localhost:3000/api/jobs/rent-alerts     -H "Cookie: $RM_ADMIN_COOKIE" >/dev/null
```

Windows 请用**任务计划程序** → "启动程序" →
`powershell.exe -File C:\RentManager\jobs\invoke-jobs.ps1`，
脚本内用等效的
`Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/jobs/backup …`。
见 `DEPLOY_WINDOWS.md` §"Scheduled jobs"。

> 请使用**专用服务账号**（Admin 角色、长随机密码、
> 已注册 2FA、凭证存服务器 vault），不要用个人账号。

---
