# 第 12 部分 — 术语表

RentManager 所用术语的简单定义。括号内为模块代码。

| 术语 | 白话含义 |
|---|---|
| **Property（物业）** | 出租场地/项目 — 库存树的顶层。 |
| **Building（楼宇）** | 物业内的楼，由一位业主拥有。 |
| **Floor（楼层）** | 楼内的一层。 |
| **Room / Bed（房间 / 床位）** | 可出租单元；co-living 中床位单独出租房间。 |
| **Room status（房间状态）** | vacant · reserved · occupied · cleaning · maintenance（状态机）。 |
| **Owner（landlord）（业主/房东）** | 拥有楼宇并收到业主对账单的人/公司。 |
| **Owner contract [M05]（业主合同）** | 管理协议：FIXED_RENT（总租金）或 REVENUE_SHARE（% + 费用）。 |
| **Member / Tenant（会员 / 租户）** | 住户/居住人；生命周期 prospect→verified→active→notice→moved_out。 |
| **KYC** | 会员在被 verified 前必须上传的身份文件（护照/ID 等）。 |
| **Party** | 任何人或公司的共享记录（会员、业主、供应商、联系人）。 |
| **Lease [M05]（租约）** | 会员对房间/床位的入住合同（draft→active→notice→terminated/completed）。 |
| **Rent plan / Rent engine [M06]（租金计划/租金引擎）** | 计费规则（金额、计租日、折算、滞纳金、税、折扣），生成账单行。 |
| **Cycle day（计租日）** | 每月计租的日期（钳制 1–28）。 |
| **Proration（折算）** | 部分月只按占用天数计费（如 17/31）。基准 = calendar 或 30 天。 |
| **Invoice [M07]（账单）** | 会员的月度账单。状态 draft→issued→partial_paid→paid→overdue（或 void）。无缺口编号 {PROP}-{YEAR}-{SEQ}。 |
| **Credit note（贷项通知单）** | 减少已出账账单（不可变）的正确方式；自动在零处结平。 |
| **Void（作废）** | 取消账单 — **仅 Super Admin**，必须带原因；号永不复用。 |
| **Dunning（催收）** | 逾期账单的提醒阶梯（+3/+7/+14 天）。 |
| **Late fee（滞纳金）** | 宽限期后的收费；固定或 %（有上限）；绝不超过应付金额。 |
| **Payment [M09]（收款）** | 收到的钱（cash/bank_transfer/qr/card/cheque）；pending→confirmed→refunded/failed。 |
| **Receipt（收据）** | 编号的收款凭证（`RCP-…`），PDF 自动归档。 |
| **Allocation（分摊）** | 把收款应用到账单，旧到新；合计等于收款额。 |
| **Member credit（会员信用）** | 会员超额支付的款项，留在账户上（可退）— 不是收入。 |
| **Refund（退款）** | 退还钱；需 Accountant+ 审批；冲销账本分录。 |
| **QR payment [M13]（QR 收款）** | 扫码支付；会员 QR 打开公开 `/pay` 页（免登录、仅精确应付）。 |
| **Deposit [M10]（押金）** | 为租约保管的押金；分期开票；留在负债科目（不是收入）。 |
| **Deposit deduction（押金扣款）** | 退房时保留部分押金（损坏/清洁/未付租金）— 需凭证 + 原因。 |
| **Utility [M11]（水电费）** | 表计费（电/水/气）= 用量 × 阶梯费率；计入下一张账单。 |
| **Service [M12]（服务）** | 附加项（WiFi、车位、WiFi 账户、洗衣）。固定月费或按次。 |
| **Ledger [M08]（账本）** | 所有资金事件的不可变复式账簿（只追加）。 |
| **Journal（日记账）** | 账本分录的按时间排列清单。 |
| **Trial balance（试算平衡）** | 检查总借方 = 总贷方（应轧零）。 |
| **Debit / Credit（借方 / 贷方）** | 每笔分录的两面（Σ 借方 = Σ 贷方 永远成立）。 |
| **Account（科目）** | 被跟踪的桶：Cash（1100）、Bank（1200）、Rent Receivable（1300）、Deposit Liability（2100）、Owner Payable（2200）、Tax Payable（2300）、Owner Distributions（3900）、收入 4000–4900、费用 5000–5100。 |
| **Receivable（应收）** | 会员欠的钱（资产），直到付清。 |
| **Revenue / Income（收入）** | 赚到的钱（租金、服务、水电、滞纳金、其他）。 |
| **Expense [M20]（费用）** | 运营花掉的钱；低于 $500 的费用自动审批，超过需审批。 |
| **Asset（资产）** | 企业持有的（现金、银行、应收）。 |
| **Liability（负债）** | 企业欠的（保管押金、应付业主、应交税）。 |
| **Equity（权益）** | 业主份额 / 业主分配（科目 3900）。 |
| **Reversal（冲销）** | 抵消已入账分录的更正分录（原分录保留）。 |
| **Profit & Loss (P&L) [M20/M26]（利润表）** | 收入 − 费用（及业主分成）= 某期间净盈亏。 |
| **Owner statement [M24]（业主对账单）** | 每位业主的月度分成报表：实收 × 分成（或固定租金）− 费用 − 成本；draft→approved→paid。 |
| **Owner payable (2200)（应付业主）** | 欠业主的钱（负债），支付时冲销。 |
| **POS [M14]（收银台）** | 销售点柜台：收银会话、备用金、销售、挂房账。 |
| **Charge to room（挂房账）** | 记到住户名上的一次性账单的 POS 销售。 |
| **Stock [M15]（库存）** | 存货；只通过移动变化（purchase/sale/consumption/adjustment/transfer）。 |
| **Purchase order (PO) [M29]（采购单）** | 计划中的供应商订单；下单（place）只是记账，收货（receive）才加库存。 |
| **Stocktake（盘点）** | 实点库存；差异记 adjustment。 |
| **Moving-average cost（移动平均成本）** | 存货估值方法（新采购摊进单位成本平均）。 |
| **Room move [M16]（换房）** | 住户在房间间移动；生成一张净调整账单；两个房间都翻状态。 |
| **Inspection [M18]（检查）** | 入住/退房/定期状况清单；退房检查是结束租约的必需项。 |
| **Finding（发现项）** | 检查中失败的条目；可开工单或提出押金扣款。 |
| **Maintenance ticket [M19]（维修工单）** | 修理任务：open→assigned→in_progress→resolved→verified/closed；按优先级 SLA。 |
| **SLA** | 服务水平时间目标（urgent 4 小时 … low 168 小时）；违约每日清扫。 |
| **Complaint [M22]（投诉）** | 会员纠纷：new→acknowledged→in_progress→resolved→closed；可转工单；评分 1–5。 |
| **Attendance [M23]（考勤）** | 员工打卡（kiosk PIN 或手机地理围栏）；异常；CSV 工资导出。 |
| **Short stays [M32]（短住）** | 酒店式按小时/天预订（`STY-…`），通过租住模块与费率规则。 |
| **Tenant portal [M25]（租户门户）** | 位于 `/portal` 的会员自助 Web 应用（OTP 登录、仅自己的数据）。 |
| **Owner portal（业主门户）** | 房东查看其楼宇/对账单/证件的只读视图。 |
| **Telegram bot [M21]** | 用于通知和 `/status /dues /pay` 的聊天集成；用一次性码关联。 |
| **Reports [M26]（报表）** | 13 张账本/查询支撑的分析报表，可导出 CSV/PDF。 |
| **Arrears（欠款）** | 未结账单尚欠总额。 |
| **Occupancy %（入住率 %）** | 已住房间 ÷ 总房间。 |
| **Cash position（现金头寸）** | 账本 Cash（1100）+ Bank（1200）余额（仪表板 KPI）。 |
| **Audit log [M01/M27]（审计日志）** | 每次变更的防篡改、只追加记录（操作者、时间、前后值、IP）。 |
| **Role（角色）** | 一组有名字的权限（Super Admin、Admin、Property Manager、Accountant、Staff、Owner、Member 或自定义）。 |
| **Permission（权限）** | 模块 × 操作 × 范围（如 PROPERTY 范围下的 `M09:approve`）。 |
| **Action（操作）** | create · read · update · delete · approve · void · refund · export · config。 |
| **Scope（范围）** | GLOBAL（所有物业）· PROPERTY（所分配物业）· OWN（仅自己的记录）。 |
| **RBDC** | 基于角色的动态访问控制 — 在每个 API 调用上强制的权限系统。 |
| **Feature flag（功能开关）** | 组织级模块开/关开关（Settings → Features）。 |
| **2FA / TOTP [M27]** | 通过验证器 App 的双因素认证；Admin+ 强制。 |
| **Session（会话）** | 已登录的浏览器会话；可吊销；固定天数后过期。 |
| **Feature/module code (Mxx)（模块代码）** | 内部权限代码（M01…M33），显示在角色界面，`can()` 使用。 |
| **Minor units（最小货币单位）** | 钱以整型分存储，避免舍入误差（单一组织货币）。 |
| **Forward-only（只向前）** | 设置变更只影响未来交易；已入账历史永不改写。 |
| **Idempotent（幂等）** | 任务跑两次结果相同（不产生重复账单/收款）。 |
