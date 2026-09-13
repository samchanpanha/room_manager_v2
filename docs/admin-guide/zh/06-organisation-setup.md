# 6. 组织搭建（黄金顺序）


## 黄金搭建顺序

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
