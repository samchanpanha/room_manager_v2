# 第 7 部分 — Telegram 与通知指南

RentManager 通过 **Telegram**（聊天机器人）和**应用内**指示
（仪表板告警、徽章）触达 App 之外的人。本部分说明有哪些
消息、何时触发、如何连接。

> 🚫 **当前系统未确认：** **邮件**通知和
> **短信（SMS）**。设计文档提到邮件投递，但当前版本
> **没有邮件发送通道**（代码里没有邮件库/集成），也没有
> 短信。自动化消息走 **Telegram**；提醒也会在**应用内**
> 出现（仪表板 **Rent dues**、到期徽章）。通知**模板**
> 设置是 Telegram 模板。

---

## 7.1 Telegram bot（M21）— 它做什么

- 向已关联用户（会员、员工、业主）发送**事件通知**。
- 在聊天中响应若干**命令**（会员只看**自己的**数据）。
- 可以返回**支付 QR**，让会员从聊天里直接付。

### 已存在的通知（事件 → 模板）
| 事件 | 接收人 | 何时触发 |
|---|---|---|
| `invoice.issued` | 会员 | 账单开出 |
| `payment.confirmed` | 会员 | 收款确认（收据消息） |
| `invoice.dunning_reminder` | 会员 | 计划催收阶段（+3/+7/+14） |
| `rent.reminder` | 会员 | 租金即将到期（来自 rent-alerts 任务） |
| `rent.overdue` | 会员 | 租金逾期 |
| `ticket.transitioned` | 会员 | 维修工单状态变化 |
| `complaint.transitioned` | 会员 | 投诉状态变化 |
| `statement.approved` | 业主 | 业主对账单已审批/就绪 |
| `stock.low` | 员工/admin | 商品低于低库存阈值 |
| *(occupancy digest)* | 员工群 | 每日入住摘要（按 dispatch 任务） |

每个用户有**逐用户的开关设置**（每种通知类型可开/关）。

### Bot 命令
| 命令 | 谁 | 返回什么 |
|---|---|---|
| `/start` | 任何人 | 欢迎/帮助文本（可配置） |
| `/link <code>` | 用户 | 把 Telegram 账户绑定到 RentManager 用户（一次性码） |
| `/status` | 会员 | 当前租约/房间状态（自己的数据） |
| `/dues` | 会员 | 未结余额（仅自己的数据） |
| `/pay` | 会员 | 应付金额的支付 QR（经 M13） |
| `/help` | 任何人 | 命令列表 |

安全：bot 使用**签名 webhook**（伪造的更新被拒绝）；
会员命令经 RBAC 校验，永远只返回**该会员**的数据。

---

## 7.2 连接你的 Telegram（关联）

关联使用**一次性码**（bot 永远看不到你的密码）。

### 从 admin/owner 一侧
1. 打开 **Comms → Telegram Bot**（或 **My Account**）。
2. 选择**关联**你的账户 — 系统显示一次性**link code**。
3. 在 Telegram 里打开 bot，发送 `/link <code>`。
4. Bot 绑定你的 `telegram_id`（经权限校验）并确认。
5. 设置你的**通知开关**（要收哪些消息）。

### 从租户门户（会员）
1. 会员打开 bot，用门户里显示的码发送 `/link <code>`。
   - 会员自助关联可由组织通过
     **Settings → Telegram → allowMemberLinking** 开/关。
2. 关联后他们收到收据/提醒，并可用 `/status`、`/dues`、`/pay`。

### 解除关联
在 Telegram 界面用**unlink**（或用 `/link` 换新账户）。解除关联
会停止该聊天的消息。

> 还有 **admin-link** 流程（`/api/telegram/admin-link`）供员工
> 设置使用，以及 UI 用的 **link-state** 检查。

---

## 7.3 通过 Telegram 发送文件 / 信息

- **生成的文件作为 Telegram 消息投递**，当文件挂在事件上时 —
  最典型的是 `payment.confirmed` 上的**支付收据** 和审批后的
  **业主对账单**（`statement.approved`）。账单 PDF 归档在
  文件登记簿，会员也可以在门户查看。
- Bot **token** 存为**密封密钥**（AES-256-GCM，UI 中掩码显示）；
  在 **Settings → Providers/Secrets** 轮换。
- 开发/演示系统中 bot 发送端是 **mock** 的 — 消息记录在
  **outbox**（Telegram 管理界面可见：状态/正文），而不是发到
  真实 Telegram。生产接线通过签名 webhook 用实时 bot。

> 在 Telegram 管理界面可以审查已关联聊天（Principal / Linked）、
> 按事件关闭通知、查看 **outbox**（消息状态和正文）—
> 便于确认*将要*发送什么。

---

## 7.4 应用内通知（无需设置）

即使没有 Telegram，系统也在应用内显示提醒：

| 位置 | 内容 |
|---|---|
| **Dashboard → Rent dues（M33）** | "提前天数"窗口内到期的账单和逾期账单 |
| **会员欠款徽章** | "$265.00 due" 式徽章（会员/账单上） |
| **文件到期徽章** | KYC/文件即将到期（30/7 天提醒） |
| **Reports → Overdue & not paid** | 逾期租金工作清单 |
| **低库存** | 低于阈值的商品（也是 Telegram `stock.low` 事件） |
| **SLA / 违约指示** | 逾期工单/投诉（维修/投诉 KPI） |

---

## 7.5 产生通知的后台任务

这些 cron 形态的任务（按权限可见/可触发）把状态变成消息：

| 任务 | 做什么 | 权限 |
|---|---|---|
| **billing-daily** | 宽限后计滞纳金；标记逾期；催收提醒 | M06:update |
| **rent-alerts** | 发出即将到期/逾期租金事件（M33） | M33:update（Admin/PM） |
| **telegram-dispatch** | 排空事件 → Telegram 消息；每日入住摘要 | M21:update（Admin+） |
| **sla-sweep** | 标记工单与投诉的 SLA 违约（升级） | M19:update（staff+） |
| **attendance-sweep** | 标记漏打卡 | M23:update |
| **invoice-generation** | 生成本期账单 | M07:create |
| **statement-generation** | 生成业主对账单 | GLOBAL M24:update |

### 定制消息措辞
**Settings → Templates** 允许管理员覆盖五个事件的
Telegram 模板：`invoice.issued`、`payment.confirmed`、`invoice.dunning_reminder`、
`rent.reminder`、`rent.overdue`。模板支持占位符如 `{total}`、
`{due}`、`{receipt}`、`{code}`。未覆盖的事件用内置默认。

---

## 7.6 Telegram 常见问题
| 问题 | 检查 / 修复 |
|---|---|
| 收不到消息 | (1) 关联了吗？ (2) 开关开了吗？ (3) 开发环境中消息**mock 到 outbox** — 查看 Telegram 界面； (4) 每日任务按计划/触发 dispatch |
| 码被拒 | 码是一次性的且短时效 — 重新申请新码 |
| 会员看到别人的数据 | 不可能发生 — 命令经 RBAC 校验到 OWN 范围；如怀疑有问题，向管理员报告并查审计日志 |
| 伪造/异常消息 | webhook 签名经验证；伪造更新被拒绝 |
| Bot token 泄露风险 | 在 Settings 轮换密封 token；保存后绝不以明文显示 |
