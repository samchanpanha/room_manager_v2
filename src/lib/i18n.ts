/// i18n — switchable UI languages: English (`en`), Khmer (`km`), Chinese (`zh`).
/// Strings live in per-locale flat dictionaries; translation is a PURE lookup:
///   tIn(locale, key)   — plain keys
///   tfIn(locale, key, vars) — {var} placeholder interpolation
///   tNavIn(locale, label)   — nav/tab labels keyed by their English label
///                             (src/lib/nav.ts stays the source of truth)
///
/// Threading the locale (no module state on the render path — Next renders
/// layouts and pages concurrently, so global "active locale" is racy):
///   • Server components: `const { t } = await getT()` (src/lib/locale-server.ts,
///     React-cached per request).
///   • Client components: `const { t } = useT()` (src/components/i18n-provider.tsx,
///     React context fed from the root layout's resolved locale).
///
/// Locale resolution (src/lib/locale-server.ts):
///   1. `rm-locale` cookie — per-browser choice made in the LanguageSwitcher
///      (header on every screen + standalone on /login).
///   2. Org-wide default — §M28 Settings → Locale → Language (`m28.locale.locale`).
///   3. English.
export const LOCALES = ["en", "km", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "rm-locale";

export interface LocaleMeta {
  code: Locale;
  /// English name (for pickers/aria).
  name: string;
  /// Endonym shown in the switcher.
  native: string;
  /// Value for <html lang>.
  htmlLang: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: "en", name: "English", native: "English", htmlLang: "en" },
  km: { code: "km", name: "Khmer", native: "ខ្មែរ", htmlLang: "km" },
  zh: { code: "zh", name: "Chinese (Simplified)", native: "中文", htmlLang: "zh-CN" }
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/// Any BCP-47-ish tag → supported Locale base ("en-US" → "en"), else null.
export function toLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

const en: Record<string, string> = {
  "app.name": "RentManager",
  "app.tagline": "Rental & co-living operations platform",

  "auth.login.title": "Sign in to RentManager",
  "auth.login.tagline": "Rental & co-living operations platform",
  "auth.login.email": "Email",
  "auth.login.password": "Password",
  "auth.login.submit": "Sign in",
  "auth.login.signingIn": "Signing in…",
  "auth.login.error": "Sign in failed",
  "auth.login.demoTitle": "Demo accounts (seeded, password Demo1234!)",

  "nav.overview": "Overview",
  "nav.portfolio": "Portfolio",
  "nav.billing": "Billing & Collections",
  "nav.finance": "Ledger & Finance",
  "nav.operations": "Operations",
  "nav.comms": "Comms & Portal",
  "nav.insights": "Insights",
  "nav.admin": "Administration",

  "nav.item.Dashboard": "Dashboard",
  "nav.item.Properties": "Properties",
  "nav.item.Members": "Members",
  "nav.item.Owners": "Owners",
  "nav.item.Owner Portal": "Owner Portal",
  "nav.item.Leases": "Leases",
  "nav.item.Rent Engine": "Rent Engine",
  "nav.item.Invoices": "Invoices",
  "nav.item.Payments": "Payments",
  "nav.item.Deposits": "Deposits",
  "nav.item.Utilities": "Utilities",
  "nav.item.Services": "Services",
  "nav.item.Ledger": "Ledger",
  "nav.item.Expenses & P&L": "Expenses & P&L",
  "nav.item.Owner Statements": "Owner Statements",
  "nav.item.Room Moves": "Room Moves",
  "nav.item.Inspections": "Inspections",
  "nav.item.Maintenance": "Maintenance",
  "nav.item.Complaints": "Complaints",
  "nav.item.POS": "POS",
  "nav.item.POS Catalog": "POS Catalog",
  "nav.item.Stock": "Stock",
  "nav.item.Short Stays": "Short Stays",
  "nav.item.Purchase Orders": "Purchase Orders",
  "nav.item.Attendance": "Attendance",
  "nav.item.Tenant Portal": "Tenant Portal",
  "nav.item.Telegram Bot": "Telegram Bot",
  "nav.item.Reports": "Reports",
  "nav.item.Users": "Users",
  "nav.item.Roles & Permissions": "Roles & Permissions",
  "nav.item.Audit Log": "Audit Log",
  "nav.item.Settings": "Settings",
  "nav.item.Security": "Security",

  "shell.search": "Search menu…",
  "shell.searchAria": "Search menu",
  "shell.noResults": "No menu items match “{q}”.",
  "shell.signOut": "Sign out",
  "shell.toggleNav": "Toggle navigation",
  "shell.phaseHint": "Scheduled for Phase {phase}",

  "tabs.close": "Close tab",
  "tabs.closeOthers": "Close other tabs",
  "tabs.closeLeft": "Close tabs to the left",
  "tabs.closeRight": "Close tabs to the right",
  "tabs.closeAll": "Close all tabs",
  "tabs.newDashboard": "New Dashboard tab",
  "tabs.options": "Tab options",
  "tabs.hint": "{n}/{max} tabs · right-click a tab for close options",
  "tabs.middleHint": "{label} — middle-click to close",
  "tabs.closeNamed": "Close {label}",

  "lang.label": "Language",

  // Reports page
  "reports.page.title": "Reports",
  "reports.page.description": "M26 — analytics & exports, filterable by date range + property",
  "reports.page.noAccess": "No reports are currently assigned or enabled for your account.",
  "reports.run": "Run report",
  "reports.source": "Source",
  "reports.noRows": "No rows for this scope/period.",
  "reports.export.csv": "CSV",
  "reports.export.pdf": "PDF",

  // Report picker
  "reports.picker.report": "Report",
  "reports.picker.searchReports": "Search reports…",
  "reports.picker.noReport": "No matching report",
  "reports.picker.month": "Month",
  "reports.picker.from": "From",
  "reports.picker.to": "To",
  "reports.picker.property": "Property",
  "reports.picker.allScope": "All in your scope",
  "reports.picker.searchProperty": "Search property…",
  "reports.picker.noProperty": "No matching property",

  // Report column labels
  "reports.col.property": "Property",
  "reports.col.floor": "Floor",
  "reports.col.type": "Type",
  "reports.col.rooms": "Rooms",
  "reports.col.occupied": "Occupied",
  "reports.col.vacant": "Vacant",
  "reports.col.other": "Res/Clean/Maint",
  "reports.col.occupancyPct": "Occupancy %",
  "reports.col.lease": "Lease",
  "reports.col.member": "Member",
  "reports.col.status": "Status",
  "reports.col.rentMinor": "Monthly rent",
  "reports.col.cycleDay": "Cycle day",
  "reports.col.nextBilling": "Next billing",
  "reports.col.bucket": "Aging bucket",
  "reports.col.invoices": "Invoices",
  "reports.col.amountMinor": "Outstanding",
  "reports.col.invoice": "Invoice",
  "reports.col.daysLate": "Days late",
  "reports.col.dunningStage": "Dunning",
  "reports.col.stage": "Pipeline stage",
  "reports.col.count": "Count",
  "reports.col.detail": "Detail",
  "reports.col.tickets": "Tickets",
  "reports.col.slaBreached": "SLA breached",
  "reports.col.avgAgeDays": "Avg age (d)",
  "reports.col.avgRating": "Avg rating",
  "reports.col.line": "Line",
  "reports.col.amount": "Amount",
  "reports.col.category": "Category",
  "reports.col.budgetMinor": "Budget",
  "reports.col.actualMinor": "Actual",
  "reports.col.varianceMinor": "Variance",
  "reports.col.code": "Statement",
  "reports.col.owner": "Owner",
  "reports.col.month": "Month",
  "reports.col.netMinor": "Net payout",
  "reports.col.paidVia": "Paid via",
  "reports.col.day": "Day",
  "reports.col.sales": "Sales",
  "reports.col.totalMinor": "Total",
  "reports.col.roomChargeMinor": "of room charge",
  "reports.col.item": "Item",
  "reports.col.qty": "Qty",
  "reports.col.unit": "Unit",
  "reports.col.avgCostMinor": "Avg cost/unit",
  "reports.col.valueMinor": "Value",
  "reports.col.staff": "Staff",
  "reports.col.days": "Days worked",
  "reports.col.minutes": "Minutes",
  "reports.col.overtimeMinutes": "Overtime min",
  "reports.col.complaints": "Complaints",

  // Report titles
  "reports.title.occupancy": "Occupancy",
  "reports.title.rent-roll": "Rent roll",
  "reports.title.collections-arrears": "Collections & arrears aging",
  "reports.title.overdue-not-paid": "Overdue & not paid (rent)",
  "reports.title.move-pipeline": "Move-in / move-out pipeline",
  "reports.title.maintenance-kpis": "Maintenance KPIs",
  "reports.title.complaint-kpis": "Complaint KPIs",
  "reports.title.pnl": "Profit & Loss",
  "reports.title.expense-vs-budget": "Expense vs budget",
  "reports.title.owner-statement-history": "Owner statement history",
  "reports.title.pos-sales": "POS sales",
  "reports.title.stock-valuation": "Stock valuation",
  "reports.title.attendance-summary": "Attendance summary",

  // Settings - Reports configuration
  "settings.reports.title": "Reports configuration",
  "settings.reports.description": "Optionally enable selected reports, assign report keys to user IDs, and customize titles. Leave enabled reports empty to show all permitted reports.",
  "settings.reports.enabledKeys": "Enabled report keys (comma-separated)",
  "settings.reports.empty": "empty = all",
  "settings.reports.assignments": "Assignments (JSON: report key → user IDs)",
  "settings.reports.designs": "Designs (JSON: report key → title/description/columns)",
  "settings.reports.save": "Save reports configuration"
};

const km: Record<string, string> = {
  "app.name": "RentManager",
  "app.tagline": "វេទិកាគ្រប់គ្រងការជួល និងអគារសហគមន៍",

  "auth.login.title": "ចូលប្រើ RentManager",
  "auth.login.tagline": "វេទិកាគ្រប់គ្រងការជួល និងអគារសហគមន៍",
  "auth.login.email": "អ៊ីមែល",
  "auth.login.password": "ពាក្យសម្ងាត់",
  "auth.login.submit": "ចូលប្រើ",
  "auth.login.signingIn": "កំពុងចូល…",
  "auth.login.error": "ការចូលបរាជ័យ",
  "auth.login.demoTitle": "គណនីសាកល្បង (ពាក្យសម្ងាត់ Demo1234!)",

  "nav.overview": "ទិដ្ឋភាពទូទៅ",
  "nav.portfolio": "កម្មសិទ្ធិ",
  "nav.billing": "វិក្កយបត្រ និងការប្រមូល",
  "nav.finance": "បញ្ជី និងហិរញ្ញវត្ថុ",
  "nav.operations": "ប្រតិបត្តិការ",
  "nav.comms": "ការទំនាក់ទំនង និងខ្លោងទ្វារ",
  "nav.insights": "ការវិភាគ",
  "nav.admin": "ការគ្រប់គ្រង",

  "nav.item.Dashboard": "ផ្ទាំងគ្រប់គ្រង",
  "nav.item.Properties": "អចលនទ្រព្យ",
  "nav.item.Members": "សមាជិក",
  "nav.item.Owners": "ម្ចាស់អចលនទ្រព្យ",
  "nav.item.Owner Portal": "ខ្លោងទ្វារម្ចាស់",
  "nav.item.Leases": "កិច្ចសន្យាជួល",
  "nav.item.Rent Engine": "ការគណនាថ្លៃជួល",
  "nav.item.Invoices": "វិក្កយបត្រ",
  "nav.item.Payments": "ការទូទាត់",
  "nav.item.Deposits": "ប្រាក់កក់",
  "nav.item.Utilities": "ទឹក និងអគ្គិសនី",
  "nav.item.Services": "សេវាកម្ម",
  "nav.item.Ledger": "បញ្ជីគណនេយ្យ",
  "nav.item.Expenses & P&L": "ចំណាយ និងចំណេញ-ខាត",
  "nav.item.Owner Statements": "របាយការណ៍ម្ចាស់",
  "nav.item.Room Moves": "ការផ្លាស់បន្ទប់",
  "nav.item.Inspections": "ការត្រួតពិនិត្យ",
  "nav.item.Maintenance": "ការជួសជុល",
  "nav.item.Complaints": "ការតវ៉ា",
  "nav.item.POS": "ចំណុចលក់",
  "nav.item.POS Catalog": "កាតាឡុកចំណុចលក់",
  "nav.item.Stock": "ស្តុក",
  "nav.item.Short Stays": "ការសម្រាកខ្លី",
  "nav.item.Purchase Orders": "លិខិតបញ្ជាទិញ",
  "nav.item.Attendance": "ការវត្តមាន",
  "nav.item.Tenant Portal": "ខ្លោងទ្វារអ្នកជួល",
  "nav.item.Telegram Bot": "តេលេក្រាមបូត",
  "nav.item.Reports": "របាយការណ៍",
  "nav.item.Users": "អ្នកប្រើប្រាស់",
  "nav.item.Roles & Permissions": "តួនាទី និងសិទ្ធិ",
  "nav.item.Audit Log": "កំណត់ត្រាត្រួតពិនិត្យ",
  "nav.item.Settings": "ការកំណត់",
  "nav.item.Security": "សុវត្ថិភាព",

  "shell.search": "ស្វែងរកម៉ឺនុយ…",
  "shell.searchAria": "ស្វែងរកម៉ឺនុយ",
  "shell.noResults": "រកមិនឃើញម៉ឺនុយត្រូវនឹង “{q}” ទេ។",
  "shell.signOut": "ចេញក្រៅ",
  "shell.toggleNav": "បើក/បិទម៉ឺនុយ",
  "shell.phaseHint": "កំណត់សម្រាប់ដំណាក់កាល {phase}",

  "tabs.close": "បិទផ្ទាំង",
  "tabs.closeOthers": "បិទផ្ទាំងផ្សេងទៀត",
  "tabs.closeLeft": "បិទផ្ទាំងនៅឆ្វេង",
  "tabs.closeRight": "បិទផ្ទាំងនៅស្តាំ",
  "tabs.closeAll": "បិទផ្ទាំងទាំងអស់",
  "tabs.newDashboard": "ផ្ទាំងគ្រប់គ្រងថ្មី",
  "tabs.options": "ជម្រើសផ្ទាំង",
  "tabs.hint": "ផ្ទាំង {n}/{max} · ចុចស្តាំលើផ្ទាំងដើម្បីបិទ",
  "tabs.middleHint": "{label} — ចុចកណ្តុរកណ្តាលដើម្បីបិទ",
  "tabs.closeNamed": "បិទ {label}",

  "lang.label": "ភាសា",

  // Reports page
  "reports.page.title": "របាយការណ៍",
  "reports.page.description": "M26 — ការវិភាគ និងការនាំចេញ អាចត្រងតាមកាលបរិច្ឆេទ + អចលនទ្រព្យ",
  "reports.page.noAccess": "គ្មានរបាយការណ៍ដែលត្រូវបានចាត់តាំង ឬបើកសម្រាប់គណនីរបស់អ្នកនៅឡើយទេ។",
  "reports.run": "ដំណើរការរបាយការណ៍",
  "reports.source": "ប្រភព",
  "reports.noRows": "គ្មានជួរទេសម្រាប់វិសាលភាព/រយៈពេលនេះ។",
  "reports.export.csv": "CSV",
  "reports.export.pdf": "PDF",

  // Report picker
  "reports.picker.report": "របាយការណ៍",
  "reports.picker.searchReports": "ស្វែងរករបាយការណ៍…",
  "reports.picker.noReport": "គ្មានរបាយការណ៍ត្រូវគ្នា",
  "reports.picker.month": "ខែ",
  "reports.picker.from": "ពី",
  "reports.picker.to": "ដល់",
  "reports.picker.property": "អចលនទ្រព្យ",
  "reports.picker.allScope": "ទាំងអស់ក្នុងវិសាលភាពរបស់អ្នក",
  "reports.picker.searchProperty": "ស្វែងរកអចលនទ្រព្យ…",
  "reports.picker.noProperty": "គ្មានអចលនទ្រព្យត្រូវគ្នា",

  // Report column labels
  "reports.col.property": "អចលនទ្រព្យ",
  "reports.col.floor": "ជាន់",
  "reports.col.type": "ប្រភេទ",
  "reports.col.rooms": "បន្ទប់",
  "reports.col.occupied": "មានអ្នកជួល",
  "reports.col.vacant": "ទំនេរ",
  "reports.col.other": "សល់/សម្អាត/ជួសជុល",
  "reports.col.occupancyPct": "% មានអ្នកជួល",
  "reports.col.lease": "កិច្ចសន្យា",
  "reports.col.member": "សមាជិក",
  "reports.col.status": "ស្ថានភាព",
  "reports.col.rentMinor": "ថ្លៃជួលប្រចាំខែ",
  "reports.col.cycleDay": "ថ្ងៃវដ្ត",
  "reports.col.nextBilling": "ការចេញវិក្កយបត្របន្ទាប់",
  "reports.col.bucket": "កំណាត់អាយុ",
  "reports.col.invoices": "វិក្កយបត្រ",
  "reports.col.amountMinor": "ចំនួនទឹកប្រាក់នៅសល់",
  "reports.col.invoice": "វិក្កយបត្រ",
  "reports.col.daysLate": "ថ្ងៃយឺត",
  "reports.col.dunningStage": "ការតាមទារ",
  "reports.col.stage": "ដំណាក់កាលបំពង់",
  "reports.col.count": "ចំនួន",
  "reports.col.detail": "លម្អិត",
  "reports.col.tickets": "សំបុត្រ",
  "reports.col.slaBreached": "SLA បំពាន",
  "reports.col.avgAgeDays": "អាយុមធ្យម (ថ្ងៃ)",
  "reports.col.avgRating": "ការវាយតម្លៃមធ្យម",
  "reports.col.line": "ជួរ",
  "reports.col.amount": "ចំនួនទឹកប្រាក់",
  "reports.col.category": "ប្រភេទ",
  "reports.col.budgetMinor": "ថវិកា",
  "reports.col.actualMinor": "ជាក់ស្តែង",
  "reports.col.varianceMinor": "ភាពខុសគ្នា",
  "reports.col.code": "របាយការណ៍",
  "reports.col.owner": "ម្ចាស់",
  "reports.col.month": "ខែ",
  "reports.col.netMinor": "ការទូទាត់សុទ្ធ",
  "reports.col.paidVia": "បង់តាម",
  "reports.col.day": "ថ្ងៃ",
  "reports.col.sales": "ការលក់",
  "reports.col.totalMinor": "សរុប",
  "reports.col.roomChargeMinor": "នៃការគិតថ្លៃបន្ទប់",
  "reports.col.item": "ធាតុ",
  "reports.col.qty": "ចំនួន",
  "reports.col.unit": "ឯកតា",
  "reports.col.avgCostMinor": "តម្លៃមធ្យម/ឯកតា",
  "reports.col.valueMinor": "តម្លៃ",
  "reports.col.staff": "បុគ្គលិក",
  "reports.col.days": "ថ្ងៃធ្វើការ",
  "reports.col.minutes": "នាទី",
  "reports.col.overtimeMinutes": "នាទីបន្ថែម",
  "reports.col.complaints": "ការតវ៉ា",

  // Report titles
  "reports.title.occupancy": "អត្រាមានអ្នកជួល",
  "reports.title.rent-roll": "តារាងថ្លៃជួល",
  "reports.title.collections-arrears": "ការប្រមូល និងការយឺតយ៉ាវ",
  "reports.title.overdue-not-paid": "ផុតកំណត់ និងមិនទាន់បង់ (ថ្លៃជួល)",
  "reports.title.move-pipeline": "បំពង់ចូល/ចេញ",
  "reports.title.maintenance-kpis": "សូចនាករការជួសជុល",
  "reports.title.complaint-kpis": "សូចនាករការតវ៉ា",
  "reports.title.pnl": "ចំណេញ និងខាត",
  "reports.title.expense-vs-budget": "ចំណាយធៀបនឹងថវិកា",
  "reports.title.owner-statement-history": "ប្រវត្តិរបាយការណ៍ម្ចាស់",
  "reports.title.pos-sales": "ការលក់ POS",
  "reports.title.stock-valuation": "ការវាយតម្លៃស្តុក",
  "reports.title.attendance-summary": "សង្ខេបការវត្តមាន",

  // Settings - Reports configuration
  "settings.reports.title": "ការកំណត់របាយការណ៍",
  "settings.reports.description": "បើករបាយការណ៍ដែលបានជ្រើសរើស ចាត់តាំងកូនសោរបាយការណ៍ទៅអត្តលេខអ្នកប្រើប្រាស់ និងកែសម្រួលចំណងជើង។ ទុកឱ្យទទេដើម្បីបង្ហាញរបាយការណ៍ដែលអនុញ្ញាតទាំងអស់។",
  "settings.reports.enabledKeys": "កូនសោរបាយការណ៍ដែលបានបើក (คั่นด้วยจุลภาค)",
  "settings.reports.empty": "ទទេ = ទាំងអស់",
  "settings.reports.assignments": "ការចាត់តាំង (JSON: កូនសោរបាយការណ៍ → អត្តលេខអ្នកប្រើប្រាស់)",
  "settings.reports.designs": "ការរចនា (JSON: កូនសោរបាយការណ៍ → ចំណងជើង/ការពិពណ៌នា/ជួរឈរ)",
  "settings.reports.save": "រក្សាទុកការកំណត់របាយការណ៍"
};

const zh: Record<string, string> = {
  "app.name": "RentManager",
  "app.tagline": "租赁与共居运营平台",

  "auth.login.title": "登录 RentManager",
  "auth.login.tagline": "租赁与共居运营平台",
  "auth.login.email": "邮箱",
  "auth.login.password": "密码",
  "auth.login.submit": "登录",
  "auth.login.signingIn": "登录中…",
  "auth.login.error": "登录失败",
  "auth.login.demoTitle": "演示账号（密码 Demo1234！）",

  "nav.overview": "总览",
  "nav.portfolio": "资产组合",
  "nav.billing": "账单与收款",
  "nav.finance": "账本与财务",
  "nav.operations": "运营",
  "nav.comms": "消息与门户",
  "nav.insights": "数据分析",
  "nav.admin": "系统管理",

  "nav.item.Dashboard": "仪表板",
  "nav.item.Properties": "物业",
  "nav.item.Members": "会员",
  "nav.item.Owners": "业主",
  "nav.item.Owner Portal": "业主门户",
  "nav.item.Leases": "租约",
  "nav.item.Rent Engine": "租金引擎",
  "nav.item.Invoices": "账单",
  "nav.item.Payments": "收款",
  "nav.item.Deposits": "押金",
  "nav.item.Utilities": "水电费",
  "nav.item.Services": "服务",
  "nav.item.Ledger": "分类账",
  "nav.item.Expenses & P&L": "支出与损益",
  "nav.item.Owner Statements": "业主对账单",
  "nav.item.Room Moves": "换房",
  "nav.item.Inspections": "检查",
  "nav.item.Maintenance": "维修",
  "nav.item.Complaints": "投诉",
  "nav.item.POS": "收银台",
  "nav.item.POS Catalog": "收银商品目录",
  "nav.item.Stock": "库存",
  "nav.item.Short Stays": "短租",
  "nav.item.Purchase Orders": "采购单",
  "nav.item.Attendance": "考勤",
  "nav.item.Tenant Portal": "租客门户",
  "nav.item.Telegram Bot": "Telegram 机器人",
  "nav.item.Reports": "报表",
  "nav.item.Users": "用户",
  "nav.item.Roles & Permissions": "角色与权限",
  "nav.item.Audit Log": "审计日志",
  "nav.item.Settings": "设置",
  "nav.item.Security": "安全",

  "shell.search": "搜索菜单…",
  "shell.searchAria": "搜索菜单",
  "shell.noResults": "没有匹配“{q}”的菜单项。",
  "shell.signOut": "退出登录",
  "shell.toggleNav": "切换导航",
  "shell.phaseHint": "计划于第 {phase} 阶段推出",

  "tabs.close": "关闭标签页",
  "tabs.closeOthers": "关闭其他标签页",
  "tabs.closeLeft": "关闭左侧标签页",
  "tabs.closeRight": "关闭右侧标签页",
  "tabs.closeAll": "关闭全部标签页",
  "tabs.newDashboard": "新建仪表板标签页",
  "tabs.options": "标签页选项",
  "tabs.hint": "{n}/{max} 个标签页 · 右键点击标签页可关闭",
  "tabs.middleHint": "{label} — 中键点击关闭",
  "tabs.closeNamed": "关闭 {label}",

  "lang.label": "语言",

  // Reports page
  "reports.page.title": "报表",
  "reports.page.description": "M26 — 分析和导出，可按日期范围和物业筛选",
  "reports.page.noAccess": "暂无分配或启用给您的账户的报表。",
  "reports.run": "运行报表",
  "reports.source": "来源",
  "reports.noRows": "此范围/期间无数据行。",
  "reports.export.csv": "CSV",
  "reports.export.pdf": "PDF",

  // Report picker
  "reports.picker.report": "报表",
  "reports.picker.searchReports": "搜索报表…",
  "reports.picker.noReport": "无匹配报表",
  "reports.picker.month": "月份",
  "reports.picker.from": "从",
  "reports.picker.to": "至",
  "reports.picker.property": "物业",
  "reports.picker.allScope": "您范围内的全部",
  "reports.picker.searchProperty": "搜索物业…",
  "reports.picker.noProperty": "无匹配物业",

  // Report column labels
  "reports.col.property": "物业",
  "reports.col.floor": "楼层",
  "reports.col.type": "类型",
  "reports.col.rooms": "房间数",
  "reports.col.occupied": "已入住",
  "reports.col.vacant": "空置",
  "reports.col.other": "预留/清洁/维修",
  "reports.col.occupancyPct": "入住率 %",
  "reports.col.lease": "租约",
  "reports.col.member": "会员",
  "reports.col.status": "状态",
  "reports.col.rentMinor": "月租金",
  "reports.col.cycleDay": "周期日",
  "reports.col.nextBilling": "下次账单",
  "reports.col.bucket": "账龄区间",
  "reports.col.invoices": "发票数",
  "reports.col.amountMinor": "未付金额",
  "reports.col.invoice": "发票",
  "reports.col.daysLate": "逾期天数",
  "reports.col.dunningStage": "催收阶段",
  "reports.col.stage": "流程阶段",
  "reports.col.count": "数量",
  "reports.col.detail": "详情",
  "reports.col.tickets": "工单数",
  "reports.col.slaBreached": "SLA 违规",
  "reports.col.avgAgeDays": "平均天数",
  "reports.col.avgRating": "平均评分",
  "reports.col.line": "项目",
  "reports.col.amount": "金额",
  "reports.col.category": "类别",
  "reports.col.budgetMinor": "预算",
  "reports.col.actualMinor": "实际",
  "reports.col.varianceMinor": "差异",
  "reports.col.code": "对账单",
  "reports.col.owner": "业主",
  "reports.col.month": "月份",
  "reports.col.netMinor": "净付款",
  "reports.col.paidVia": "支付方式",
  "reports.col.day": "日期",
  "reports.col.sales": "销售额",
  "reports.col.totalMinor": "总计",
  "reports.col.roomChargeMinor": "房费部分",
  "reports.col.item": "项目",
  "reports.col.qty": "数量",
  "reports.col.unit": "单位",
  "reports.col.avgCostMinor": "平均成本/单位",
  "reports.col.valueMinor": "价值",
  "reports.col.staff": "员工",
  "reports.col.days": "工作天数",
  "reports.col.minutes": "分钟数",
  "reports.col.overtimeMinutes": "加班分钟",
  "reports.col.complaints": "投诉数",

  // Report titles
  "reports.title.occupancy": "入住率",
  "reports.title.rent-roll": "租金明细表",
  "reports.title.collections-arrears": "收款与欠款账龄",
  "reports.title.overdue-not-paid": "逾期未付（租金）",
  "reports.title.move-pipeline": "入住/搬出流程",
  "reports.title.maintenance-kpis": "维修关键指标",
  "reports.title.complaint-kpis": "投诉关键指标",
  "reports.title.pnl": "损益表",
  "reports.title.expense-vs-budget": "支出与预算对比",
  "reports.title.owner-statement-history": "业主要账单历史",
  "reports.title.pos-sales": "POS 销售",
  "reports.title.stock-valuation": "库存估值",
  "reports.title.attendance-summary": "考勤汇总",

  // Settings - Reports configuration
  "settings.reports.title": "报表配置",
  "settings.reports.description": "可选启用选定报表，将报表键分配给用户 ID，并自定义标题。留空则显示所有允许的报表。",
  "settings.reports.enabledKeys": "已启用的报表键（逗号分隔）",
  "settings.reports.empty": "留空 = 全部",
  "settings.reports.assignments": "分配（JSON：报表键 → 用户 ID）",
  "settings.reports.designs": "设计（JSON：报表键 → 标题/描述/列）",
  "settings.reports.save": "保存报表配置"
};

/// Exported for tests and tooling (dictionary parity checks).
export const DICT: Record<Locale, Record<string, string>> = { en, km, zh };

/// Translate `key` in `locale` → English → the key itself.
export function tIn(locale: Locale, key: string): string {
  return DICT[locale][key] ?? en[key] ?? key;
}

/// `tIn` with {var} placeholder substitution: tfIn(l, "tabs.hint", { n: 2, max: 12 }).
export function tfIn(locale: Locale, key: string, vars: Record<string, string | number>): string {
  let s = tIn(locale, key);
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/// Nav/tab labels are keyed by their English label (src/lib/nav.ts is the
/// source of truth); falls back to the label itself when untranslated.
export function tNavIn(locale: Locale, label: string): string {
  return DICT[locale][`nav.item.${label}`] ?? label;
}

// Common labels used across every module. Page components can pass their English
// labels through this helper without duplicating locale plumbing.
const COMMON_UI: Record<Locale, Record<string, string>> = {
  en: {},
  km: { "Save": "រក្សាទុក", "Cancel": "បោះបង់", "Search": "ស្វែងរក", "Filter": "តម្រង", "Loading…": "កំពុងផ្ទុក…", "No results": "គ្មានលទ្ធផល", "Actions": "សកម្មភាព", "Status": "ស្ថានភាព", "Name": "ឈ្មោះ", "Date": "កាលបរិច្ឆេទ", "Create": "បង្កើត", "Edit": "កែសម្រួល", "Delete": "លុប", "Submit": "ដាក់ស្នើ", "Close": "បិទ", "Back": "ត្រឡប់ក្រោយ" },
  zh: { "Save": "保存", "Cancel": "取消", "Search": "搜索", "Filter": "筛选", "Loading…": "加载中…", "No results": "无结果", "Actions": "操作", "Status": "状态", "Name": "名称", "Date": "日期", "Create": "创建", "Edit": "编辑", "Delete": "删除", "Submit": "提交", "Close": "关闭", "Back": "返回" }
};

export function tUiIn(locale: Locale, text: string): string {
  return COMMON_UI[locale][text] ?? tNavIn(locale, text);
}

/// Client-side switch (LanguageSwitcher): persist the choice in the cookie.
/// Callers then `router.refresh()`; the root layout re-resolves and the new
/// locale flows through the tree as props/context on the next render.
export function applyLocale(locale: string): void {
  if (!isLocale(locale)) return;
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }
}
