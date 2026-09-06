# 第 1 部分 — 系统概述

## 1.1 系统名称

本应用名为 **RentManager**（包名 `rentmanager`）。它是一个面向房东、物业管理
公司及其团队的租赁与合租**物业运营平台**。

它以 Web 应用（Next.js）形式运行。员工在桌面浏览器中使用它（后台办公）；租客
和业主通过手机上的 **租客门户** 和 **业主门户** 使用。此外还有一个
**Telegram 机器人**用于通知和快速提问。

## 1.2 目的 — 系统管理什么

RentManager **端到端**地运营一个租赁 / 合租物业业务，从物理建筑到业主的
每月分成：

- **物业库存** — 物业 → 楼栋 → 楼层 → 房间 → 床位。
- **人员** — 会员（租客/住户）、业主（房东）、员工账号、供应商。
- **合同** — 会员租约（入住合同）和业主合同（管理协议）。
- **计费** — 由租金引擎自动生成的月度租金、服务与水电账单。
- **收款** — 现金、银行转账、二维码、卡或支票付款，附编号收据。
- **押金** — 押金的计费、持有、扣除与退还。
- **运营** — 换房、检查、维修工单、投诉、员工考勤。
- **商店** — 销售点（POS）柜台和库存管理。
- **财务** — 不可篡改的双式记账账本、费用、预算、损益表、业主对账单。
- **自助服务** — 租客门户（付租金、提工单、传文件）和业主门户。
- **通知** — 应用内、仪表板告警和 Telegram 机器人（收据、提醒、对账单）。
- **治理** — 每个页面和 API 调用都受基于角色的权限控制，审计日志、2FA、报表。

### 谁在使用

| 用户 | 工作位置 | 做什么 |
|---|---|---|
| 超级管理员 / 管理员 | 管理控制台 | 配置组织、用户、角色、设置、安全 |
| 物业经理 | 管理控制台 | 运营所负责物业：房间、租约、运营、审批 |
| 会计 | 管理控制台 | 租金引擎、账单、收款、押金、账本、业主对账单 |
| 员工 / 收银 / 前台 | 管理控制台（按范围限定） | 登记会员、租约、计费、收款、POS、工单、考勤 |
| 业主（房东） | 业主门户 | 查看自己的楼栋、入住率、对账单与文件（只读） |
| 会员（租客） | 租客门户 + Telegram | 查看账单、二维码付款、提申请、上传 KYC、押金状态 |

### 它解决的商业问题

- **没有遗漏** — 房间、租约、账单和工单都有状态和历史。
- **租金自动且准确地计费** — 月中换房按比例折算、滞纳金、催缴提醒。
- **钱始终可追溯** — 每张账单、收款、退款和费用都记借贷平衡分录；已入账的不可删除。
- **租客收款便捷** — 二维码付款、租客门户、Telegram 收据。
- **业主得到公平的月度对账** — 已收租金 × 分成（或固定租金），减去费用和成本。
- **对的人看到对的东西** — 员工被限定在自己负责的物业内；会员和业主只看到自己的记录。

## 1.3 模块地图（真实的模块清单）

权限系统由 **31 个模块**构成，每个都有代码。这就是
角色与权限界面和菜单实际使用的清单。

| 代码 | 模块 | 菜单页 | 一句话用途 |
|---|---|---|---|
| M01 | 用户与 RBDC | **Users**、**Roles & Permissions**、**Audit Log** | 员工账号、动态角色、权限网格、审计轨迹 |
| M02 | 会员 | **Members** | 租客/住户档案、KYC、生命周期 |
| M03 | 业主 | **Owners** | 房东档案与付款方式 |
| M04 | 物业与房间 | **Properties** | 物业 → 楼栋 → 楼层 → 房间 → 床位 库存 |
| M05 | 租约 | **Leases** | 会员租约与业主合同、激活、终止 |
| M06 | 租金引擎 | **Rent Engine** | 计费规则（方案、滞纳金、税、折扣） |
| M07 | 账单 | **Invoices** | 月度账单：租金、服务、水电、一次性 |
| M08 | 账本 | **Ledger** | 不可篡改的双式记账（日记账、试算平衡） |
| M09 | 收款 | **Payments** | 按账单收款；收据；退款 |
| M10 | 押金 | **Deposits** | 押金：计费、持有、扣除、退还 |
| M11 | 水电费 | **Utilities** | 表计（电/水/气）、读数、资费、费用 |
| M12 | 服务 | **Services** | 附加目录（WiFi、停车、洗衣）、分配、用量 |
| M13 | 二维码收款 | *（无菜单 — 在每张账单 + `/pay` 上）* | 二维码付款流程与支付网关 webhook |
| M14 | POS | **POS**、**POS Catalog** | 柜台销售、收银班次、商品 |
| M15 | 库存 | **Stock** | 库存：出入库、盘点、供应商、估值 |
| M16 | 换房 | **Room Moves** | 会员在房间间换房，带按比例调整 |
| M17 | 文件 | *（在会员、业主、账单…内部）* | 文件登记、上传、生成的 PDF、带签名的下载链接 |
| M18 | 检查 | **Inspections** | 入住/退租/定期房间状况清单 |
| M19 | 维修 | **Maintenance** | 带 SLA、成本、零件的维修工单 |
| M20 | 支出与损益 | **Expenses & P&L** | 供应商费用、预算、经常性成本、损益 |
| M21 | Telegram | **Telegram Bot** | 机器人绑定、通知、会员指令 |
| M22 | 投诉 | **Complaints** | 带流程和评级的会员申诉 |
| M23 | 考勤 | **Attendance** | 员工打卡、班次、例外、工资导出 |
| M24 | 业主对账单 | **Owner Statements** | 业主月度分成核算与支付 |
| M25 | 租客门户 | **Tenant Portal** | 会员自助 Web 应用（`/portal`） |
| M26 | 报表 | **Reports** | 13 张报表 + 仪表板 KPI，CSV/PDF 导出 |
| M27 | 安全 | **Security** | 2FA、会话/设备、审计链校验、加固 |
| M28 | 设置 | **Settings** | 组织、地区、计费、滞纳金、功能开关、密钥等 |
| M29 | 采购单 | **Purchase Orders** | 计划并收货入库采购 |
| M32 | 短租（Rent Modules） | **Short Stays** | 按小时/按天的客人预订（酒店式） |
| M33 | 租金提醒与通知 | *（仪表板 "Rent dues" 卡片）* | 即将到期/逾期租金提醒事件 |

> 说明：
> - **M13 二维码收款** 故意没有管理菜单页 — 二维码付款
>   按钮位于每张未结账单上，以及公共海报页 **`/pay`** 上。
> - **M17 文件** 也不是独立菜单 — 文件出现在其所属的会员、业主、
>   租约和账单界面里。
> - 模块 **M30/M31** 在当前构建中未使用。

## 1.4 系统如何工作 — 端到端生命周期

信息单向流动：**物理世界 → 合同 → 计费 →
钱 → 会计 → 报表 → 业主**。

```
 Sign in
   │
   ▼
 Dashboard (occupancy, collected vs billed, arrears, cash, alerts)
   │
   ▼
 Property → Building → Floor → Room (set price & status)        [M04]
   │
   ▼
 Owner + Owner Contract (fixed rent OR revenue share %)         [M03, M05]
   │
   ▼
 Member profile + KYC documents (prospect → verified)           [M02, M17]
   │
   ▼
 Lease on a room (draft → active)                               [M05]
   │        ├── room becomes "occupied", member becomes "active"
   │        ├── deposit billed (installment invoices)           [M10]
   │        └── services assigned (WiFi/parking/laundry)        [M12]
   │
   ▼
 Monthly billing job runs                                       [M06, M07]
   │        rent + services + utilities (meters) + one-offs
   │        − discounts + tax + late fees  =  Invoice (issued, gapless number, PDF)
   │
   ▼
 Member pays (QR in portal / cash / bank / card / cheque)       [M09, M13]
   │        ├── receipt PDF auto-filed (RCP-… )
   │        ├── invoice flips to partial_paid → paid
   │        └── overpayment stays as member credit
   │
   ▼
 Ledger posts balanced double-entry lines (append-only)         [M08]
   │
   ├── Expenses recorded (vendor costs, parts, maintenance)     [M20, M15, M19]
   ├── POS sales & stock movements                              [M14, M15]
   │
   ▼
 Profit & Loss report (revenue − expenses)                      [M26]
   │
   ▼
 Owner Statement generated → approved → paid                    [M24]
   │        collected × share | fixed rent − fees − costs = net payout
   │
   ▼
 Reports, dashboard KPIs, Telegram notifications                [M26, M21, M33]
```

**黄金法则：** 财务数据永不删除。已出具的账单用
**红字通知单（credit note）**更正；错误的账本分录用
**冲销（reversal）**撤销；已支付的费用被**冲销（void）**（即反向冲销）。
这保证了账目平衡、完整历史可审计。

## 1.5 模块之间的关键关系

- 一个**物业**有多个**楼栋**；一栋楼有多个**楼层**；一个楼层
  有多个**房间**；一个房间可以有多张**床位**。几乎其他所有东西
  都挂在物业/房间下面。
- 一栋**楼**属于一位**业主**，由一份生效中的**业主合同**（`M05`）正式确立。
- 一位**会员**就一间房/床签订**租约**。激活租约会把
  房间状态变为 *occupied*，会员变为 *active*。
- **租约**驱动**账单**（经租金引擎），携带一笔**押金**，
  并可挂接**服务**和**水电表计**。
- **账单**由**收款**支付，收款分配到账单
  （从旧到新）。两者都记入**账本**。
- **押金**放在负债账户中（*不是*收入），直到退租时
  退还或扣除。
- **维修工单**、**检查**和 **POS/库存**都把成本计入
  **支出**和**损益表**；业主承担的成本流入**业主对账单**。
- 每条记录都**按物业隔离**，每次数据变更都写一行**审计日志**。
