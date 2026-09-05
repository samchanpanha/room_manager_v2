import type { PhraseTable } from "./phrase-table";

/// Long-form prose: the empty-state sentences rendered inside `<TableCell
/// colSpan>` rows, the "how this module behaves" notes on detail pages and the
/// read-only banners. Keyed by the authored (whitespace-collapsed) JSX text —
/// `normalizePhrase` folds entities, dashes and underscores, so the source can
/// keep `&apos;`/`—`/`moved_out` as written.
///
/// Deliberately EXCLUDED: src/lib/leases/contract-pdf.tsx clauses. The PDF
/// renderer ships Helvetica, which has no Khmer or Chinese glyphs — a localized
/// contract would come out as boxes, so legal prose stays English by design.
export const uiProse: PhraseTable = {
  km: {
    "No punches this month yet — clock in via the kiosk above.": "មិនទាន់មានការចុចវេនក្នុងខែនេះទេ — សូមចុចវេនតាមកូសខាងលើ។",
    "No complaints yet — members file from the portal; staff can log one on their behalf.":
      "មិនទាន់មានបណ្តឹងទេ — សមាជិកដាក់តាមខ្លោងទ្វារ; បុគ្គលិកអាចកត់ត្រាជំនួសបាន។",
    "Open the overdue-not-paid report →": "បើករបាយការណ៍ផុតកំណត់មិនទាន់បង់ →",
    "No deposits yet — deposits are billed automatically when a lease with deposit terms is activated.":
      "មិនទាន់មានប្រាក់កក់ទេ — ប្រាក់កក់ត្រូវគិតប្រាក់ស្វ័យប្រវត្តិពេលកិច្ចសន្យាមានលក្ខខណ្ឌកក់ត្រូវបានធ្វើឱ្យសកម្ម។",
    "No expense postings this month.": "មិនមានការចុះបញ្ជីចំណាយក្នុងខែនេះទេ។",
    "No budgets or spend this month.": "មិនមានថវិកា ឬការចំណាយក្នុងខែនេះទេ។",
    "Approval above the threshold is Accountant+ (GLOBAL M20:update, mirroring the deposit-refund gate). Approval posts DR category-account / CR cash|bank with refType `expense`; voids reverse the posting — the P&L reads the ledger, so register and ledger always reconcile exactly.":
      "ការអនុម័តលើសកម្រិតកំណត់ត្រូវការគណនេយ្យិកឡើងទៅ (GLOBAL M20:update ដូចច្រកសងប្រាក់កក់)។ ការអនុម័តចុះបញ្ជី DR គណនីប្រភេទចំណាយ / CR សាច់ប្រាក់|ធនាគារ ជាមួយ refType `expense`; ការលុបចោលធ្វើបញ្ជីបញ្ច្រាស — P&L អានពីបញ្ជីគណនា ដូច្នេះសៀវភៅកត់ត្រា និងបញ្ជីគណនាផ្ទៀងផ្ទាត់ត្រូវគ្នាជានិច្ច។",
    "No inspections yet — open one for an active lease (move-in, move-out or periodic).":
      "មិនទាន់មានការត្រួតពិនិត្យទេ — បើកមួយសម្រាប់កិច្ចសន្យាសកម្ម (ចូល ចេញ ឬតាមកាលកំណត់)។",
    "No invoices yet — run the generation job (top right) to bill all active leases.":
      "មិនទាន់មានវិក្កយបត្រទេ — ដំណើរការការបង្កើត (ខាងលើស្តាំ) ដើម្បីគិតប្រាក់គ្រប់កិច្ចសន្យាសកម្ម។",
    "Effects: activation → room occupied, member active, first invoice scheduled (generation job ships in Phase 6) · ending → room cleaning (when last lease in room), member moved_out, deposit settlement triggered (M10 acts from Phase 9) · termination clearance/inspection gates tighten as those modules land.":
      "លទ្ធផល៖ ធ្វើឱ្យសកម្ម → បន្ទប់មានអ្នកស្នាក់ សមាជិកសកម្ម វិក្កយបត្រដំបូងត្រូវបានកំណត់ (ការបង្កើតមកនៅដំណាក់កាល ៦) · បញ្ចប់ → បន្ទប់ត្រូវសម្អាត (ពេលកិច្ចសន្យាចុងក្រោយក្នុងបន្ទប់) សមាជិកផ្លាស់ចេញ ការដោះស្រាយប្រាក់កក់ចាប់ផ្តើម (M10 ដំណើរការពីដំណាក់កាល ៩) · ការបញ្ចប់កិច្ចសន្យាមានលក្ខខណ្ឌត្រួតពិនិត្យតឹងជាងមុននៅពេលម៉ូឌុលទាំងនោះមកដល់។",
    "No leases yet — create the first one.": "មិនទាន់មានកិច្ចសន្យាទេ — បង្កើតមួយដំបូង។",
    "No postings yet — issue an invoice to see the books move.": "មិនទាន់មានការចុះបញ្ជីទេ — ចេញវិក្កយបត្រដើម្បីឃើញបញ្ជីគណនាផ្លាស់ប្តូរ។",
    "No tickets yet — members raise them from the portal, staff can log one on their behalf.":
      "មិនទាន់មានសំបុត្រការងារទេ — សមាជិកលើកឡើងតាមខ្លោងទ្វារ បុគ្គលិកអាចកត់ត្រាជំនួសបាន។",
    "Lifecycle: prospect → verified needs a complete KYC checklist; verified → active requires an active lease (Phase 5); blacklist blocks every transition. Room capacity is enforced at lease time.":
      "វដ្តជីវិត៖ prospect → verified ត្រូវការបញ្ជី KYC ពេញលេញ; verified → active ត្រូវការកិច្ចសន្យាសកម្ម (ដំណាក់កាល ៥); blacklist ទប់ស្កាត់រាល់ការផ្លាស់ប្តូរ។ ចំនួនអ្នកស្នាក់ក្នុងបន្ទប់ត្រូវបានកំណត់ពេលធ្វើកិច្ចសន្យា។",
    "Every ledger posting on this member&apos;s account, oldest first · receivable balance runs on 1300 Rent Receivable · corrections appear as reversals":
      "រាល់ការចុះបញ្ជីលើគណនីសមាជិកនេះ ចាប់ពីចាស់បំផុត · សមតុល្យត្រូវបង់ដំណើរការលើគណនី 1300 Rent Receivable · ការកែត្រូវបង្ហាញជាការចុះបញ្ជីបញ្ច្រាស",
    "No ledger activity for this member yet.": "មិនទាន់មានសកម្មភាពបញ្ជីគណនាសម្រាប់សមាជិកនេះទេ។",
    "No room moves yet — request one for an active lease (member portal or staff).":
      "មិនទាន់មានការផ្លាស់បន្ទប់ទេ — ស្នើមួយសម្រាប់កិច្ចសន្យាសកម្ម (ខ្លោងទ្វារសមាជិក ឬបុគ្គលិក)។",
    "Rules: a building links to exactly one owner (the contract terms arrive with M05 owner contracts in Phase 5). Account numbers are masked in lists; every payout-method change is audited.":
      "ច្បាប់៖ អគារមួយភ្ជាប់នឹងម្ចាស់តែមួយគត់ (លក្ខខណ្ឌកិច្ចសន្យាមកជាមួយ M05 ក្នុងដំណាក់កាល ៥)។ លេខគណនីត្រូវបានបិទបាំងក្នុងបញ្ជី; រាល់ការប្តូរវិធីបើកប្រាក់ត្រូវបានកត់ត្រាសវនកម្ម។",
    "Not allocated — the full amount is member credit (refundable by an Accountant).":
      "មិនបានបែងចែក — ចំនួនទាំងអស់ជាឥណទានសមាជិក (គណនេយ្យិកអាចសងវិញ)។",
    "No payments yet — record one (top right) or wait for portal/QR payments.":
      "មិនទាន់មានការទូទាត់ទេ — កត់ត្រាមួយ (ខាងលើស្តាំ) ឬរង់ចាំការទូទាត់តាមខ្លោងទ្វារ/QR។",
    "No sales yet — open a session and ring one up.": "មិនទាន់មានការលក់ទេ — បើកវគ្គលក់ ហើយកត់ត្រាមួយ។",
    "No products yet — add one from the button above.": "មិនទាន់មានផលិតផលទេ — បន្ថែមមួយតាមប៊ូតុងខាងលើ។",
    "No plans in the catalog — leases use their snapshotted terms.": "គ្មានគម្រោងក្នុងកាតាឡុក — កិច្ចសន្យាប្រើលក្ខខណ្ឌដែលបានរក្សាទុក។",
    "No assignments — assign a catalog service to an active lease (WiFi / parking bind real resources).":
      "គ្មានការកំណត់ — កំណត់សេវាក្នុងកាតាឡុកទៅកិច្ចសន្យាសកម្ម (WiFi / ចំណតរថយន្តភ្ជាប់ធនធានពិត)។",
    "Read-only view — your role holds M28:read. Financial and org changes require Admin.":
      "ទិដ្ឋភាពអានតែប៉ុណ្ណោះ — តួនាទីរបស់អ្នកមាន M28:read។ ការប្តូរហិរញ្ញវត្ថុ និងស្ថាប័នត្រូវការ Admin។",
    "No statements yet — run the generation job for a month.": "មិនទាន់មានរបាយការណ៍ទេ — ដំណើរការការបង្កើតសម្រាប់មួយខែ។",
    "No categories yet — create one to organise items & till products.": "មិនទាន់មានប្រភេទទេ — បង្កើតមួយដើម្បីរៀបចំទំនិញ និងផលិតផលលក់។",
    "No charges yet — charges appear from the second reading on (baseline first).":
      "មិនទាន់មានការគិតប្រាក់ទេ — ការគិតប្រាក់បង្ហាញចាប់ពីការអានលើកទីពីរ (លើកដំបូងជាមូលដ្ឋាន)។",
    "No meters yet — register a meter on a room to start recording readings.":
      "មិនទាន់មានម៉ែត្រទេ — ចុះបញ្ជីម៉ែត្រលើបន្ទប់ដើម្បីចាប់ផ្តើមកត់ត្រាការអាន។",
    "No tariffs configured — readings are stored but produce no charges until a tariff exists.":
      "មិនទាន់បានកំណត់តារាងតម្លៃ — ការអានត្រូវបានរក្សាទុក ប៉ុន្តែមិនគិតប្រាក់ទេរហូតដល់មានតារាងតម្លៃ។"
  },
  zh: {
    "No punches this month yet — clock in via the kiosk above.": "本月暂无打卡记录 — 请通过上方考勤机打卡。",
    "No complaints yet — members file from the portal; staff can log one on their behalf.": "暂无投诉 — 住户通过门户提交；员工可代为记录。",
    "Open the overdue-not-paid report →": "打开逾期未付报表 →",
    "No deposits yet — deposits are billed automatically when a lease with deposit terms is activated.": "暂无押金 — 含押金条款的租约激活后会自动开票。",
    "No expense postings this month.": "本月无支出分录。",
    "No budgets or spend this month.": "本月无预算或支出。",
    "Approval above the threshold is Accountant+ (GLOBAL M20:update, mirroring the deposit-refund gate). Approval posts DR category-account / CR cash|bank with refType `expense`; voids reverse the posting — the P&L reads the ledger, so register and ledger always reconcile exactly.":
      "超过阈值的审批需要会计及以上（GLOBAL M20:update，与押金退款一致）。审批过账为 DR 类别科目 / CR 现金|银行，refType `expense`；作废生成反向分录 — 损益表读取总账，因此登记表与总账始终完全一致。",
    "No inspections yet — open one for an active lease (move-in, move-out or periodic).": "暂无检查 — 为有效租约开启一次（入住、退房或定期检查）。",
    "No invoices yet — run the generation job (top right) to bill all active leases.": "暂无账单 — 运行生成任务（右上角）为所有有效租约开票。",
    "Effects: activation → room occupied, member active, first invoice scheduled (generation job ships in Phase 6) · ending → room cleaning (when last lease in room), member moved_out, deposit settlement triggered (M10 acts from Phase 9) · termination clearance/inspection gates tighten as those modules land.":
      "影响：激活 → 房间变为已入住、住户生效、首期账单排期（生成任务在第 6 阶段上线）· 结束 → 房间清洁（当房间内最后一份租约）、住户迁出、触发押金结算（M10 自第 9 阶段生效）· 终止的清账/检查门槛会随相关模块上线而收紧。",
    "No leases yet — create the first one.": "暂无租约 — 创建第一份。",
    "No postings yet — issue an invoice to see the books move.": "暂无分录 — 开具账单即可看到账簿变动。",
    "No tickets yet — members raise them from the portal, staff can log one on their behalf.": "暂无工单 — 住户通过门户提交，员工可代为记录。",
    "Lifecycle: prospect → verified needs a complete KYC checklist; verified → active requires an active lease (Phase 5); blacklist blocks every transition. Room capacity is enforced at lease time.":
      "生命周期：prospect → verified 需要完整的 KYC 清单；verified → active 需要有效租约（第 5 阶段）；blacklist 阻止所有状态流转。房间容量在签约时校验。",
    "Every ledger posting on this member&apos;s account, oldest first · receivable balance runs on 1300 Rent Receivable · corrections appear as reversals":
      "该住户账户的全部总账分录，按时间正序 · 应收余额走 1300 Rent Receivable 科目 · 更正以反向分录体现",
    "No ledger activity for this member yet.": "该住户暂无总账活动。",
    "No room moves yet — request one for an active lease (member portal or staff).": "暂无换房 — 为有效租约发起申请（住户门户或员工）。",
    "Rules: a building links to exactly one owner (the contract terms arrive with M05 owner contracts in Phase 5). Account numbers are masked in lists; every payout-method change is audited.":
      "规则：一栋楼只能关联一位业主（合同条款随第 5 阶段的 M05 业主合同提供）。列表中账号已脱敏；每次付款方式变更均有审计记录。",
    "Not allocated — the full amount is member credit (refundable by an Accountant).": "未分配 — 全额作为住户预存款（可由会计退款）。",
    "No payments yet — record one (top right) or wait for portal/QR payments.": "暂无收款 — 记录一笔（右上角）或等待门户/二维码收款。",
    "No sales yet — open a session and ring one up.": "暂无销售 — 开启班次并录入一笔。",
    "No products yet — add one from the button above.": "暂无商品 — 通过上方按钮添加。",
    "No plans in the catalog — leases use their snapshotted terms.": "目录中没有方案 — 租约使用其快照条款。",
    "No assignments — assign a catalog service to an active lease (WiFi / parking bind real resources).": "暂无分配 — 为有效租约分配目录服务（WiFi / 车位绑定真实资源）。",
    "Read-only view — your role holds M28:read. Financial and org changes require Admin.": "只读视图 — 您的角色仅有 M28:read。财务与机构变更需要 Admin。",
    "No statements yet — run the generation job for a month.": "暂无对账单 — 为某个月运行生成任务。",
    "No categories yet — create one to organise items & till products.": "暂无分类 — 创建一个以整理物料与收银商品。",
    "No charges yet — charges appear from the second reading on (baseline first).": "暂无费用 — 从第二次抄表开始计费（首次为基线）。",
    "No meters yet — register a meter on a room to start recording readings.": "暂无仪表 — 为房间登记仪表以开始记录读数。",
    "No tariffs configured — readings are stored but produce no charges until a tariff exists.": "未配置费率 — 读数会保存，但在有费率之前不产生费用。"
  }
};
