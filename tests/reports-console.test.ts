/// §M26 Reports console guarantees (TDD):
///   1. the OPTIONAL org configuration (develop · assign · design) only ever
///      narrows/stylises — it never changes report data;
///   2. a design projects columns while preserving the registry column flags,
///      row field values, the summary and the traceability source;
///   3. the configuration chrome shown on the Reports console translates in
///      km/zh (every label the caller can actually read must switch language).
import { describe, expect, it } from "vitest";
import { REPORTS, REPORT_BY_KEY } from "@/lib/reports/registry";
import {
  applyReportDesign,
  designReport,
  normalizeReportSettings,
  resolveReportKeys,
  type ReportSettings
} from "@/lib/reports/config";
import { UI_PHRASES, tUiIn } from "@/lib/i18n";

const occupancy = REPORT_BY_KEY.get("occupancy")!;
const permitted = REPORTS.map((r) => r.key);
const EMPTY: ReportSettings = { enabledKeys: [], assignments: {}, designs: {} };

function sampleResult() {
  return {
    key: occupancy.key,
    title: occupancy.title,
    source: occupancy.source,
    columns: occupancy.columns,
    rows: [
      { property: "Riverside A", floor: 1, rooms: 12, occupied: 9, occupancyPct: 75 },
      { property: "Riverside B", floor: 2, rooms: 8, occupied: 8, occupancyPct: 100 }
    ],
    summary: { totalRooms: 20, totalOccupied: 17, occupancyPct: 85 }
  };
}

describe("a stored design preserves structure and data", () => {
  it("no design ⇒ the screen shows the registry result untouched", () => {
    const result = sampleResult();
    expect(applyReportDesign(result, undefined)).toEqual(result);
  });

  it("design projection keeps the numeric flag on relabelled columns", () => {
    const designed = designReport(occupancy, { columns: [{ key: "occupancyPct", label: "Filled %" }] });
    expect(designed.columns[0]).toEqual({ key: "occupancyPct", label: "Filled %", numeric: true });
  });

  it("row field values and the summary survive the projection unchanged", () => {
    const result = sampleResult();
    const designed = applyReportDesign(result, { columns: [{ key: "property" }, { key: "occupancyPct" }] });
    expect(designed.rows).toEqual([
      { property: "Riverside A", occupancyPct: 75 },
      { property: "Riverside B", occupancyPct: 100 }
    ]);
    expect(designed.summary).toEqual(result.summary);
    expect(designed.source).toBe(result.source);
    // registry columns only set `numeric` on money/percent columns
    expect(designed.columns.map((c) => Boolean(c.numeric))).toEqual([false, true]);
    expect(designed.columns.find((c) => c.key === "occupancyPct")!.numeric).toBe(true);
  });

  it("applyReportDesign never mutates its input result", () => {
    const result = sampleResult();
    const before = structuredClone(result);
    applyReportDesign(result, { title: "Live rooms", columns: [{ key: "property" }] });
    expect(result).toEqual(before);
  });

  it("a design can never blank the report title", () => {
    expect(designReport(occupancy, { title: "   " }).title).toBe(occupancy.title);
    expect(designReport(occupancy, { title: "Live", description: "" }).title).toBe("Live");
  });
});

describe("the console narrows by scope then optional config, never a design", () => {
  it("empty optional config exposes every §5-permitted report", () => {
    expect(resolveReportKeys(permitted, EMPTY, "u1")).toEqual(permitted);
  });

  it("designs gate nothing — visibility follows develop/assign only", () => {
    const settings = normalizeReportSettings({ designs: { occupancy: { title: "X" } } });
    expect(resolveReportKeys(permitted, settings, "u1")).toEqual(permitted);
  });

  it("normalizeReportSettings is idempotent (round-trip stable)", () => {
    const raw = {
      enabledKeys: ["occupancy", "occupancy", "rent-roll", "ghost"],
      assignments: { "rent-roll": ["u1", "u1", "u2"], ghost: ["u1"] },
      designs: {
        occupancy: { title: "Live", columns: ["property", "rooms", "rooms"] },
        "rent-roll": { description: "", columns: [{ key: "unit", label: "Unit #" }] }
      }
    };
    const once = normalizeReportSettings(raw);
    expect(normalizeReportSettings(once)).toEqual(once);
  });
});

describe("reports-account configuration chrome translates in km/zh", () => {
  const chrome = [
    "Report configuration",
    "Hide report configuration",
    "Optional per-report configuration — which reports are switched on, who may open them and how they are styled (also in Settings → Reports)."
  ];
  it("every console entry point resolves in both locales", () => {
    for (const label of chrome) {
      expect(UI_PHRASES.km[label], label).toBeTruthy();
      // authored UI copy must actually translate, not fall back to English
      expect(tUiIn("km", label), label).not.toBe(label);
      expect(tUiIn("zh", label), label).not.toBe(label);
    }
  });

  it("enum menu labels (also on this screen) stay translated too", () => {
    for (const label of ["Develop", "Assign", "Design", "Saved", "Unsaved changes"]) {
      expect(tUiIn("km", label), label).not.toBe(label);
      expect(tUiIn("zh", label), label).not.toBe(label);
    }
  });
});