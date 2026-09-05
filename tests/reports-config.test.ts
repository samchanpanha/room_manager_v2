/// Pure tests for §M26 optional report configuration (develop · assign · design).
/// No Prisma, no request scope — the engine in src/lib/reports/config.ts is
/// DB-free by design so its semantics are pinned here.
import { describe, expect, it } from "vitest";
import { REPORTS, REPORT_BY_KEY } from "@/lib/reports/registry";
import {
  applyReportDesign,
  assignedReportKeys,
  designReport,
  enabledReportKeys,
  normalizeReportSettings,
  resolveReportKeys,
  summaryLabel,
  type ReportSettings
} from "@/lib/reports/config";

const EMPTY: ReportSettings = { enabledKeys: [], assignments: {}, designs: {} };
const permitted = REPORTS.map((r) => r.key);
const occupancy = REPORT_BY_KEY.get("occupancy")!;

describe("normalizeReportSettings", () => {
  it("treats missing/garbage rows as no configuration", () => {
    expect(normalizeReportSettings(undefined)).toEqual(EMPTY);
    expect(normalizeReportSettings(null)).toEqual(EMPTY);
    expect(normalizeReportSettings("nope")).toEqual(EMPTY);
    expect(normalizeReportSettings({ enabledKeys: "all", assignments: [], designs: 7 })).toEqual(EMPTY);
  });

  it("drops unknown report keys and de-duplicates", () => {
    const out = normalizeReportSettings({ enabledKeys: ["occupancy", "occupancy", "not-a-report"] });
    expect(out.enabledKeys).toEqual(["occupancy"]);
    expect(out.assignments).toEqual({});
  });

  it("drops unknown column keys inside a design", () => {
    const out = normalizeReportSettings({ designs: { occupancy: { columns: [{ key: "property" }, { key: "nope" }, { key: "property" }] } } });
    expect(out.designs.occupancy?.columns).toEqual([{ key: "property" }]);
  });

  it("accepts the legacy string[] column shape", () => {
    const out = normalizeReportSettings({ designs: { occupancy: { title: "  Rooms today  ", columns: ["property", "rooms"] } } });
    expect(out.designs.occupancy).toEqual({ title: "Rooms today", columns: [{ key: "property" }, { key: "rooms" }] });
  });

  it("ignores empty assignments and empty designs", () => {
    const out = normalizeReportSettings({ assignments: { occupancy: [] }, designs: { "rent-roll": {} } });
    expect(out.assignments).toEqual({});
    expect(out.designs).toEqual({});
  });
});

describe("develop — enabledReportKeys", () => {
  it("empty list means every report", () => {
    expect(enabledReportKeys(EMPTY)).toBeNull();
    expect(resolveReportKeys(permitted, EMPTY, "u1")).toEqual(permitted);
  });

  it("a non-empty list narrows the console", () => {
    const settings = normalizeReportSettings({ enabledKeys: ["occupancy", "rent-roll"] });
    expect(resolveReportKeys(permitted, settings, "u1")).toEqual(["occupancy", "rent-roll"]);
  });

  it("never widens beyond the §5 role grant", () => {
    const settings = normalizeReportSettings({ enabledKeys: ["pnl"] });
    expect(resolveReportKeys(["occupancy"], settings, "u1")).toEqual([]);
  });
});

describe("assign — per-user allowlist", () => {
  const settings = normalizeReportSettings({
    assignments: { occupancy: ["u1", "u2"], "rent-roll": ["u2"] }
  });

  it("lists exactly the reports naming this user", () => {
    expect([...assignedReportKeys(settings, "u2")].sort()).toEqual(["occupancy", "rent-roll"]);
    expect([...assignedReportKeys(settings, "u1")]).toEqual(["occupancy"]);
  });

  it("an assigned user sees only their reports", () => {
    expect(resolveReportKeys(permitted, settings, "u1")).toEqual(["occupancy"]);
  });

  it("a user in no assignment sees every enabled report", () => {
    expect(resolveReportKeys(permitted, settings, "u3")).toEqual(permitted);
  });

  it("develop and assign combine (AND)", () => {
    const both = normalizeReportSettings({ enabledKeys: ["rent-roll"], assignments: { occupancy: ["u1"], "rent-roll": ["u1"] } });
    expect(resolveReportKeys(permitted, both, "u1")).toEqual(["rent-roll"]);
  });
});

describe("design — presentation only", () => {
  it("falls back to the registry definition with designed=false", () => {
    const d = designReport(occupancy, undefined);
    expect(d.title).toBe(occupancy.title);
    expect(d.source).toBe(occupancy.source);
    expect(d.columns).toEqual(occupancy.columns);
    expect(d.designed).toBe(false);
  });

  it("overrides title/description, reorders and relabels columns", () => {
    const settings = normalizeReportSettings({
      designs: {
        occupancy: {
          title: "Live rooms",
          description: "Front-desk snapshot",
          columns: [
            { key: "occupancyPct", label: "Filled" },
            { key: "property" }
          ]
        }
      }
    });
    const d = designReport(occupancy, settings.designs.occupancy);
    expect(d.title).toBe("Live rooms");
    expect(d.description).toBe("Front-desk snapshot");
    expect(d.designed).toBe(true);
    expect(d.columns.map((c) => c.key)).toEqual(["occupancyPct", "property"]);
    expect(d.columns[0]).toEqual({ key: "occupancyPct", label: "Filled", numeric: true });
    // label override absent ⇒ registry label
    expect(d.columns[1]!.label).toBe("Property");
    // traceability line is never overridable
    expect(d.source).toBe(occupancy.source);
  });

  it("a design selecting nothing falls back to the full column list", () => {
    expect(designReport(occupancy, { columns: [] }).columns).toEqual(occupancy.columns);
    expect(designReport(occupancy, { columns: [{ key: "ghost" }] }).columns).toEqual(occupancy.columns);
  });

  it("projects rows to the designed columns (screen + CSV/XLSX parity)", () => {
    const result = {
      key: "occupancy",
      title: occupancy.title,
      source: occupancy.source,
      columns: occupancy.columns,
      rows: [{ property: "A", floor: 1, rooms: 10, occupied: 7 }],
      summary: { totalRooms: 10, occupancyPct: 70 }
    };
    const designed = applyReportDesign(result, { title: "Live rooms", columns: [{ key: "property" }, { key: "occupied" }] });
    expect(designed.title).toBe("Live rooms");
    expect(designed.columns.map((c) => c.key)).toEqual(["property", "occupied"]);
    expect(designed.rows).toEqual([{ property: "A", occupied: 7 }]);
    // data itself is untouched — only presentation
    expect(designed.summary).toEqual(result.summary);
  });

  it("returns the result unchanged for an unknown report key", () => {
    const weird = { key: "ghost", title: "T", source: "S", columns: [], rows: [{ a: 1 }] };
    expect(applyReportDesign(weird, { title: "X" })).toBe(weird);
  });
});

describe("summaryLabel", () => {
  it("maps known camelCase builder keys to English labels", () => {
    expect(summaryLabel("totalRooms")).toBe("Total rooms");
    expect(summaryLabel("monthlyRentMinor")).toBe("Monthly rent");
    expect(summaryLabel("occupancyPct")).toBe("Occupancy %");
    // `open` is intentionally "Open tickets" — bare "Open" is a status label
    expect(summaryLabel("open")).toBe("Open tickets");
  });

  it("humanizes unknown keys instead of showing camelCase", () => {
    expect(summaryLabel("someNewTotalMinor")).toBe("Some New Total");
    expect(summaryLabel("slaPct")).toBe("SLA %");
  });

  it("every registry-adjacent label stays phrase-table friendly (no trailing spaces)", () => {
    for (const key of ["totalRooms", "arrearsMinor", "avgAgeDays", "netIncomeMinor", "unknownKeyXyz"]) {
      expect(summaryLabel(key)).toBe(summaryLabel(key).trim());
    }
  });
});
