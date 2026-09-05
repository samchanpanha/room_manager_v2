/// M26 optional report configuration — the pure half of "assign, develop and
/// design" (§M28 Settings → Reports).
///
///   develop  → `enabledKeys`: which registered reports the org has switched on.
///              Empty means "every report the caller's role permits" — the
///              configuration is optional by design.
///   assign   → `assignments`: report key → user ids. When a user appears in any
///              assignment they see exactly those reports; users who appear in
///              none see every enabled report their §5 role scope permits.
///   design   → `designs`: per-report presentation overrides (title, description,
///              and an ordered subset of the registry columns with optional label
///              overrides). Report DATA is untouched — numbers still come from the
///              registry queries, so traceability (§M26) is preserved.
///
/// Everything here is pure and DB-free so it can be unit-tested and reused by
/// the page, the JSON route and the CSV/XLSX/PDF export route.
import { REPORT_BY_KEY, type ReportColumn, type ReportDef } from "./registry";

/// The stored shape of §M28 `m28.reports`. Defined here (pure, DB-free) and
/// re-exported by src/lib/settings.ts so the settings store and the report
/// console share one type without an import cycle.
export interface ReportSettings {
  /** develop — empty means "every registered report". */
  enabledKeys: string[];
  /** assign — report key → user ids (absent/empty means unrestricted). */
  assignments: Record<string, string[]>;
  /** design — optional presentation overrides per report. */
  designs: Record<string, ReportDesign>;
}

/// A column inside a stored design: the registry column key plus an optional
/// label override. Legacy settings stored plain `string[]` — accepted on read.
export interface ReportDesignColumn {
  key: string;
  label?: string;
}

export interface ReportDesign {
  title?: string;
  description?: string;
  columns?: ReportDesignColumn[];
}

/// Summary cards are keyed by the builder's camelCase field (`arrearsMinor`).
/// The UI shows a human label instead; `tUi` then translates it.
const SUMMARY_LABELS: Record<string, string> = {
  actualMinor: "Actual",
  amountMinor: "Amount",
  arrearsMinor: "Arrears",
  asOf: "As of",
  avgAgeDays: "Avg age (d)",
  avgCostMinor: "Avg cost/unit",
  avgRating: "Avg rating",
  billedMinor: "Billed",
  bucketsSumMinor: "Buckets sum",
  budgetMinor: "Budget",
  cashPositionMinor: "Cash position",
  collectedMinor: "Collected",
  collectionsMinor: "Collections",
  invoices: "Invoices",
  items: "Items",
  leases: "Leases",
  ledgerCollectionsMinor: "Ledger collections",
  minutes: "Minutes",
  month: "Month",
  monthlyRentMinor: "Monthly rent",
  netIncomeMinor: "Net income",
  netMinor: "Net payout",
  occupancyPct: "Occupancy %",
  oldestInvoiceDaysLate: "Oldest invoice days late",
  open: "Open tickets",
  openTickets: "Open tickets",
  overdueMinor: "Overdue",
  overtimeMinutes: "Overtime min",
  payoutTotalMinor: "Payout total",
  reconciles: "Reconciles",
  resolved: "Resolved",
  sales: "Sales",
  slaBreached: "SLA breached",
  slaPct: "SLA %",
  staff: "Staff",
  statements: "Statements",
  total: "Total",
  totalMinor: "Total",
  totalOccupied: "Total occupied",
  totalRooms: "Total rooms",
  valueMinor: "Value",
  varianceMinor: "Variance"
};

/// camelCase summary key → the English label the UI shows (then `tUi`-able).
export function summaryLabel(key: string): string {
  if (SUMMARY_LABELS[key]) return SUMMARY_LABELS[key];
  const human = key
    .replace(/Minor$/, "")
    .replace(/Pct$/, " %")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
  return human.trim();
}

const isStr = (v: unknown): v is string => typeof v === "string";
const clean = (v: unknown, max: number): string | undefined =>
  isStr(v) && v.trim().length > 0 ? v.trim().slice(0, max) : undefined;

/// Coerce whatever is stored in the `m28.reports` setting row into the current
/// shape: known report keys only, known column keys only, de-duplicated.
/// Unknown keys are dropped rather than throwing — settings are forward-only
/// and a stale row must never break the Reports console.
export function normalizeReportSettings(raw: unknown): ReportSettings {
  const out: ReportSettings = { enabledKeys: [], assignments: {}, designs: {} };
  if (!raw || typeof raw !== "object") return out;
  const value = raw as Partial<Record<keyof ReportSettings, unknown>>;

  if (Array.isArray(value.enabledKeys)) {
    out.enabledKeys = [...new Set(value.enabledKeys.filter((k): k is string => isStr(k) && REPORT_BY_KEY.has(k)))];
  }

  if (value.assignments && typeof value.assignments === "object") {
    for (const [key, ids] of Object.entries(value.assignments as Record<string, unknown>)) {
      if (!REPORT_BY_KEY.has(key) || !Array.isArray(ids)) continue;
      const users = [...new Set(ids.filter((id): id is string => isStr(id) && id.trim().length > 0).map((id) => id.trim()))];
      if (users.length > 0) out.assignments[key] = users;
    }
  }

  if (value.designs && typeof value.designs === "object") {
    for (const [key, design] of Object.entries(value.designs as Record<string, unknown>)) {
      const def = REPORT_BY_KEY.get(key);
      if (!def || !design || typeof design !== "object") continue;
      const d = design as { title?: unknown; description?: unknown; columns?: unknown };
      const next: ReportDesign = {};
      const title = clean(d.title, 120);
      if (title) next.title = title;
      const description = clean(d.description, 500);
      if (description) next.description = description;
      if (Array.isArray(d.columns)) {
        const known = new Set(def.columns.map((c) => c.key));
        const columns: ReportDesignColumn[] = [];
        for (const entry of d.columns) {
          // legacy shape: ["property", "rooms"] · current: [{ key, label }]
          const colKey = isStr(entry) ? entry : isStr((entry as { key?: unknown })?.key) ? ((entry as { key: string }).key) : null;
          if (!colKey || !known.has(colKey) || columns.some((c) => c.key === colKey)) continue;
          const label = isStr(entry) ? undefined : clean((entry as { label?: unknown }).label, 60);
          columns.push(label ? { key: colKey, label } : { key: colKey });
        }
        if (columns.length > 0) next.columns = columns;
      }
      if (Object.keys(next).length > 0) out.designs[key] = next;
    }
  }

  return out;
}

/// "develop": the report keys the org has switched on (empty ⇒ all).
export function enabledReportKeys(settings: ReportSettings): Set<string> | null {
  return settings.enabledKeys.length === 0 ? null : new Set(settings.enabledKeys);
}

/// "assign": the keys explicitly assigned to this user (empty ⇒ unrestricted).
export function assignedReportKeys(settings: ReportSettings, userId: string): Set<string> {
  const assigned = new Set<string>();
  for (const [key, ids] of Object.entries(settings.assignments)) {
    if (ids.includes(userId)) assigned.add(key);
  }
  return assigned;
}

/// Which of the §5-permitted keys may this user actually open, after the
/// optional org configuration is applied.
export function resolveReportKeys(permittedKeys: string[], settings: ReportSettings, userId: string): string[] {
  const enabled = enabledReportKeys(settings);
  const assigned = assignedReportKeys(settings, userId);
  return permittedKeys.filter((key) => {
    if (enabled && !enabled.has(key)) return false;
    if (assigned.size > 0 && !assigned.has(key)) return false;
    return true;
  });
}

export interface DesignedReport {
  def: ReportDef;
  /// Design override, else the registry title.
  title: string;
  /// Optional design description (shown under the picker/source line).
  description: string;
  /// Registry columns projected + ordered + relabelled by the design.
  columns: ReportColumn[];
  /// The traceability source line — never overridable (§M26 acceptance).
  source: string;
  designed: boolean;
}

/// Apply the optional design to a registry definition. Columns keep their
/// `numeric` flag and order follows the design; unknown keys are ignored.
export function designReport(def: ReportDef, design?: ReportDesign): DesignedReport {
  const columns: ReportColumn[] = design?.columns?.length
    ? design.columns
        .map((c) => def.columns.find((rc) => rc.key === c.key))
        .filter((c): c is ReportColumn => Boolean(c))
        .map((c) => {
          const override = design?.columns?.find((dc) => dc.key === c.key)?.label;
          return override ? { ...c, label: override } : c;
        })
    : def.columns;
  return {
    def,
    // A design must never blank the report out: fall back to the registry.
    title: design?.title?.trim() ? design.title.trim() : def.title,
    description: design?.description?.trim() ?? "",
    columns: columns.length > 0 ? columns : def.columns,
    source: def.source,
    designed: Boolean(design && (design.title || design.description || design.columns?.length))
  };
}

/// Project a report result (rows + columns + title) through its design, so the
/// page, CSV/XLSX and PDF all export exactly what the operator configured.
export function applyReportDesign<T extends { key: string; title: string; source: string; columns: ReportColumn[]; rows: Record<string, unknown>[] }>(
  result: T,
  design?: ReportDesign
): T {
  const def = REPORT_BY_KEY.get(result.key);
  if (!def) return result;
  const designed = designReport(def, design);
  const keys = new Set(designed.columns.map((c) => c.key));
  return {
    ...result,
    title: designed.title,
    columns: designed.columns,
    rows: result.rows.map((row) => {
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) if (keys.has(k)) next[k] = v;
      return next;
    }) as T["rows"]
  };
}
