# 4. 角色、权限与 RBDC

## 4.1 模型（读一次，受用 forever）

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

## 4.2 默认角色与矩阵

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

## 4.3 构建自定义角色（示例：收银员）

1. **Admin → Roles → New role** → 命名为 `Cashier`。
2. 勾选网格：**M09（Payments）** → **PROPERTY** 范围业务写入；其余保持关闭。
3. 把角色分配给出纳用户 + 分配其**物业**。
4. 结果：她可以记录收款，但**不能打开发票编辑** —
   API 返回 `403`。（该用例被 CI 反例测试覆盖。）

## 4.4 报表权限

报表属于 **M26**。此外，**设置 → Reports** 控制：
`enabledKeys`（启用哪些报表）、`assignments`（哪些角色/用户看哪些）、
`designs`（列/品牌）。报表数据永远不可编辑。

## 4.5 安全规则

- 默认最小权限；有效权限为所有角色的并集。
- **使用中的角色不可删除**；超级管理员角色受保护。
- 每次角色/权限变更都**审计**；矩阵在 CI 中快照测试，
  权限不会被悄悄扩大。

---
