# 第 5 部分 — 财务与会计指南

写给管钱的人 — 以及想看懂钱的经理。不需要会计背景：每个术语都用白话解释。

---

## 5.1 账本背后的一个思想

每次钱动，系统写**两条平衡分录**（复式记账，"轻量"版）。从不破的规矩：

> **借方合计 = 贷方合计，永远。** 数据库、服务代码和自动化测试强制
> 这一点。不平衡的过账会被拒绝。

账本**只追加（append-only）** — 已入账分录不能改也不能删
（数据库会报错）。错误用一条**冲销（reversal）**分录修正，
它指回原分录，所以完整历史永远如实。

### 白话术语
| 术语 | 在这里的意思 |
|---|---|
| **借方（Debit）/ 贷方（Credit）** | 每笔分录的两面。别想"好/坏" — 想"左/右"。钱进来 vs 钱欠下/赚到。 |
| **科目（Account）** | 系统跟踪的桶（现金、银行、应收租金、收入…）。 |
| **账本（Ledger）** | 所有科目全部分录的书。 |
| **日记账（Journal）** | 按时间排列的分录清单（浏览器在 **Finance → Ledger**）。 |
| **试算平衡（Trial balance）** | 检查所有借方等于所有贷方（应轧平为零）。 |
| **应收（Receivable）** | 会员**欠**你的钱（资产），直到他们付清。 |
| **收入（Revenue）** | **赚到**的钱（租金、服务、水电、滞纳金）。 |
| **费用（Expense）** | 为运营**花掉**的钱。 |
| **资产（Asset）** | 你持有的（现金、银行、会员欠你的）。 |
| **负债（Liability）** | 你**欠别人的**（保管的押金、应付业主、应交税）。 |
| **权益（Equity）** | 业主份额 / 业主分配。 |

---

## 5.2 科目表（固定系统代码）

这些是系统里仅有的科目（你不能随意创建）：

| 代码 | 科目 | 类型 | 装什么 |
|---|---|---|---|
| 1100 | **Cash** | 资产 | 手头现金 |
| 1200 | **Bank** | 资产 | 银行里的钱 |
| 1300 | **Rent Receivable** | 资产 | 会员当前欠的 |
| 2100 | **Deposit Liability** | 负债 | 你保管的押金 |
| 2200 | **Owner Payable** | 负债 | 应付业主款 |
| 2300 | **Tax Payable** | 负债 | 已收未缴的税 |
| 3900 | **Owner Distributions** | 权益 | 业主分配计提（仅资产负债表） |
| 4000 | **Rent Revenue** | 收入 | 赚到的租金 |
| 4100 | **Service Revenue** | 收入 | WiFi/停车/洗衣服务 |
| 4200 | **Utility Revenue** | 收入 | 电/水/气收费 |
| 4300 | **Late Fee Revenue** | 收入 | 滞纳金 |
| 4900 | **Other Revenue** | 收入 | 一次性收费、损坏/清洁的押金扣款 |
| 5000 | **Operating Expenses** | 费用 | 日常成本 |
| 5100 | **Bank Fees** | 费用 | 银行手续费 |

> 资产和费用科目随借方"长大"；负债、收入和权益科目
> 随贷方长大。

---

## 5.3 每个资金事件记什么账

### (a) 账单开出
会员被计费。你现在**被欠**这笔钱，而且已**确认**收入：

| | 借方 | 贷方 |
|---|---|---|
| Rent Receivable（1300） | ↑ 计费总额 | |
| 收入科目（4000 rent / 4100 service / 4200 utility / 4300 late fee / 4900 one-time） | | ↑ 确认 |
| Tax Payable（2300）— 如有税 | | ↑ 税 |
| **押金账单** 则贷记 **Deposit Liability（2100）** — 押金*不是*收入。 |

```
DR 1300 Rent Receivable      350.00
   CR 4000 Rent Revenue              300.00
   CR 4100 Service Revenue            15.00
   CR 4200 Utility Revenue            35.00
```

### (b) 会员支付账单
现金/银行增加；应收被冲掉：

```
DR 1100 Cash (or 1200 Bank)  350.00
   CR 1300 Rent Receivable           350.00
```

**白话：** *手里的现金多了；会员欠的钱少了。*

### (c) 滞纳金计入（宽限后）
```
DR 1300 Rent Receivable       10.00
   CR 4300 Late Fee Revenue           10.00
```

### (d) 押金收讫
押金是保管款（负债），**不是**收入：
```
DR 1100 Cash                 300.00
   CR 2100 Deposit Liability          300.00
```
退房时，扣款（损坏/清洁）把一部分释放到 **4900 Other Revenue**
或冲销未付应收；退款**借记 2100**、**贷记 Cash/Bank**。
对已结租约，该租约的 2100 必须轧平为 **0**。

### (e) 费用记录并支付
```
DR 5000 Operating Expenses    80.00
   CR 1100 Cash (or 1200 Bank)        80.00
```

### (f) 业主对账单先审批后支付
审批计提应付业主金额：
```
DR 3900 Owner Distributions   500.00
   CR 2200 Owner Payable              500.00
```
支付业主冲掉应付：
```
DR 2200 Owner Payable         500.00
   CR 1100/1200 Cash/Bank             500.00
```
（支付后 Owner Payable 轧回之前的余额。）

### 更正
- **作废一笔费用（void）** → 冲销分录（原分录保留，冲销分录抵消它）。
- **账单的 credit note** → 冲销已计金额（自动在零处结平）。
- **退款** → 冲销现金和应收（需 Accountant+ 审批）。
- 已入账行永不能编辑/删除 — 数据库拦截。

---

## 5.4 在哪里看会计数据
- **Finance → Ledger [M08]：** **日记账浏览器**（按科目、日期、
  凭证号、物业/会员筛选）和**试算平衡**。Admin/Accountant 可访问。
- **会员对账单**（`Members → [member] → statement`，或门户）：
  单个会员的**滚动应收余额**。会员只看自己的。
- **期初余额（Opening balances）：** 在 **Settings → Opening balances**
  设置，作为平衡的 `opening` 过账，在你首次迁入系统时录入。

> 资金完整性规则（来自产品规格）：整型最小货币单位、
> 每组织一种货币、Σ 借方 = Σ 贷方、不可删除、分摊合计
> 等于收款、幂等 webhook、财务设置**只向前**生效
> （已入账历史永不改写）。

---

## 5.5 利润表（P&L）

**目的：** 展示企业在某期间赚了还是亏了。

```
REVENUE (income accounts 4000–4900)
   Rent + Services + Utilities + Late fees + Other (incl. POS sales)
− EXPENSES (accounts 5000–5100, operating costs)
− OWNER PAYOUTS  (per contract model)
= NET PROFIT / LOSS
```

- 在 **Finance → Expenses & P&L [M20]** 找到，以及 **Profit & Loss** 报表 [M26]。
- 可**按物业**或**合并**查看。
- 它**读账本**，收银↔账本精确对账（P&L 合计
  按构造与账本合计一致）。
- **本期 vs 上期**对比；配合 **Expense vs budget**
  报表看超支/低于预算的科目。

**简单例子（一个物业、一个月）：**

| | 金额 |
|---|---|
| 租金收入 | 9,000.00 |
| 服务收入 | 450.00 |
| 水电收入 | 800.00 |
| 滞纳金 | 60.00 |
| **收入合计** | **10,310.00** |
| 运营费用 | −2,100.00 |
| 银行手续费 | −40.00 |
| 业主分成（revenue-share 楼宇） | −4,500.00 |
| **净利润** | **3,670.00** |

---

## 5.6 资产负债表

> 🚫 **当前系统未确认为专门的报表界面。**
> 13 张报表中没有 "Balance Sheet" 菜单项。但
> **底层余额全部可用**，在 **Finance → Ledger → Trial balance**
> 用固定科目代码从账本读取。你可以这样从试算平衡
> 读出资产负债表状况：

```
ASSETS
   1100 Cash            + 1200 Bank           (cash position — also a dashboard KPI)
 + 1300 Rent Receivable (money members owe)
= TOTAL ASSETS

LIABILITIES
   2100 Deposit Liability  (deposits held)
 + 2200 Owner Payable      (owners due)
 + 2300 Tax Payable        (tax collected)
= TOTAL LIABILITIES

EQUITY
   3900 Owner Distributions  (debit-balance equity account)
 + retained earnings (revenue 4xxx − expenses 5xxx to date)
= TOTAL EQUITY

Why it balances: every entry posts equal debits and credits, so
TOTAL ASSETS = TOTAL LIABILITIES + TOTAL EQUITY  — always.
The trial balance nets to zero, which is the same statement.
```

- **现金头寸**（1100 + 1200）是仪表板上的实时 **KPI**。
- 仪表板 **Arrears** ≈ 当前未结的 1300 Rent Receivable。
- **Deposit Liability（2100）** 对每份已结租约都应趋近零。

---

## 5.7 业主对账单（M24）— 业主分成

**目的：** 每月告诉每个房东，他们的楼赚了多少、
他们拿到多少。

**计算（白话）：**
1. 从业主房产**实际收到**的钱开始。
2. 按合同模型：
   - **REVENUE_SHARE：** 实收 × 业主**分成 %**（如 60%）。
   - **FIXED_RENT：** 用约定的**月度总租金**。
3. **减去** **管理费**、**过手费用（pass-through）** 和
   **业主承担维修**（从转给业主的工单）。
4. **加/减已审批调整**（留审计）。
5. 结果 = **业主净分成**。

```
Collected rent for owner's units
   × share %   (or fixed master rent)
 − management fee
 − pass-through expenses
 − owner-borne maintenance
 ± audited adjustments
 = NET OWNER PAYOUT
```

**流程：** 生成（每合同+月幂等；遵守付款日）→
`draft → approved → paid`。审批记 DR 3900 / CR 2200；支付记
DR 2200 / CR cash|bank。对账单 **PDF** 自动归档，显示在
业主门户。生成需要 **Accountant+（GLOBAL M24:update）**。

---

## 5.8 要记住的资金处理规则
1. **永不删除**已入账账单、收款、费用或账本分录 — 用 void/refund/reverse。
2. **押金不是收入**，直到扣款合法释放它。
3. **超额支付变成 member credit**，不是收入。
4. **已出账账单不可变** — 用 credit note 更正；仅 Super Admin 可 void（带原因）。
5. **退款需 Accountant+ 审批**，并冲销账本。
6. **财务设置只向前生效** — 改滞纳金/税/计费规则永不改写已入账账单。
7. 数字看起来不对时，**别手改** — 用 **Audit log** 和
   **Ledger journal** 追踪，然后用正规冲销。
