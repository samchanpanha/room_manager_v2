# 第 8 部分 — 管理员指南

本部分面向 **Super Admins、Admins、IT 和业务管理员**。
涵盖配置、用户、角色与权限、菜单、报表访问、业务设置和维护。
普通用户做日常工作不需要这些。

> 这里的一切都受权限门控。大部分管理需要 **M01**
>（Users & RBDC）或 **M28**（Settings）；安全项需要 **M27**。
> 非管理员要么看不到这些菜单，要么从 API 收到 `403 FORBIDDEN`。

---

## 8.1 基于角色的动态访问控制（RBDC）— 权限如何工作

每个页面和每个 API 调用都由同一个服务端解析器检查：

```
can(user, action, module, resource?)
```

- **权限 = 模块 × 操作 × 范围（scope）。**
- **9 种操作：** `create · read · update · delete · approve · void · refund · export · config`。
- **3 种范围：**
  - **GLOBAL** — 横跨所有物业。
  - **PROPERTY** — 仅用户被**分配**的物业。
  - **OWN** — 仅用户自己的记录（会员/业主/员工本人）。
- 一个用户持有**一个或多个角色**；有效权限 = **并集（union）**。
- 用户有**物业分配**，限制 PROPERTY 范围访问。
- 执行在**每个 endpoint 的服务端**；UI 隐藏东西只为方便，
  永远不是权威。
- 权限 id 形如 `M07:approve`（module:action）。

### 默认角色（预置）
| 角色 | 范围 | 说明 |
|---|---|---|
| **Super Admin** | GLOBAL | 一切，含 config/delete/void。**受保护 — 不可删除。** |
| **Admin** | GLOBAL | 管理组织；跨模块 manage 级（CRU）；无 full-delete/config |
| **Property Manager** | PROPERTY | 运营所分配物业：房间、租约、运营、报表(ops) |
| **Accountant** | GLOBAL | 管钱：租金引擎、账单、账本、收款、对账单、P&L |
| **Staff** | PROPERTY | 前台/现场：所分配物业的运营写；其他物业只读 |
| **Owner** | OWN | 房东：**自己**楼宇只读、对账单、证件 |
| **Member** | OWN | 租户：仅经门户访问自己的记录 |

### 矩阵字母
`F`=full（含 config/delete）· `M`=manage（create/read/update）· `R`=read ·
`W`=read + 运营写 · `O`=仅自己的记录 · `–`=无。

### 角色 × 模块访问矩阵（实际预置权限）

| Module | Super Admin | Admin | Prop Mgr | Accountant | Staff | Owner | Member |
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

\* 业主读自己的楼宇（own-scope）。
† 仅对对账单/自己的数据为 OWN scope。

---

## 8.2 用户管理

**位置：** **Admin → Users [M01]**。

### 创建用户
1. **Users → New user**。输入姓名、**email** 和临时密码。
2. 账户创建时 `mustChangePassword = true`，用户**首次登录必须改密码**。
3. 分配**角色**（一个或多个）。
4. 分配**物业**（对 PROPERTY 范围角色，如 Property Manager / Staff）。
5. 保存。用户可以登录了；Admin+ 还会被要求注册 **2FA**。

### 编辑 / 禁用 / 重置
- **编辑**姓名/email 和角色/物业分配。
- **禁用**用户（`status = disabled`）— 不能再登录。
- **重置密码** — 设新的临时密码（设置必须修改标记）。
- **2FA 管理重置** — 用户丢失验证器时，重置其 TOTP 以便
  重新注册（M27）。
- **吊销会话** — 从安全/会话区强制所有设备登出。

### 规则
- 每个用户变更都**留审计**。
- **正在使用的角色不可删除**（必须先移除其中的用户）。
- **Super Admin 角色受保护** — 不可删除，确保始终有
  一个全权限账户。

> 当前版本没有自助邮件"忘记密码" — 管理员重置
> 忘记密码（设置一个临时密码）。

---

## 8.3 角色与权限管理

**位置：** **Admin → Roles & Permissions [M01]**（`/roles`，详情在 `/roles/[id]`）。

### 创建或编辑角色
1. **Roles → New role**（或打开一个角色）。给名称/描述。
2. 勾选**权限网格**：每个**模块**选**操作**和
   **范围**（GLOBAL / PROPERTY / OWN）。网格用同一套 F/M/R/W/O 模型。
3. 保存。角色权限存为 `role_permissions` 行
   （`module:action:scope`）。
4. 把角色分配给用户。

### 例子（来自产品验收测试）
创建角色 **"Cashier"**，只有 **M09: W（payments 运营写）**，
PROPERTY 范围。只有该角色的用户可以登记收款，但
**不能打开账单编辑** — API 返回 `403`（CI 中强制并测试）。

### 规则与安全
- **默认/受保护角色：** Super Admin 受保护；默认角色
  从目录预置。你可以自由创建自定义角色。
- **删除：** 使用中的角色不可删除。
- **审计：** 每次角色/权限变更写一条审计行。权限矩阵
  还在 **CI 中做快照测试**（含负向测试），确保
  权限不会被意外扩大。
- **有效访问是所有角色的并集** — 默认最小权限；
  有意地添加角色。

### 报表权限
报表是 **M26**。此外，报表可在 **Settings → Reports**
下逐个**启用和分配**：
- **enabledKeys** — 目录中哪些报表可用。
- **assignments** — 哪些角色/用户看哪个报表。
- **designs** — 每个报表的列布局/品牌。
报表**数据**永不可编辑 — 始终由账本/查询支撑。

---

## 8.4 菜单管理

没有单独的拖拽菜单构建器；菜单可见性
**从权限派生**（同一个 `can()` 解析器驱动侧边栏和
路由守卫）。导航模型（`src/lib/nav.ts`）按区块分组：

Overview · Portfolio · Billing · Finance · Operations · Store · Comms · Insights · Admin · Account。

- 菜单项出现，当且仅当用户角色授予该模块的 **read**
  权限 **且** 该模块的**功能开关（feature flag）** 没有关（Settings → Features）。
- 未构建/按阶段门控的项显示为禁用并带标签。
- **M13（QR）** 和 **M17（Documents）** 有意没有顶级菜单 —
  它们活在账单/会员记录里。
- **Settings → Menu** 可选侧边栏方向（`left`/`right`）。

所以：**要显示/隐藏菜单项，调整角色权限（和功能开关）** —
不是编辑菜单表。

---

## 8.5 业务设置（M28）

**位置：** **Admin → Settings [M28]**。所有变更**留审计**，
财务设置**只向前**生效（已入账历史永不改写）。
设置分组如下：

| 组 | 控制 | 为什么重要 / 建议 |
|---|---|---|
| **Org** | 公司/法定名称、地址、电话、email、网站、tax ID、logo、账单页脚注记、账单 PDF 模板（classic/modern） | 每个 PDF/收据的品牌。保持法定名称 & tax ID 准确。 |
| **Locale** | 货币、时区、UI 语言（en / km 高棉语 / zh 中文） | 钱是单一组织货币的整型最小单位。语言默认全组织生效；用户可用 🌐 选择器覆盖。 |
| **Billing** | 账单前缀、宽限天数（默认 **3**）、催收天数（默认 **[3,7,14]**） | 驱动账单编号和提醒/滞纳金何时开始。变更向前生效。 |
| **Late fee** | 模式（none/flat/percent）、固定金额、月度 %（基点）、上限 | 默认关闭（`none`）。启用时设合理上限 — 滞纳金绝不超过应付金额。 |
| **Retention** | outbox（90 天）、events（365 天）、OTP（7 天）、session（30 天）保留期 | 数据保留清理；**审计轨迹永不清理**。 |
| **Features** | 按模块的功能开关（M14 POS、M15 Stock、M21 Telegram、M29 PO = 默认开） | 为组织开/关模块；隐藏菜单并门控访问。 |
| **Reports** | 启用的报表 keys、角色分配、报表设计 | 控制谁看哪个报表（数据仍由源头支撑）。 |
| **Templates** | 5 个事件的 Telegram 消息覆盖，带 `{placeholders}` | 定制 issued/receipt/dunning/reminder/overdue 措辞。 |
| **Printers** | 热敏纸宽（58/80mm）、自动打印收据、收据份数、默认打印条码 | POS 收据/标签打印。 |
| **Telegram** | bot 显示名、欢迎消息、允许会员自助关联 | 租户 bot 行为。 |
| **Menu** | 侧边栏方向（left/right） | 布局偏好。 |
| **Units** | 库存/POS 商品的计量单位 | 创建商品/产品时提供的单位。 |
| **Table** | 列表默认页大小 | 列表密度（默认 25）。 |
| **Alerts（M33）** | 租金提醒：提前天数（3）、逾期天数（1） | 控制仪表板 "due soon/overdue" 窗口。 |
| **Secrets（Providers）** | 支付 provider 凭证、Telegram bot token | 存为**密封（AES-256-GCM）**；掩码显示；env 变量是兜底。绝不在聊天里粘贴密钥。 |
| **Opening balances** | 账本期初过账 | 迁入系统时设平衡的 `opening` 分录。 |

### 可能出什么问题
- 有数据后改**货币**不受支持（单一货币）— 上线时设好。
- **滞纳金/计费**变更只影响**未来**期间（只向前）— 别指望它改写旧账单。
- 关**功能开关**隐藏模块，但不删除其数据。
- 移除**报表权限**隐藏报表；底层数据不动。

---

## 8.6 公司 / 分支机构结构
RentManager **从第一天起就是多物业**；每条记录在
适用处都有物业范围。层级是 **Property → Building → Floor → Room → Bed**。
- **Property** 是顶层（可理解为"场地"或"项目"）；没有单独的
  "branch" 实体 — 物业就是范围单元。
- 用户身上的**物业分配**控制 PROPERTY 范围角色
  能看到/管理哪些物业（Property Manager 演示有意只
  分配到一个物业，以展示范围限定）。
- 楼宇可选带地图坐标和考勤 kiosk 用的 **geofence 半径**。

---

## 8.7 Admin 黄金路径（初始设置顺序）

逐步说明见**第 13 部分 §13.2**，顺序是：

1. 配置**公司/组织**（名称、货币、时区、语言）
2. 创建 **properties → buildings → floors → rooms**
3. 创建 **roles** & **users**；分配角色和物业
4. 配置**权限**（角色网格）
5. 配置**租金引擎**计划/滞纳金/税/折扣
6. 配置**会计**期初余额（如迁入）
7. 配置**支付方式** / provider 密钥
8. 配置**计费/催收**和**租金提醒**
9. 入驻 **owners + 业主合同** 和**收款方式**
10. 配置**通知**（模板）和 **Telegram**（bot token、关联）
11. 落实**安全**：Admin+ 的 2FA、会话、限流（第 9 部分）
12. 按组织开/关**功能开关**和**报表**
13. **端到端测试**黄金路径（第 13 部分）
14. 审查**审计日志**并设置 **backup** 任务/runbook

---

## 8.8 维护与后台任务

存在 cron 形态的任务端点（生产环境按计划调用）：

| 任务 | 计划（典型） | 权限 |
|---|---|---|
| `invoice-generation` | 每月（按计租日） | M07:create |
| `billing-daily` | 每日 | M06:update |
| `rent-alerts` | 每日 | M33:update |
| `telegram-dispatch` | 每日（或频繁） | M21:update |
| `sla-sweep` | 每日 | M19:update |
| `attendance-sweep` | 每日 | M23:update |
| `statement-generation` | 每月（付款日） | GLOBAL M24:update |
| `retention` | 每日/定期 | M28:update |
| `backup` | 每夜 | M27:update |

### 备份
- **每夜备份任务**快照数据库（SQLite `VACUUM INTO` —
  在活动库上也是一致的），保留**最新 7 份**。恢复 runbook 在
  [`docs/BACKUP.md`](../BACKUP.md)。

### 数据保留清理
- **retention** 任务按保留设置清理 outbox/events/OTP/sessions。
  **审计日志永不清理。**

---

## 8.9 审计日志（面向管理员）

**位置：** **Admin → Audit Log [M01/M27]**（`/audit`）。

- **记录什么：** 每次变更（create/update/状态变化/approve/void/
  refund/login/权限变更…），带**操作者（actor）**、**时间戳**、
  **前后值（JSON）**和 **IP**。
- **防篡改：** 审计行构成**哈希链**；用 **Settings →
  Security → Verify audit chain** 检测任何篡改。日志中 PII 被掩码。
- **调查错误交易：** 按操作者/日期/实体筛选，找到
  动作，对比前后值，然后追踪关联的账本/账单，用正确的
  **冲销**（credit note / void / refund）— 绝不手改。

存在一个回填/链工具（`scripts/backfill-audit-chain.ts`）。
