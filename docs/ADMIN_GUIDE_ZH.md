# RentManager — 管理员指南

> **适用人群：** 安装、配置、保障安全并维护 RentManager 的超级管理员、
> 管理员、IT 人员与企业主。
> **日常工作人员**（前台、收银、经理）请改从应用内 **Help & Guide**
> （`/guide`）或 [`docs/manual/`](./manual/README.md) 入门。
>
> 配套文档：
> [`DEPLOY_MAC.md`](./DEPLOY_MAC.md) · [`DEPLOY_WINDOWS.md`](./DEPLOY_WINDOWS.md) ·
> [`BACKUP.md`](./BACKUP.md) · [`SECURITY.md`](./SECURITY.md) ·
> [`manual/08-administrator-guide.md`](./manual/08-administrator-guide.md)（RBDC 参考）

---

## 目录

1. [什么是 RentManager](#1-什么是-rentmanager)
2. [系统架构与服务](#2-系统架构与服务)
3. [首次登录与管理员账号](#3-首次登录与管理员账号)
4. [角色、权限与 RBDC](#4-角色权限与-rbdc)
5. [用户管理 SOP](#5-用户管理-sop)
6. [组织搭建（黄金顺序）](#6-组织搭建黄金顺序)
7. [设置参考（M28）](#7-设置参考m28)
8. [各模块管理操作](#8-各模块管理操作)
9. [定时任务（cron）](#9-定时任务cron)
10. [备份与恢复](#10-备份与恢复)
11. [安全加固检查清单](#11-安全加固检查清单)
12. [监控与日志](#12-监控与日志)
13. [系统更新](#13-系统更新)
14. [管理员故障排除](#14-管理员故障排除)
15. [上线检查清单](#15-上线检查清单)

---

## 1. 什么是 RentManager

RentManager 是一个**租赁与合租物业运营平台**：一个系统覆盖房间、租约、
账单、收款、押金、水电、维修、费用、POS/商店、库存、考勤、业主对账单、
报表以及租客/业主门户 — 并配有 Telegram 通知。

管理员必须知道的关键设计事实：

| 事实 | 说明 |
|---|---|
| 组织模型 | 单一组织、**多物业**（Property → Building → Floor → Room → Bed）。物业是范围划分单位 — 没有独立的"分公司"实体。 |
| 资金 | 单一组织货币，以**整数最小单位**（分）存储。请在上线时一次性定好货币 — 之后不支持更改。 |
| 总账 | 复式记账；资金只能通过平衡分录流动。更正使用**冲销**（credit note / void / refund）— 历史永不改写。 |
| 权限 | **RBDC**：每个页面*和*每次 API 调用都由同一个服务端解析器检查：`can(user, action, module, resource?)`。UI 隐藏按钮，但 API 才是真正的门禁。 |
| 审计 | **每次变更**都会写入可归因、哈希链审计行（操作人、时间、前后值 JSON、IP）。审计链可验证且**永不清除**。 |
| 语言 | UI 可在**英文、 Khmer （ខ្មែរ）、中文**之间按浏览器切换（🌐 按钮），并可在设置 → Locale 中设组织默认值。 |
| 事实来源 | [`INTENT.md`](../INTENT.md) + 代码 + `prisma/schema.prisma`。应用内指南只描述真实存在的功能。 |

---

## 2. 系统架构与服务

### 2.1 组件

```
                    ┌──────────────────────────────┐
                    │  Browser: staff / portal     │
                    └──────────────┬───────────────┘
                                   ▼
                    ┌──────────────────────────────┐
  :3000             │  rentmanager (Next.js 15)    │  ← 主应用，全部 UI + API
                    │  Prisma → PostgreSQL         │
                    └──────┬───────────────┬───────┘
                           │               │ /api/* (migrated prefixes)
                           ▼               ▼
                    ┌────────────┐  ┌──────────────────────┐
                    │ PostgreSQL │  │ gateway :8080        │  ← Spring Cloud
                    │ :5432      │  │ 8 Spring Boot svcs   │
                    └────────────┘  │ :8081–:8088          │
                           ┌────────┴──────────────────────┤
                           │ Nacos :8848 · Keycloak :7080  │
                           │ Kafka :9092 · Redis :6379    │
                           │ MinIO :9000/:9001 (files)    │
                           │ Grafana :9090 · Kafka UI     │
                           └───────────────────────────────┘
```

### 2.2 完整端口表（默认 `docker-compose.yml`）

| 服务 | URL | 登录（默认值 — 投产前请修改！） |
|---|---|---|
| **App（Next.js）** | http://localhost:3000 | 下方演示账号（§3） |
| API Gateway | http://localhost:8080 | — |
| Swagger（全部 API） | http://localhost:8080/swagger-ui.html | — |
| Identity :8081 · Property :8082 · Billing :8083 · Ops :8084 · Staff :8085 · Commerce :8086 · Notification :8087 · Report :8088 | `http://localhost:808x/actuator/health` | — |
| Nacos 控制台 | http://localhost:8848/nacos | `nacos` / `nacos` |
| Keycloak 管理 | http://localhost:7080 | `admin` / `admin` |
| Kafka UI | http://localhost:8090 | — |
| MinIO 控制台（文件） | http://localhost:9001 | `rentmanager` / `rentmanager-s3-secret` |
| Grafana 看板 | http://localhost:9090 | `admin` / `admin` |
| PostgreSQL | `localhost:5432` | `rentmanager` / `rentmanager` |
| Redis | `localhost:6379` | 密码 `rentmanager-redis-secret` |

> compose 文件通过环境变量设置 demo/dev 密钥（均有 `:-default` 回退）。
> 除本机演示外，请覆盖**每一个**密钥 — 见 §11。

### 2.3 数据存放在哪里

| 数据 | 位置 |
|---|---|
| 全部业务数据 | PostgreSQL（`rentmanager` 库）。迁移为**仅追加**；快照永远可以向前迁移。 |
| 文档/收据/PDF | S3 兼容对象存储（Docker 中为 MinIO；设置 `S3_*` 环境变量后可用任意 S3；否则为本地磁盘）。投产后请**单独备份存储桶**。 |
| 数据库备份 | 容器内 `/app/backups` → Docker 卷 `rentmanager-backups`（宿主机路径由 Docker 管理）。 |
| 会话 | 数据库存储、可撤销、httpOnly Cookie（`SESSION_TTL_DAYS`，默认 30）。 |
| 密封密钥 | 设置 → Providers 的密钥经 AES-256-GCM 加密（`SETTINGS_ENC_KEY`）；环境变量为回退。 |

---

## 3. 首次登录与管理员账号

部署完成后（见 `DEPLOY_MAC.md` / `DEPLOY_WINDOWS.md`），打开
**http://localhost:3000/login**。数据库会自动写入种子数据
（幂等 — 每次重启都安全）。

### 3.1 种子账号（密码：`Demo1234!`）

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

### 3.2 以超级管理员首先要做的事

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

## 4. 角色、权限与 RBDC

### 4.1 模型（读一次，受用 forever）

```
Permission = 模块 × 动作 × 范围
```

- **模块** M01–M33（Users、Members、Owners、Properties、Leases、Rent
  Engine、Invoices、Ledger、Payments、Deposits、Utilities、Services、QR、
  POS、Stock、Room Moves、Documents、Inspections、Maintenance、
  Expenses/P&L、Telegram、Complaints、Attendance、Owner Statements、Tenant
  Portal、Reports、Security、Settings、Purchase Orders、Short Stays、
  Rent Alerts……）。
- **9 个动作：** `create · read · update · delete · approve · void · refund · export · config`。
- **3 种范围：**
  - `GLOBAL` — 全部物业。
  - `PROPERTY` — 仅**分配给**该用户的物业。
  - `OWN` — 仅用户自己的记录。
- 用户可拥有**多个角色**；有效权限 = **并集**。
- **菜单可见性由权限派生** — 没有独立的菜单构建器。要显示/隐藏菜单项，
  请修改角色的权限（以及该模块在设置 → Features 中的**功能开关**）。
  两个模块（M13 QR、M17 Documents）有意没有顶级菜单 — 它们位于
  发票/会员记录内部。
- 权限 ID 形如 `M07:approve`（模块:动作）。

### 4.2 默认角色与矩阵

| 角色 | 范围 | 一句话 |
|---|---|---|
| **超级管理员** | GLOBAL | 处处完全权限（`F`），含 config/delete/void。**受保护 — 不可删除。** |
| **管理员** | GLOBAL | 各模块管理（`M` = create/read/update）；无完全删除/config |
| **物业经理** | PROPERTY | 运营所分配物业：房间、租约、运维、运营报表 |
| **会计** | GLOBAL | 资金：rent engine、invoices、ledger、payments、deposits、statements、P&L |
| **员工** | PROPERTY | 在所分配物业上业务写入（`W`）；被禁止财务变更 |
| **业主** | OWN | 对**自己**的楼宇、对账单、文档只读 |
| **会员** | OWN | 租客：仅通过 `/portal` 访问自己的记录 |

矩阵字母：`F` 完全 · `M` 管理（CRU）· `R` 只读 · `W` 只读 +
业务写入 · `O` 自己的记录 · `–` 无。

| 模块 | Super | Admin | PM | Acct | Staff | Owner | Member |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| M01 Users/RBDC | F | M | R | R | – | – | – |
| M02 Members | F | M | M | R | W | R | O |
| M03 Owners | F | M | R | R | – | O | – |
| M04 Properties/Rooms | F | M | M | R | R | R* | – |
| M05 Leases | F | M | M | R | R | R | O |
| M06 Rent Engine | F | M | R | M | – | – | – |
| M07 Invoices | F | M | M | M | R | R | O |
| M08 Ledger | F | R | – | M | – | O† | O† |
| M09 Payments | F | M | M | M | W | R | O |
| M10 Deposits | F | M | M | M | R | R | O |
| M11 Utilities | F | M | M | R | W | R | O |
| M12 Services | F | M | M | R | W | – | O |
| M13 QR Payments | F | M | R | M | W | – | O |
| M14 POS | F | M | M | R | W | – | – |
| M15 Stock | F | M | M | R | W | – | – |
| M16 Room Moves | F | M | M | R | W | – | O |
| M17 Documents | F | M | M | R | R | O | O |
| M18 Inspections | F | M | M | – | W | R | O |
| M19 Maintenance | F | M | M | – | W | W | O |
| M20 Expenses/P&L | F | M | R | M | W | R | – |
| M21 Telegram | F | M | – | – | – | O | O |
| M22 Complaints | F | M | M | – | W | R | O |
| M23 Attendance | F | M | M | R | O | – | – |
| M24 Owner Statements | F | M | R | M | – | O | – |
| M25 Tenant Portal | F | M | – | – | – | – | O |
| M26 Reports | F | M | M(ops) | M(fin) | R | R(own) | – |
| M27 Security | F | M(audit) | – | – | – | – | – |
| M28 Settings | F | M | R | R | – | – | – |
| M29 Purchase Orders | F | M | M | R | W | – | – |
| M32 Short Stays | F | M | M | R | W | – | – |
| M33 Rent Alerts | F | M | M | M | R | – | – |

\* 业主读自己的楼宇（own 范围）。† 仅对账单/自有数据的 OWN 范围。

### 4.3 构建自定义角色（示例：收银员）

1. **Admin → Roles → New role** → 命名为 `Cashier`。
2. 勾选网格：**M09（Payments）** → **PROPERTY** 范围业务写入；其余保持关闭。
3. 把角色分配给出纳用户 + 分配其**物业**。
4. 结果：她可以记录收款，但**不能打开发票编辑** —
   API 返回 `403`。（该用例被 CI 反例测试覆盖。）

### 4.4 报表权限

报表属于 **M26**。此外，**设置 → Reports** 控制：
`enabledKeys`（启用哪些报表）、`assignments`（哪些角色/用户看哪些）、
`designs`（列/品牌）。报表数据永远不可编辑。

### 4.5 安全规则

- 默认最小权限；有效权限为所有角色的并集。
- **使用中的角色不可删除**；超级管理员角色受保护。
- 每次角色/权限变更都**审计**；矩阵在 CI 中快照测试，
  权限不会被悄悄扩大。

---

## 5. 用户管理 SOP

**位置：** Admin → Users（M01）。

### 5.1 新员工入职

1. **Users → New user** → 姓名、**邮箱**、临时密码。
2. 账号创建时 `mustChangePassword = true` → 首次登录强制修改。
3. 分配**角色**（最小权限；§4）。
4. 分配**物业**（PROPERTY 范围角色必需）。
5. 告知其 URL + 临时密码；Admin+ 还需注册 **2FA**。

### 5.2 人员离职（四项全做）

1. **禁用**用户（`status = disabled`）— 立即阻止登录。
2. **撤销会话** — 强制所有设备登出。
3. 若为交接而重新启用，先 **重置 2FA**（让旧验证码失效）。
4. 按该操作人筛选 **Audit Log** 做最终复核。

### 5.3 "忘记密码" / 手机丢失

- 本版本**没有**自助邮件重置 — 由管理员设置临时密码（重新启用 must-change）。
- 验证器丢失：管理员执行 **2FA 重置**（M27），用户可重新注册。

---

## 6. 组织搭建（黄金顺序）

新物业/公司按此顺序搭建 — 每一步解锁下一步：

| # | 步骤 | 位置 |
|---|---|---|
| 1 | 公司/组织：法定名称、货币、时区、语言 | 设置 → Org / Locale |
| 2 | 结构：**properties → buildings → floors → rooms → beds** | Properties（M04） |
| 3 | 角色与用户；分配角色 + 物业 | Admin → Roles、Users（M01） |
| 4 | Rent engine：方案、滞纳金、税、折扣 | Rent Engine（M06）、设置 → Billing/Late fee |
| 5 | 会计期初余额（如需迁入） | 设置 → Opening balances（平衡的 `opening` 分录） |
| 6 | 支付方式 + provider 密钥 | 设置 → Secrets |
| 7 | 账单/催缴 + rent alerts | 设置 → Billing、Alerts（M33） |
| 8 | 业主 + 业主合同 + 付款方式 | Owners（M03）、Owner Contracts、M24 |
| 9 | 通知：模板 + Telegram bot token + 绑定 | 设置 → Templates/Telegram、Telegram（M21） |
| 10 | 安全：Admin+ 的 2FA、会话、限流 | Account → Security、§11 |
| 11 | 功能开关 + 报表分配 | 设置 → Features / Reports |
| 12 | 端到端测试（lease → invoice → payment → receipt） | — |
| 13 | 审计复核 + 安排**备份**任务 | Admin → Audit、§9–§10 |

各领域详情见 `docs/manual/` 第 3–7 部分。

---

## 7. 设置参考（M28）

**位置：** Admin → Settings。所有变更都**审计**；财务设置
**仅向前生效**（已入账历史永不改写）。

| 分组 | 控制项 | 管理说明 |
|---|---|---|
| **Org** | 法定名称、地址、电话、邮箱、网站、税号、logo、发票页脚、PDF 模板（classic/modern） | 每份 PDF/收据的品牌。法定名称与税号保持准确。 |
| **Locale** | 货币、时区、UI 语言（en/km/zh） | ⚠️ 上线时**一次性定好货币**；有数据后不可更改。 |
| **Billing** | 发票前缀、宽限天数（默认 **3**）、催缴天数（**[3,7,14]**） | 决定编号与提醒/滞纳金启动时机。仅向前生效。 |
| **Late fee** | 模式 none/flat/percent、固定金额、月费率（bp）、上限 | 默认关闭。启用时务必设**上限** — 费用不超过欠款。 |
| **Retention** | outbox 90d、events 365d、OTP 7d、session 30d | **审计 trail 永不清除。** |
| **Features** | 各模块开关（POS、Stock、Telegram、PO 默认开） | 关闭隐藏菜单 + 门禁访问；**数据保留**。 |
| **Reports** | enabledKeys、assignments、designs | 谁看哪些报表；数据保持来源可溯。 |
| **Templates** | Telegram 文案覆盖，5 类事件，`{placeholders}` | issued / receipt / dunning / reminder / overdue 文案。 |
| **Printers** | 58/80mm、自动打印、份数、默认条码 | POS 小票/标签打印。 |
| **Telegram** | Bot 显示名、欢迎语、会员自助绑定 | 租客 bot 行为。 |
| **Menu** | 侧边栏位置（left/right） | 仅布局偏好 — 可见性来自权限。 |
| **Units / Table** | 库存单位；默认分页大小（25） | 列表密度 + 物品单位。 |
| **Alerts（M33）** | ahead 天数（3）、overdue 天数（1） | 仪表盘到期/逾期窗口。 |
| **Secrets** | 支付凭证、Telegram token | **AES-256-GCM 密封**，读取掩码；环境变量为回退。切勿在聊天中粘贴密钥。 |
| **Opening balances** | 平衡的 `opening` 总账分录 | 迁入 RentManager 时使用；必须平衡。 |

### 环境变量（服务端）

| 变量 | 用途 | 默认值（dev） |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接 | `postgresql://rentmanager:rentmanager@localhost:5432/rentmanager` |
| `SESSION_TTL_DAYS` | 会话有效期 | `30` |
| `FILE_SIGNING_SECRET` | 签名文件 URL | `.env` 中的随机 dev 值 |
| `PAYMENT_WEBHOOK_SECRET` | 网关 webhook HMAC | `dev-webhook-secret-change-me` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `TELEGRAM_BOT_USERNAME` | Telegram bot | `dev-*` 占位 |
| `SETTINGS_ENC_KEY` | 密封设置加密（32 字节） | 投产必须设置 |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 对象存储 | Docker 中的 MinIO |
| `APP_BASE_URL` | 公共基地址（PDF/消息中的链接） | `http://localhost:3000` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO 控制台 + S3 | `rentmanager` / `rentmanager-s3-secret` |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | Grafana | `admin` / `admin` |
| `COOKIE_SECURE` | 安全 Cookie | 本地 `false` → HTTPS 后 **`true`** |
| `SEED_FULL_DEMO` | 写入完整演示数据 | Docker 中为 `1` |

本地运行复制 `.env.example` → `.env`；Docker 中 compose 文件注入
生产风格的值 — 通过 shell 环境或 `docker-compose.override.yml`
覆盖密钥（切勿提交真实密钥）。

---

## 8. 各模块管理操作

日常操作见 `manual/03-user-guide.md`；这里是**管理员视角**：
每个模块要配置什么、审批什么、盯什么。

### M04 Properties & rooms
- 一开始就把房间结构建对（type、floor、rent）。房间**状态机被强制执行**
 （available → occupied → cleaning → available……）；
 员工不能跳状态 — moves/leases 自动翻转状态。
- 楼宇可带**地图坐标 + 围栏半径**，用于 kiosk 考勤。

### M05 Leases · M16 Room moves
- 租约激活自动开出**押金账单**（M10）。
- **退租检查（M18）是终止租约的硬门槛**。
- 换房 = 申请 → 审批 → 执行：旧租约终止、新租约开始、
 押金跟随会员，**一张调整账单**轧清按比例差额。
 切勿手工改两份租约来伪造换房。

### M06 Rent Engine · M07 Invoices
- 每月 `invoice-generation` 任务（按账单日）+ 每天 `billing-daily`
 补算。月中暂停**按比例**；固定服务跟随 engine。
- 发票号来自 `number_sequences` + 设置前缀 — 断号正常
 （幂等重试），重号不可能。

### M08 Ledger
- 会计负责。每个资金事件都记平衡分录；作废与退款记**冲销**，
 永不编辑。P&L 与报表都读总账，
 因此"register ↔ ledger"必须精确对平 — 若报表对不上，
 去查分录，不要怪报表。

### M09 Payments · M13 QR
- 方式：现金 / 银行转账 / QR / 卡 / 支票。状态机：
 `pending → confirmed → refunded | failed`。
- **核销按最早优先**（到期日，再按周期）且不可变；
 多付成为**会员余额**（会计可做账退回，ledger 冲销式支出）。
- Webhook **签名 + 幂等** — 重复的网关通知被忽略，永不重复入账。
 收据（`RCP-…`）自动归档为 PDF。
- 公开 `/pay` 页：仅精确金额、限流、无需登录。

### M10 Deposits
- 租约激活时开单；扣款由退租检查发现项提议，
 在 **M10 中审批**；支出经 ledger 冲销。

### M11 Utilities · M12 Services
- 按房间的表（电/水/气），毫单位精度；估算 = 最近 3 次平均；
 支持 CSV 导入。阶梯费率；费用**自动挂到下个周期**；
 超过均值 2 倍以上标记为异常。
- 服务：包月固定（暂停按比例）vs 按次（一次性行）。
 车位唯一；WiFi 账号跟随租约。

### M14 POS · M15 Stock · M29 Purchase orders
- POS 班次：开班备用金 → 应有 = 备用金 + Σ 现金 → 关班盘点
 差异。**记到房间**会自动开一次性账单 + AR 分录。
- 库存移动**仅追加**（purchase/sale/consumption/
 maintenance_use/adjustment/transfer），移动加权成本。
 **盘点记差异调整** — 这才是更正路径，不是编辑。
- 低库存告警发给员工（接通后也发 Telegram）。

### M18 Inspections · M19 Maintenance · M22 Complaints
- 按房间类型的检查清单模板；退租检查是终止租约门槛；
 损坏发现 → 押金扣款或工单。
- 工单：open → assigned → in_progress → resolved → verified/closed，
 按优先级 SLA（urgent 4h … low 168h）+ 每日违约扫描。成本进
 费用或业主 P&L。
- 投诉：thread + SLA + 会员确认关闭并 1–5 评分；
 一键转为工单。

### M20 Expenses & P&L
- 供应商费用 + 票据附件；**超可配置阈值需审批**
 （以下自动通过；Accountant+ 门槛）；作废冲销。
 月度预算及差异；经常性模板；按物业与合并 P&L 均来自总账。

### M23 Attendance
- Kiosk-PIN + 手机打卡、可选物业围栏、班次模板
 （宽限 + OT 倍率）；异常（迟到/早退/漏打卡/加班/围栏）
 经审计解决；月度汇总 + CSV 薪资导出。

### M24 Owner statements
- 每月生成任务（付款日、force bypass、按合同+月份幂等）。公式：
 已收 × 分成 | 固定包租 − 管理费 − 代垫 − 业主维修 ± 已审计调整。
- `draft → approved → paid`；审批计提 DR 3900 / CR 2200，
 付款 DR 2200 / CR cash|bank。PDF 自动归档；业主在门户查看。
 生成限 Accountant+（GLOBAL M24:update）。

### M25 Tenant portal · M21 Telegram
- 门户（`/portal`，移动 PWA）：OTP 登录（哈希一次性码、
 锁定）生成会员的 User（MEMBER 角色）— 在同一模块 API 上
 **严格 OWN** 范围。无重复业务逻辑。
- Telegram：签名 webhook（伪造被拒）、一次性绑定码、命令
 `/status /dues /pay /help`（仅自己的数据）、事件→模板分发
 （每用户开关）。Dev token = 模拟发送 + 完整发件箱。

### M26 Reports
- 12 张报表 + 仪表盘 KPI 条（入住率 %、已开 vs 已收、
 欠款、待处理工单、现金头寸）。每张报表声明来源行；
 账龄合计必须等于未付发票总额。CSV（RFC-4180）
 + 品牌 PDF 导出；按日期 + 物业筛选。

---

## 9. 定时任务（cron）

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

## 10. 备份与恢复

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

## 11. 安全加固检查清单

构建已内置基线：scrypt 密码、数据库可撤销会话、
httpOnly Cookie、登录限流、TOTP 2FA（Admin+ 强制）、签名登录质询、
防篡改审计哈希链 + PII 掩码、CSP +
安全头、密封 provider 密钥、短 TTL 的 S3 签名 URL。
（见 `manual/09-security-guide.md` + `SECURITY.md`。）

投产前，管理员必须：

- [ ] 更改**所有**默认密钥：`FILE_SIGNING_SECRET`、
 `PAYMENT_WEBHOOK_SECRET`、`SETTINGS_ENC_KEY`（32+ 随机字节）、
 `TELEGRAM_WEBHOOK_SECRET`、数据库密码、Redis 密码、
 MinIO root 密码、Grafana 管理员、Nacos/Keycloak 管理员。
- [ ] 禁用或修改**所有 `*@demo.test` 账号**；创建真实管理员；
 为每个 Admin+ 注册 **2FA**。
- [ ] 设置 `COOKIE_SECURE=true` 并**仅 HTTPS** 对外（反向代理：
 Caddy/Nginx/Traefik + TLS；`APP_BASE_URL` = 公共 https 地址）。
- [ ] 内部端口（5432、6379、8848、7080、9092、9000……）仅绑
 localhost 或私网 — 切勿把 DB/Redis/Kafka 暴露到公网。
- [ ] 确认 auth + webhook **限流**；确认 Telegram/Payment
 webhook 拒绝坏签名（伪造测试）。
- [ ] 运行 **Verify audit chain**；确认日志中 PII 掩码。
- [ ] 安排**每夜备份** + 异地拷贝；上线前试恢复一次。
- [ ] 设置**保留**策略；确认审计被排除在清除之外。
- [ ] 对照组织架构复核**权限矩阵**（§4.2）；删除未用授权（最小权限）。
- [ ] 渗透自查：跨物业 IDOR、提权、webhook 伪造、URL 猜测、
 公开 `/pay` 精确金额强制。

---

## 12. 监控与日志

| 信号 | 方法 |
|---|---|
| 应用健康 | `GET /api/health` → 200 + DB `SELECT 1`（Docker 健康检查在用） |
| 后端健康 | 各服务 `GET http://localhost:808x/actuator/health`；网关聚合 |
| 审计完整性 | `GET /api/audit/verify` → `{ ok: true }` |
| 账实相符 | 对账/账龄报表 `summary.reconciles == "yes"` |
| 看板 | Grafana http://localhost:9090（预置各服务看板） |
| 容器状态 | `docker compose ps` · `npm run docker:status` |
| 日志 | `docker compose logs -f rentmanager` · `docker compose logs -f gateway` |
| Kafka | Kafka UI http://localhost:8090 |
| 文件 | MinIO 控制台 http://localhost:9001 |

调查一笔坏账：**Audit Log** → 按操作人/日期/实体筛选 →
 对比前后值 → 追踪关联发票/总账 → 用正确的**冲销**
 （credit note / void / refund）更正。切勿手工改已入账记录。

---

## 13. 系统更新

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

## 14. 管理员故障排除

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

## 15. 上线检查清单

- [ ] 目标机器部署全绿（`DEPLOY_*.md` 验证步骤通过）
- [ ] §11 加固项全部完成
- [ ] Org/Locale/Billing/Late-fee/Alerts 已配置；货币已定稿
- [ ] Properties → buildings → floors → rooms → beds 已录入
- [ ] 真实用户 + 角色 + 物业分配；演示账号已禁用
- [ ] 期初余额已记（如迁入）；支付方式 + 密钥已设置
- [ ] 业主 + 合同 + 付款方式；Telegram 已绑定 + 收到测试消息
- [ ] §9 任务全部排期并**各试运行一次**（查审计行）
- [ ] 每夜备份已排期 + 完成一次试恢复
- [ ] 员工已培训黄金路径：lease → invoice → QR/现金收款 → receipt → move-out 结算（`manual/13` + `manual/14`）
- [ ] 已打印：管理员通讯录、备份/恢复一页纸、事件流程

---

*管理员指南结束。请把本文件与部署指南放在一起，
每次大更新后复核一次。*
