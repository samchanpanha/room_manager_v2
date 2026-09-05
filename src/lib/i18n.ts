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
import { lookupPhrase, mergePhrases, type PhraseTable } from "@/lib/locales/phrase-table";
import { uiColumns } from "@/lib/locales/ui-columns";
import { uiCommon } from "@/lib/locales/ui-common";
import { uiFields } from "@/lib/locales/ui-fields";
import { uiGuide } from "@/lib/locales/ui-guide";
import { uiLabels } from "@/lib/locales/ui-labels";
import { uiMessages } from "@/lib/locales/ui-messages";
import { uiPages } from "@/lib/locales/ui-pages";
import { uiExtra } from "@/lib/locales/ui-extra";
import { uiPortal } from "@/lib/locales/ui-portal";
import { uiProse } from "@/lib/locales/ui-prose";
import { uiReports } from "@/lib/locales/ui-reports";
import { uiStatus } from "@/lib/locales/ui-status";

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

  "table.showing": "Showing {from}–{to} of {total} row{s}",
  "table.rows": "Rows",
  "table.rowsPerPage": "Rows per page",
  "table.prev": "‹ Prev",
  "table.next": "Next ›",
  "select.noMatches": "No matches",

  "settings.langOverridden": "overridden for this browser (org default: {lang})",
  "settings.language.intro": "English, Khmer (ខ្មែរ) and Chinese (中文) are available on every module screen — menus, page titles, table columns, field labels, statuses, buttons and exports. The org default applies to new browsers; each visitor can override it with the 🌐 switcher in the header, or here."
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
  "nav.item.Rent Engine": "ម៉ាស៊ីនគណនាថ្លៃជួល",
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
  "nav.item.Short Stays": "ការស្នាក់ខ្លី",
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

  "table.showing": "បង្ហាញ {from}–{to} ក្នុងចំណោម {total} ជួរ",
  "table.rows": "ជួរ",
  "table.rowsPerPage": "ជួរក្នុងមួយទំព័រ",
  "table.prev": "‹ មុន",
  "table.next": "បន្ទាប់ ›",
  "select.noMatches": "រកមិនឃើញ",

  "settings.langOverridden": "បានប្តូរសម្រាប់កម្មវិធីរុករកនេះ (លំនាំដើមស្ថាប័ន៖ {lang})",
  "settings.language.intro": "ភាសាអង់គ្លេស ខ្មែរ និងចិន មាននៅគ្រប់អេក្រង់ម៉ូឌុល — ម៉ឺនុយ ចំណងជើងទំព័រ ជួរឈរតារាង ស្លាកវាល ស្ថានភាព ប៊ូតុង និងឯកសារនាំចេញ។ លំនាំដើមស្ថាប័នអនុវត្តសម្រាប់កម្មវិធីរុករកថ្មី; អ្នកប្រើម្នាក់ៗអាចប្តូរតាមប៊ូតុង 🌐 ក្នុងបារខាងលើ ឬនៅទីនេះ។"
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

  "table.showing": "显示第 {from}–{to} 条，共 {total} 行",
  "table.rows": "行数",
  "table.rowsPerPage": "每页行数",
  "table.prev": "‹ 上一页",
  "table.next": "下一页 ›",
  "select.noMatches": "无匹配项",

  "settings.langOverridden": "已在此浏览器中覆盖（机构默认：{lang}）",
  "settings.language.intro": "所有模块页面均支持英语、高棉语（ខ្មែរ）和中文（中文）— 菜单、页面标题、表格列、字段标签、状态、按钮与导出文件。机构默认语言适用于新浏览器；每位访问者可以通过顶栏的 🌐 切换器或此处覆盖。"
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

/// UI phrase tables — the English text of every label, column header, button,
/// badge/status, field, page title, hint and toast in the app, mapped per
/// locale (src/lib/locales/ui-*.ts). `tUiIn` is an exact-match lookup, so the
/// shared UI primitives can translate whatever a page hands them without the
/// page knowing anything about locales — see src/components/i18n-text.tsx.
export const UI_PHRASES: PhraseTable = mergePhrases(
  uiColumns,
  uiCommon,
  uiFields,
  uiStatus,
  uiPages,
  uiMessages,
  uiExtra,
  uiPortal,
  uiProse,
  uiReports,
  uiGuide,
  uiLabels
);

/// Translate an authored English UI string into `locale`.
/// Falls back to the nav label table, then to the original English text, so an
/// untranslated phrase degrades to today's behaviour instead of a key.
export function tUiIn(locale: Locale, text: string): string {
  if (locale === "en") return text;
  if (typeof text !== "string" || text.length === 0) return text;
  return lookupPhrase(locale, UI_PHRASES, text) ?? tNavIn(locale, text);
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
