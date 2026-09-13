# 3. 首次登录与管理员账号

部署完成后（见 `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`），打开
**http://localhost:3000/login**。数据库会自动写入种子数据
（幂等 — 每次重启都安全）。

## 3.1 种子账号（密码：`Demo1234!`）

| 邮箱 | 角色 | 用来学习 |
|---|---|---|
| `root@demo.test` | **超级管理员** | 一切，包括删除、作废、RBDC 配置 |
| `admin@demo.test` | **管理员** | 整个组织；无破坏性/配置操作 |
| `pm@demo.test` | **物业经理** | 仅分配了 **BLR** — 观察范围隔离隐藏其他物业 |
| `accountant@demo.test` | **会计** | 财务模块（rent engine、ledger、payments、statements） |
| `staff@demo.test` | **员工** | 前台业务写入 |
| `owner@demo.test` | **业主** | 拥有 Building A（BLR）— 仅看自己的物业/记录 |
| `owner2@demo.test` | **业主** | 拥有 Villa Main（RV）— 跨业主拒绝演示 |
| `member@demo.test` | 会员 | 租客门户（`/portal`，OTP 登录） |

## 3.2 以超级管理员首先要做的事

1. 以 `root@demo.test` 登录。
2. 注册 **2FA**（Admin 及以上强制）：Account → Security → 用验证器 App
   设置 TOTP。另有签名登录质询流程。
3. 为自己创建一个**真实的超级管理员**（Admin → Users → New user），
   以该用户登录，并**禁用或修改所有演示账号密码**后再投产。
4. 进入 **Admin → Settings**，设置 Org、Locale（货币/时区/
   语言）、Billing 与 Secrets（§7）。
5. 确认 **Admin → Audit Log** 正在记录，并运行 **Verify audit chain**。

> ⚠️ **演示数据仅用于培训。** 投产请全新部署，更改所有密钥（§11），
> 并清除演示行或写入空组织 — 切勿在 `*@demo.test` 数据上跑真实资金。

---
