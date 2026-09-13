# 1. 什么是 RentManager

> **适用人群：** 安装、配置、保障安全并维护 RentManager 的超级管理员、
> 管理员、IT 人员与企业主。
> **日常工作人员**（前台、收银、经理）请改从应用内 **Help & Guide**
> （`/guide`）或 [`docs/manual/`](../manual/README.md) 入门。
>
> 配套文档：
> [`DEPLOY_MAC.md`](../DEPLOY_MAC.md) · [`DEPLOY_WINDOWS.md`](../DEPLOY_WINDOWS.md) ·
> [`BACKUP.md`](../BACKUP.md) · [`SECURITY.md`](../SECURITY.md) ·
> [`manual/08-administrator-guide.md`](../manual/08-administrator-guide.md)（RBDC 参考）

---



## 关键设计事实

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
| 事实来源 | [`INTENT.md`](../../INTENT.md) + 代码 + `prisma/schema.prisma`。应用内指南只描述真实存在的功能。 |

---
