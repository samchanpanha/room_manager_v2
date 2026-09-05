/// M28 Settings — typed, grouped, audited, forward-only.
/// Non-secret config lives as JSON in `Setting` rows (group keys `m28.*`).
/// Secret-typed values (payment credentials, Telegram bot token) are sealed
/// with AES-256-GCM before storage and only ever leave the server masked
/// (§15 v1.4b); reads fall back to the env var when no DB value is set.
/// Rules (§M28): every change audited; financial-affecting groups require
/// ADMIN (enforced by callers via hasModuleAccess M28:update); changes apply
/// forward-only — posted history is never rewritten.
import { prisma } from "@/lib/db";
import { seal, open, maskSecret } from "@/lib/crypto/sealed";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { isLocale, LOCALES } from "@/lib/i18n";
import { normalizeReportSettings, type ReportDesign, type ReportDesignColumn, type ReportSettings } from "@/lib/reports/config";

export interface ActorRef {
  id?: string | null;
  name: string;
}

interface GroupDefLike {
  key: string;
  defaults: object;
}

export interface OrgSettings {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  logo: string; // base64 data-URL or /storage URL (preview)
  invoiceFooterNote: string;
  /// Invoice PDF layout variant ("classic" | "modern").
  invoiceTemplate: string;
}

export interface PrinterSettings {
  /// Thermal printer width in mm (58 | 80). Drives receipt/label sizing.
  paperWidthMm: number;
  /// Auto-print the receipt (browser) immediately after each POS sale.
  autoPrintReceipt: boolean;
  /// Number of receipt copies to print.
  receiptCopies: number;
  /// Print barcode labels on the label printer when true.
  printBarcodeByDefault: boolean;
}

export interface TelegramBotSettings {
  /// Friendly display name shown to tenants (defaults to the bot username).
  botName: string;
  /// Welcome / help message text on /start.
  welcomeMessage: string;
  /// Whether member self-link codes are enabled for this tenant.
  allowMemberLinking: boolean;
}

export interface LocaleSettings {
  currency: string;
  timezone: string;
  locale: string;
}

export interface BillingSettings {
  invoicePrefix: string;
  graceDays: number;
  dunningDays: number[];
}

export interface LateFeeSettings {
  mode: "none" | "flat" | "percent";
  flatMinor: number;
  monthlyPctBps: number;
  maxMinor: number;
}

export interface RetentionSettings {
  outboxDays: number;
  eventDays: number;
  otpDays: number;
  sessionDays: number;
}

export interface MenuSettings {
  /// Shell sidebar position — "left" (default) or "right".
  side: "left" | "right";
}

/// Stock/POS measurement units offered when creating items & products.
export interface UnitsSettings {
  units: string[];
}

/// §M28 notification templates: per-event overrides for the Telegram notifier.
/// Values support {var} placeholders (code, total, due, receipt, …); events
/// without an override use the code-level default template.
export type TemplateSettings = Record<string, string>;

export const TEMPLATE_EVENTS = [
  "invoice.issued",
  "payment.confirmed",
  "invoice.dunning_reminder",
  "rent.reminder",
  "rent.overdue"
] as const;

export type FeatureFlags = Record<string, boolean>;

/// Optional M26 configuration (§M28 → Reports): develop (`enabledKeys`),
/// assign (`assignments`) and design (`designs`). The shape and its
/// normalization live in src/lib/reports/config.ts so the report console, the
/// API routes and this store agree on one definition. Report DATA is never
/// editable here — numbers stay registry/query backed.
export type { ReportSettings, ReportDesign, ReportDesignColumn };

/// Default page size for list tables (overridable per user session).
export interface TableSettings {
  pageSize: number;
}

/// Rent repayment alert horizons (M33): `aheadDays` = remind N days before
/// the due date, `overdueDays` = flag as overdue N days after it passes.
export interface RentAlertSettings {
  aheadDays: number;
  overdueDays: number;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  M14: true, // POS
  M15: true, // Stock
  M21: true, // Telegram bot
  M29: true // Purchase Orders
};

const ORG: GroupDefLike & { defaults: OrgSettings } = {
  key: "m28.org",
  defaults: {
    name: "RentManager Demo",
    legalName: "RentManager Demo Co., Ltd",
    address: "Phnom Penh, Cambodia",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    logo: "",
    invoiceFooterNote: "Thank you for your tenancy.",
    invoiceTemplate: "classic"
  }
};
const PRINTER: GroupDefLike & { defaults: PrinterSettings } = {
  key: "m28.printer",
  defaults: { paperWidthMm: 80, autoPrintReceipt: false, receiptCopies: 1, printBarcodeByDefault: false }
};
const TELEGRAM_BOT: GroupDefLike & { defaults: TelegramBotSettings } = {
  key: "m28.telegram",
  defaults: { botName: "", welcomeMessage: "", allowMemberLinking: true }
};
const LOCALE: GroupDefLike & { defaults: LocaleSettings } = {
  key: "m28.locale",
  defaults: { currency: "USD", timezone: "Asia/Phnom_Penh", locale: "en" }
};
const BILLING: GroupDefLike & { defaults: BillingSettings } = {
  key: "m28.billing",
  defaults: { invoicePrefix: "", graceDays: 3, dunningDays: [3, 7, 14] }
};
const LATE_FEE: GroupDefLike & { defaults: LateFeeSettings } = {
  key: "m28.lateFee",
  defaults: { mode: "none", flatMinor: 0, monthlyPctBps: 0, maxMinor: 0 }
};
const RETENTION: GroupDefLike & { defaults: RetentionSettings } = {
  key: "m28.retention",
  defaults: { outboxDays: 90, eventDays: 365, otpDays: 7, sessionDays: 30 }
};
const MENU: GroupDefLike & { defaults: MenuSettings } = {
  key: "m28.menu",
  defaults: { side: "left" }
};
const UNITS: GroupDefLike & { defaults: UnitsSettings } = {
  key: "m28.units",
  defaults: { units: ["pcs", "kg", "l", "box", "m", "pack", "bottle", "can", "packet", "dozen", "carton", "case"] }
};
const FEATURES: GroupDefLike & { defaults: FeatureFlags } = { key: "m28.features", defaults: DEFAULT_FEATURE_FLAGS };
const REPORTS: GroupDefLike & { defaults: ReportSettings } = {
  key: "m28.reports",
  defaults: { enabledKeys: [], assignments: {}, designs: {} }
};
const TEMPLATES: GroupDefLike & { defaults: TemplateSettings } = { key: "m28.templates", defaults: {} };
const PROVIDERS: GroupDefLike & { defaults: Record<string, string> } = { key: "m28.providers", defaults: {} };
const TABLE: GroupDefLike & { defaults: TableSettings } = { key: "m28.table", defaults: { pageSize: 25 } };
const RENT_ALERTS: GroupDefLike & { defaults: RentAlertSettings } = { key: "m28.alerts", defaults: { aheadDays: 3, overdueDays: 1 } };

const GROUPS: Record<SettingsGroupName, GroupDefLike> = { org: ORG, locale: LOCALE, billing: BILLING, lateFee: LATE_FEE, retention: RETENTION, features: FEATURES, reports: REPORTS, templates: TEMPLATES, printer: PRINTER, telegram: TELEGRAM_BOT, menu: MENU, units: UNITS, table: TABLE, alerts: RENT_ALERTS };

export type SettingsGroupName = "org" | "locale" | "billing" | "lateFee" | "retention" | "features" | "reports" | "templates" | "printer" | "telegram" | "menu" | "units" | "table" | "alerts";

async function readGroup<T extends object>(def: GroupDefLike): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key: def.key } });
  if (!row) return { ...def.defaults } as T;
  try {
    return { ...def.defaults, ...(JSON.parse(row.value) as object) } as T;
  } catch {
    return { ...def.defaults } as T;
  }
}

async function writeGroup<T extends object>(def: GroupDefLike, value: T, actor: ActorRef, ip: string | null, summary: string): Promise<void> {
  const before = await readGroup(def);
  await prisma.setting.upsert({
    where: { key: def.key },
    create: { key: def.key, value: JSON.stringify(value), updatedBy: actor.id ?? actor.name },
    update: { value: JSON.stringify(value), updatedBy: actor.id ?? actor.name }
  });
  await logAudit({
    actorId: actor.id ?? null,
    actorName: actor.name,
    module: "M28",
    action: "update",
    entityType: "setting",
    entityId: def.key,
    summary,
    before,
    after: value,
    ip
  });
}

/// Audit summary for the reports group — what an auditor needs to see without
/// dumping the whole JSON blob (before/after carry the detail).
function describeReportPatch(next: ReportSettings): string {
  const parts = [
    `develop: ${next.enabledKeys.length === 0 ? "all reports" : next.enabledKeys.join(", ")}`,
    `assign: ${Object.keys(next.assignments).length} report(s)`,
    `design: ${Object.keys(next.designs).length} report(s)`
  ];
  return parts.join(" · ");
}

export async function getSettings(): Promise<{
  org: OrgSettings;
  locale: LocaleSettings;
  billing: BillingSettings;
  lateFee: LateFeeSettings;
  retention: RetentionSettings;
  features: FeatureFlags;
  reports: ReportSettings;
  templates: TemplateSettings;
  printer: PrinterSettings;
  telegram: TelegramBotSettings;
  menu: MenuSettings;
  units: UnitsSettings;
  table: TableSettings;
  rentAlerts: RentAlertSettings;
  providers: { paymentCredentials: { configured: boolean; last4: string | null }; telegramBotToken: { configured: boolean; last4: string | null } };
}> {
  const [org, locale, billing, lateFee, retention, features, reportsRaw, templates, printer, telegram, menu, units, table, rentAlerts, providers] = await Promise.all([
    readGroup<OrgSettings>(ORG),
    readGroup<LocaleSettings>(LOCALE),
    readGroup<BillingSettings>(BILLING),
    readGroup<LateFeeSettings>(LATE_FEE),
    readGroup<RetentionSettings>(RETENTION),
    readGroup<FeatureFlags>(FEATURES),
    readGroup<ReportSettings>(REPORTS),
    readGroup<TemplateSettings>(TEMPLATES),
    readGroup<PrinterSettings>(PRINTER),
    readGroup<TelegramBotSettings>(TELEGRAM_BOT),
    readGroup<MenuSettings>(MENU),
    readGroup<UnitsSettings>(UNITS),
    readGroup<TableSettings>(TABLE),
    readGroup<RentAlertSettings>(RENT_ALERTS),
    readGroup<Record<string, string>>(PROVIDERS)
  ]);
  // Report config is coerced on every read: unknown report/column keys and
  // malformed rows degrade to "no configuration" instead of breaking M26.
  const reports = normalizeReportSettings(reportsRaw);
  return {
    org,
    locale,
    billing,
    lateFee,
    retention,
    features,
    reports,
    templates,
    printer,
    telegram,
    menu,
    units,
    table,
    rentAlerts,
    providers: {
      paymentCredentials: maskSecret(providers.paymentCredentials ?? null),
      telegramBotToken: maskSecret(providers.telegramBotToken ?? null)
    }
  };
}

export async function updateSettings(
  group: SettingsGroupName,
  patch: Record<string, unknown>,
  actor: ActorRef,
  ip: string | null
): Promise<void> {
  const def = GROUPS[group];
  const current = await readGroup<Record<string, unknown>>(def);
  if (group === "templates") {
    const next: TemplateSettings = { ...(current as TemplateSettings) };
    for (const [k, v] of Object.entries(patch)) {
      if (TEMPLATE_EVENTS.includes(k as (typeof TEMPLATE_EVENTS)[number]) && typeof v === "string") {
        if (v.trim().length === 0) delete next[k];
        else next[k] = v.slice(0, 300);
      }
    }
    await writeGroup(def, next, actor, ip, `Notification templates updated (${Object.keys(patch).join(", ") || "none"})`);
    return;
  }
  if (group === "features") {
    const next: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...(current as FeatureFlags), ...(patch as FeatureFlags) };
    for (const k of Object.keys(next)) if (typeof next[k] !== "boolean") delete next[k];
    await writeGroup(def, next, actor, ip, `Feature flags updated (${Object.keys(patch).join(", ") || "none"})`);
    return;
  }
  if (group === "locale" && patch.locale !== undefined && !isLocale(patch.locale)) {
    throw new Error(`Unsupported language — use one of: ${LOCALES.join(", ")}`);
  }
  if (group === "reports") {
    // Only registered report keys/columns survive; everything else is dropped
    // (settings are forward-only and must never break the Reports console).
    const next = normalizeReportSettings({ ...normalizeReportSettings(current), ...patch });
    await writeGroup(def, next, actor, ip, `Reports configuration updated (${describeReportPatch(next)})`);
    return;
  }
  const next = { ...current, ...patch };
  await writeGroup(def, next, actor, ip, `Settings group "${group}" updated (${Object.keys(patch).join(", ")})`);
}

/// Secret-typed provider settings: `m28.providers` holds sealed values only.
export async function setProviderSecret(
  name: "paymentCredentials" | "telegramBotToken",
  plaintext: string,
  actor: ActorRef,
  ip: string | null
): Promise<void> {
  const providers = await readGroup<Record<string, string>>(PROVIDERS);
  const before = { [name]: maskSecret(providers[name] ?? null) };
  providers[name] = seal(plaintext);
  await prisma.setting.upsert({
    where: { key: PROVIDERS.key },
    create: { key: PROVIDERS.key, value: JSON.stringify(providers), updatedBy: actor.id ?? actor.name },
    update: { value: JSON.stringify(providers), updatedBy: actor.id ?? actor.name }
  });
  await logAudit({
    actorId: actor.id ?? null,
    actorName: actor.name,
    module: "M28",
    action: "update",
    entityType: "setting",
    entityId: PROVIDERS.key,
    summary: `Provider secret "${name}" rotated (value sealed, not logged)`,
    before,
    after: { [name]: maskSecret(providers[name]) },
    ip
  });
}

/// Plaintext accessor used by the runtime (Telegram sender, payment provider).
/// DB value (sealed) wins over the env fallback.
export async function getProviderSecret(name: "paymentCredentials" | "telegramBotToken"): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: PROVIDERS.key } });
  if (row) {
    try {
      const providers = JSON.parse(row.value) as Record<string, string>;
      if (providers[name]) {
        const plain = open(providers[name]);
        if (plain !== null) return plain;
      }
    } catch {
      // fall through to env
    }
  }
  if (name === "telegramBotToken") return env.TELEGRAM_BOT_TOKEN;
  if (name === "paymentCredentials") return env.PAYMENT_WEBHOOK_SECRET;
  return null;
}

/// §M28 notification templates: the override for an event with {var}
/// placeholders filled from `vars`, or null when no override is configured.
export async function getTemplateOverride(event: string, vars: Record<string, string | number>): Promise<string | null> {
  const templates = await readGroup<TemplateSettings>(TEMPLATES);
  const tpl = templates[event];
  if (!tpl) return null;
  return tpl.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

export async function isModuleEnabled(moduleKey: string): Promise<boolean> {
  const flags = await readGroup<FeatureFlags>(FEATURES);
  return flags[moduleKey] !== false;
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  return readGroup<FeatureFlags>(FEATURES);
}
