import type { PhraseTable } from "./phrase-table";

/// Coverage gaps found by the extraction audit (scripts/extract-strings.mjs →
/// i18n-strings.json cross-checked against the dictionaries): short labels,
/// statuses, empty-state lines and interpolated fragments that no other table
/// owned. Interpolated phrases keep their `{placeholder}` verbatim — callers do
/// `tUi("{n}d late").replace("{n}", "3")`, which is why the key is the literal
/// template.
export const uiExtra: PhraseTable = {
  km: {
    // statuses / chips
    "archived": "បានបញ្ចូលប័ណ្ណសារ",
    "Submitted": "បានដាក់ស្នើ",
    "file": "ឯកសារ",

    // session + shell chrome
    "Sign out": "ចេញពីគណនី",
    "Log out": "ចេញពីគណនី",
    "Language": "ភាសា",
    "Profile": "ប្រវត្តិរូប",
    "Member since": "សមាជិកតាំងពី",
    "Receipts": "បង្កាន់ដៃ",
    "Open session": "បើកវគ្គលក់",
    "None available": "គ្មាន",
    "None staged": "គ្មានការរៀបចំ",

    // approval chips (audit trail)
    "Staff user": "គណនីបុគ្គលិក",
    "Approved expense": "ចំណាយបានអនុម័ត",
    "Pending expense": "ចំណាយរង់ចាំអនុម័ត",
    "Approved statement": "របាយការណ៍បានអនុម័ត",

    // resident-facing fragments
    "Hi": "សួស្តី",
    "no due date": "គ្មានថ្ងៃកំណត់",
    "All invoices →": "វិក្កយបត្រទាំងអស់ →",
    "KYC incomplete": "KYC មិនទាន់ពេញលេញ",
    "open complaints": "បណ្តឹងនៅបើក",
    "due today": "ត្រូវបង់ថ្ងៃនេះ",
    "{n}d late": "យឺត {n} ថ្ងៃ",
    "in {n}d": "ក្នុង {n} ថ្ងៃ",
    "until": "រហូតដល់",
    "expires": "ផុតកំណត់",
    "New request": "សំណើថ្មី",

    // empty states
    "No purchase orders yet.": "មិនទាន់មានបញ្ជាទិញទេ។",
    "No rooms on this floor yet.": "មិនទាន់មានបន្ទប់នៅជាន់នេះទេ។",
    "No postings match the filters.": "គ្មានការចុះបញ្ជីត្រូវនឹងតម្រង។",
    "No payout method on file.": "គ្មានវិធីបើកប្រាក់ក្នុងប័ណ្ណសារ។",
    "No products match — add them under POS Catalog.": "គ្មានផលិតផលត្រូវគ្នា — បន្ថែមនៅក្រោមកាតាឡុក POS។",
    "No unassigned buildings — every building already has an owner.": "គ្មានអគារមិនបានកំណត់ — រាល់អគារមានម្ចាស់រួចហើយ។"
  },
  zh: {
    // statuses / chips
    "archived": "已归档",
    "Submitted": "已提交",
    "file": "文件",

    // session + shell chrome
    "Sign out": "退出登录",
    "Log out": "退出登录",
    "Language": "语言",
    "Profile": "资料",
    "Member since": "入住时间",
    "Receipts": "收据",
    "Open session": "开启班次",
    "None available": "暂无可用",
    "None staged": "暂无待处理",

    // approval chips (audit trail)
    "Staff user": "员工账号",
    "Approved expense": "已批准支出",
    "Pending expense": "待批准支出",
    "Approved statement": "已批准对账单",

    // resident-facing fragments
    "Hi": "您好",
    "no due date": "无到期日",
    "All invoices →": "全部账单 →",
    "KYC incomplete": "KYC 未完成",
    "open complaints": "未结投诉",
    "due today": "今日到期",
    "{n}d late": "逾期 {n} 天",
    "in {n}d": "{n} 天后",
    "until": "至",
    "expires": "到期",
    "New request": "新建请求",

    // empty states
    "No purchase orders yet.": "暂无采购订单。",
    "No rooms on this floor yet.": "此楼层暂无房间。",
    "No postings match the filters.": "没有符合筛选条件的分录。",
    "No payout method on file.": "未记录付款方式。",
    "No products match — add them under POS Catalog.": "没有匹配的商品 — 请在 POS 目录中添加。",
    "No unassigned buildings — every building already has an owner.": "没有未分配的楼栋 — 每栋楼都已有业主。"
  }
};
