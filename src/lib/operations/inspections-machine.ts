/// M18 Inspections — pure rules: types, statuses, checklist scoring and
/// finding extraction. DB work lives in inspections-service.ts.
export const INSPECTION_TYPES = ["move_in", "move_out", "periodic"] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const INSPECTION_STATUSES = ["draft", "completed", "cancelled"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  draft: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

export function canInspectionTransition(from: string, to: string): boolean {
  if (!(INSPECTION_STATUSES as readonly string[]).includes(from)) return false;
  if (!(INSPECTION_STATUSES as readonly string[]).includes(to)) return false;
  return INSPECTION_TRANSITIONS[from as InspectionStatus].includes(to as InspectionStatus);
}

export type ItemResult = "pass" | "fail" | "na";
export const ITEM_RESULTS: ItemResult[] = ["pass", "fail", "na"];
export const FINDING_SEVERITIES = ["minor", "major", "critical"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface CapturedItem {
  section: string;
  item: string;
  result: ItemResult;
  severity?: FindingSeverity; // fails only (default minor)
  note?: string;
  photoDocId?: string;
}

export interface ScoredChecklist {
  overallScore: number; // 0..100 — share of non-NA items that passed
  passCount: number;
  failCount: number;
  naCount: number;
  applicable: number;
}

export function isItemResult(v: string): v is ItemResult {
  return (ITEM_RESULTS as string[]).includes(v);
}

export function isFindingSeverity(v: string): v is FindingSeverity {
  return (FINDING_SEVERITIES as readonly string[]).includes(v);
}

/// Score = round(100 × passes / (pass + fail)) — NA items don't count.
export function scoreItems(items: CapturedItem[]): ScoredChecklist {
  const passCount = items.filter((i) => i.result === "pass").length;
  const failCount = items.filter((i) => i.result === "fail").length;
  const naCount = items.filter((i) => i.result === "na").length;
  const applicable = passCount + failCount;
  const overallScore = applicable === 0 ? 100 : Math.round((100 * passCount) / applicable);
  return { overallScore, passCount, failCount, naCount, applicable };
}

export interface FindingDraft {
  itemLabel: string;
  severity: FindingSeverity;
  note: string;
  photoDocId?: string;
}

/// Every failed item becomes a finding (severity defaults to minor).
export function findingsFromItems(items: CapturedItem[]): FindingDraft[] {
  return items
    .filter((i) => i.result === "fail")
    .map((i) => ({
      itemLabel: i.item,
      severity: i.severity ?? "minor",
      note: i.note?.trim() ? i.note.trim() : `Failed during inspection: ${i.item}`,
      photoDocId: i.photoDocId
    }));
}

export const DEDUCTION_STATUSES = ["proposed", "approved", "dismissed"] as const;
export type DeductionStatus = (typeof DEDUCTION_STATUSES)[number];

/// Template sections JSON shape: [{ title, items: string[] }]
export interface TemplateSection {
  title: string;
  items: string[];
}

export function parseTemplateSections(value: unknown): TemplateSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is TemplateSection => !!s && typeof s === "object" && Array.isArray((s as TemplateSection).items))
    .map((s) => ({ title: String(s.title ?? ""), items: s.items.map(String) }));
}

/// Flatten a template into captured-item defaults (all "pass" until edited).
export function templateToItems(sections: TemplateSection[]): CapturedItem[] {
  return sections.flatMap((s) => s.items.map((item) => ({ section: s.title, item, result: "pass" as ItemResult })));
}
