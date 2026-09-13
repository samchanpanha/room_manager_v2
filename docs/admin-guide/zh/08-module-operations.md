# 8. 各模块管理操作

日常操作见 `manual/03-user-guide.md`；这里是**管理员视角**：
每个模块要配置什么、审批什么、盯什么。

## M04 Properties & rooms
- 一开始就把房间结构建对（type、floor、rent）。房间**状态机被强制执行**
 （available → occupied → cleaning → available……）；
 员工不能跳状态 — moves/leases 自动翻转状态。
- 楼宇可带**地图坐标 + 围栏半径**，用于 kiosk 考勤。

## M05 Leases · M16 Room moves
- 租约激活自动开出**押金账单**（M10）。
- **退租检查（M18）是终止租约的硬门槛**。
- 换房 = 申请 → 审批 → 执行：旧租约终止、新租约开始、
 押金跟随会员，**一张调整账单**轧清按比例差额。
 切勿手工改两份租约来伪造换房。

## M06 Rent Engine · M07 Invoices
- 每月 `invoice-generation` 任务（按账单日）+ 每天 `billing-daily`
 补算。月中暂停**按比例**；固定服务跟随 engine。
- 发票号来自 `number_sequences` + 设置前缀 — 断号正常
 （幂等重试），重号不可能。

## M08 Ledger
- 会计负责。每个资金事件都记平衡分录；作废与退款记**冲销**，
 永不编辑。P&L 与报表都读总账，
 因此"register ↔ ledger"必须精确对平 — 若报表对不上，
 去查分录，不要怪报表。

## M09 Payments · M13 QR
- 方式：现金 / 银行转账 / QR / 卡 / 支票。状态机：
 `pending → confirmed → refunded | failed`。
- **核销按最早优先**（到期日，再按周期）且不可变；
 多付成为**会员余额**（会计可做账退回，ledger 冲销式支出）。
- Webhook **签名 + 幂等** — 重复的网关通知被忽略，永不重复入账。
 收据（`RCP-…`）自动归档为 PDF。
- 公开 `/pay` 页：仅精确金额、限流、无需登录。

## M10 Deposits
- 租约激活时开单；扣款由退租检查发现项提议，
 在 **M10 中审批**；支出经 ledger 冲销。

## M11 Utilities · M12 Services
- 按房间的表（电/水/气），毫单位精度；估算 = 最近 3 次平均；
 支持 CSV 导入。阶梯费率；费用**自动挂到下个周期**；
 超过均值 2 倍以上标记为异常。
- 服务：包月固定（暂停按比例）vs 按次（一次性行）。
 车位唯一；WiFi 账号跟随租约。

## M14 POS · M15 Stock · M29 Purchase orders
- POS 班次：开班备用金 → 应有 = 备用金 + Σ 现金 → 关班盘点
 差异。**记到房间**会自动开一次性账单 + AR 分录。
- 库存移动**仅追加**（purchase/sale/consumption/
 maintenance_use/adjustment/transfer），移动加权成本。
 **盘点记差异调整** — 这才是更正路径，不是编辑。
- 低库存告警发给员工（接通后也发 Telegram）。

## M18 Inspections · M19 Maintenance · M22 Complaints
- 按房间类型的检查清单模板；退租检查是终止租约门槛；
 损坏发现 → 押金扣款或工单。
- 工单：open → assigned → in_progress → resolved → verified/closed，
 按优先级 SLA（urgent 4h … low 168h）+ 每日违约扫描。成本进
 费用或业主 P&L。
- 投诉：thread + SLA + 会员确认关闭并 1–5 评分；
 一键转为工单。

## M20 Expenses & P&L
- 供应商费用 + 票据附件；**超可配置阈值需审批**
 （以下自动通过；Accountant+ 门槛）；作废冲销。
 月度预算及差异；经常性模板；按物业与合并 P&L 均来自总账。

## M23 Attendance
- Kiosk-PIN + 手机打卡、可选物业围栏、班次模板
 （宽限 + OT 倍率）；异常（迟到/早退/漏打卡/加班/围栏）
 经审计解决；月度汇总 + CSV 薪资导出。

## M24 Owner statements
- 每月生成任务（付款日、force bypass、按合同+月份幂等）。公式：
 已收 × 分成 | 固定包租 − 管理费 − 代垫 − 业主维修 ± 已审计调整。
- `draft → approved → paid`；审批计提 DR 3900 / CR 2200，
 付款 DR 2200 / CR cash|bank。PDF 自动归档；业主在门户查看。
 生成限 Accountant+（GLOBAL M24:update）。

## M25 Tenant portal · M21 Telegram
- 门户（`/portal`，移动 PWA）：OTP 登录（哈希一次性码、
 锁定）生成会员的 User（MEMBER 角色）— 在同一模块 API 上
 **严格 OWN** 范围。无重复业务逻辑。
- Telegram：签名 webhook（伪造被拒）、一次性绑定码、命令
 `/status /dues /pay /help`（仅自己的数据）、事件→模板分发
 （每用户开关）。Dev token = 模拟发送 + 完整发件箱。

## M26 Reports
- 12 张报表 + 仪表盘 KPI 条（入住率 %、已开 vs 已收、
 欠款、待处理工单、现金头寸）。每张报表声明来源行；
 账龄合计必须等于未付发票总额。CSV（RFC-4180）
 + 品牌 PDF 导出；按日期 + 物业筛选。

---
