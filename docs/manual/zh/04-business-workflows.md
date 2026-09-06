# 第 4 部分 — 业务流程

本部分把各模块连成**端到端流程**。每个流程展示：谁操作、按什么顺序、
创建哪些记录、财务影响是什么。图用简单箭头。

---

## 4.1 租户生命周期（入住 → 退房）

```
Prospect enquires
   │  Staff creates Member (prospect)                         [M02]
   ▼
KYC documents uploaded & complete
   │  Member: prospect → verified                             [M17]
   ▼
Lease created (draft) ── room becomes "reserved"              [M05]
   │  Rent amount, cycle day, proration basis, deposit terms
   │  Services assigned (WiFi/parking)                        [M12]
   ▼
Lease ACTIVATED
   │  room → occupied · member → active
   │  deposit billed (installment invoices)                   [M10]
   │  first invoice scheduled                                 [M06/M07]
   ▼
Monthly living
   │  Invoices generated (rent + services + utilities)        [M07]
   │  Member pays (QR/cash/bank/card) → receipts              [M09/M13]
   │  Maintenance/complaints handled                          [M19/M22]
   │  Meter readings → utility charges                        [M11]
   │  POS room charges (if any)                               [M14]
   │  (Optional) room move → adjustment invoice               [M16]
   ▼
Move-out notice given (lease → notice)
   │  Dues must clear to 0 (or be written off with approval)
   ▼
Move-out INSPECTION completed (hard gate)                     [M18]
   │  Findings → maintenance ticket and/or deposit deduction  [M19/M10]
   ▼
Lease TERMINATED / COMPLETED
   │  room → cleaning · member → moved_out
   │  deposit settled: deductions (evidence) + refund         [M10]
   ▼
Room returns to vacant → ready to re-let                      [M04]
```

**这个生命周期中的关键控制**
- KYC 不完整，会员不能 **verified**。
- 一个房间不能有**两个生效租约**（每床位一个；强制容量）。
- 有未清欠款或没有退房检查，租约不能**结束**。
- 租约完全关闭前，押金负债必须轧平为**零**。

---

## 4.2 计费流程（月度结账节奏）

```
 (Fixed day each month)
   │
   ├─ 1. Enter utility meter readings (manual / CSV / estimated)   [M11]
   ├─ 2. Log per-use service usage (laundry, visitor parking)      [M12]
   ├─ 3. Confirm any POS "charge to room" sales are in              [M14]
   │
   ▼
   4. RUN invoice generation                                       [M06/M07]
   │     • every active lease with a pending period
   │     • mid-month leases get a prorated stub first (catch-up)
   │     • one live invoice per lease & period (idempotent)
   │     • gapless numbering {PROP}-{YEAR}-{SEQ}, PDF filed
   │
   ├─ 5. Review: spot-check totals = Σ lines − discount + tax
   ▼
   6. ISSUE invoices (draft → issued) → members see them in portal
   │     • Telegram "invoice issued" (if linked)
   │
   ▼
 (Daily job thereafter)
   7. After grace period → late fees post; invoices → overdue
   8. Dunning reminders at +3 / +7 / +14 days                      [M33/M21]
   │
   ▼
   9. Collections recorded against invoices → receipts            [M09]
        invoice: issued → partial_paid → paid
```

**谁做什么：** Accountant/Manager 运行生成并出账；每日
计费任务（或授权触发）加滞纳金/逾期/催收；Staff
登记收款。

---

## 4.3 收款流程

```
 Member pays (portal QR, or cash/bank/card/cheque at desk)
   │
   ▼
 Payment created
   ├─ cash/bank/cheque → confirmed immediately
   └─ QR/card/gateway  → pending → webhook confirms (once; duplicates ignored)
   │
   ▼
 Allocation (oldest-first by due date/period)
   ├─ deposit invoices picked first
   ├─ remainder overpays → member credit
   ▼
 Results (all automatic)
   ├─ invoice status partial_paid / paid
   ├─ receipt RCP-… PDF filed
   ├─ ledger: DR Cash/Bank · CR Rent Receivable (and revenue recognition)
   └─ Telegram receipt message (if linked)
```
退款反向执行：**Accountant+ 审批**、ledger 反向的 payout、
会员 credit 退回。失败的收款不记任何东西。

---

## 4.4 合同流程

**会员租约：**
```
Create (draft) → review terms → Activate → (notice) → Terminate/Complete
                     │
   snapshot of rent/cycle/proration/deposit/services is locked at activation
   (changes after activation use renewals / room moves / notices — never rewrite)
```

**业主合同：**
```
Create owner + payout method          [M03]
   │
Create owner contract (draft)         [M05]
   model = FIXED_RENT (master rent)  or  REVENUE_SHARE (% + management fee)
   term dates + payout cycle day (1–28)
   │
Activate → Building.ownerId syncs (one open contract per building)
   │
Monthly owner statements are generated from the active contract   [M24]
   │
Terminate (reason) / expire
```

> **安全修改现有生效合同：** 不要编辑已入账条款。
> 结束/终止当前合同并创建新合同（对会员
> 租约，用续租 / 换房）。所有更改都留审计。

---

## 4.5 费用流程

```
Record expense (vendor, category→ledger 5000/5100, amount, date,
                payment method, receipt attachment, property)
   │
   ▼
 Approval?
   ├─ Below threshold ($500.00 default) → auto-approved → LEDGER POSTS
   └─ Above threshold → pending → Accountant/Manager approves → posts
   │
   ▼
 Paid (paid via payment method)  ──  ledger: DR Expense · CR Cash/Bank
   │
   └─ (If wrong) VOID → reversal entries (history preserved)
```
周期性费用可设为**模板（templates）** 并每期**运行**；
按物业/分类/月的**预算（budgets）**
在 P&L 报表中显示差异（variance）。

---

## 4.6 维修 / 投诉流程

```
Member raises issue (portal/Telegram) OR staff logs it
   │
   ├─ Complaint?  new → acknowledged → (one-click) → Maintenance ticket
   │                                    resolved → member rates 1–5 → closed
   ▼
Maintenance: open → assigned → in_progress → resolved → verified/closed
   │   • SLA clock by priority (urgent 4h … low 168h)
   │   • daily breach sweep → escalations
   │   • consume stock parts (M15) + labour = costs
   ▼
Cost routing
   ├─ operator cost → Expense (M20) → P&L
   └─ owner-borne   → Owner Statement (M24)
```

**检查也喂入这里：** 退房发现项可开工单或
提出押金扣款（第 3.15 节）。

---

## 4.7 换房流程

```
Request (member portal or staff): target room + effective date
   │
   ▼
System preview: prorated new rent + move fee − unused old-rent credit
                (= net adjustment) + deposit delta
   │
   ▼
Approve → Execute
   ├─ old lease ends; new lease starts
   ├─ old room → cleaning ; new room → occupied
   ├─ deposit follows member
   ├─ ONE adjustment invoice carries the net delta
   └─ history on member timeline
 (request can be cancelled before execution)
```

---

## 4.8 业主对账单流程

```
Month closes (collections + costs final)
   │
Generate statements (job; idempotent per contract+month)        [M24]
   formula:  collected × share%   OR   fixed master rent
            − management fee − pass-through expenses
            − owner-borne maintenance ± approved adjustments
            = net owner payout
   │
 draft → approved
   │   approval accrues: DR 3900 Owner Distributions · CR 2200 Owner Payable
   ▼
 paid (payout via payment method)
   │   DR 2200 Owner Payable · CR Cash/Bank  (payable nets back to prior balance)
   ▼
 PDF auto-filed → visible in owner portal                       [M17/M03]
```
生成受控于 **Accountant+（GLOBAL M24:update）**。重新生成绝不
改写历史 — 新期间只向前追加；更正用
**留审计的调整（audited adjustments）**。

---

## 4.9 租户门户（M25）— 会员自助服务

位于 **`/portal`** 的移动端优先 Web 应用。会员用发到邮箱/手机的
**一次性密码（OTP）** 登录（哈希、一次性、5 次后锁定）。登录会
实例化其 **MEMBER** 用户，使门户运行在同一组模块 API 上、带严格
**OWN 范围**（永远只碰自己的记录）。

会员在门户可以：
- 看自己的**仪表板**：房间、租约、**应付余额**。
- 查看**账单**并**扫码支付**（M13）。
- 看**押金**状态和自己的**账户对账单**。
- 发起**维修**和**投诉**请求；跟踪；评价处理结果。
- 申请**换房**、发出**退房通知**（共享租约逻辑）。
- 上传**证件 / KYC**、查看证件/公告。

**会员的黄金路径：** 打开账单 → 扫码支付 →（收款确认，
收据在 Telegram/门户）→ 发起投诉 → 跟踪工单 —
全程无需员工帮助。

---

## 4.10 审批 — 谁能批什么

| 流程 | 谁可以创建 | 谁审批 |
|---|---|---|
| 费用 | Staff/Manager | 低于阈值自动；超过 **Accountant/Manager** |
| 账单 void | — | **仅 Super Admin**（原因 + 审计） |
| Credit notes | Accountant/Manager | 创建即入账（≤ 应付） |
| 收款退款 | — | **Accountant+** |
| 押金退款 / 扣款 | Accountant/Manager | **会计审批**；扣款需凭证 |
| 换房 | Staff/Member（申请） | **Manager** 在执行前审批 |
| 业主对账单 | — | 生成 = **Accountant+**；审批/支付 = 财务 |
| 角色/权限变更 | **Super Admin/Admin** | 留审计 |

> 审批和每次状态变化都写一条**审计日志（audit log）**，含
> 前后值和 IP（第 9 部分）。
