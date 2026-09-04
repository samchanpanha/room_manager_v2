/**
 * Phase 13 operations — pure rules (no DB): M18 inspection scoring/finding
 * extraction, M19 ticket machine + SLA targets + cost math, M22 complaint
 * machine + SLA + rating validation.
 */
import { describe, expect, it } from "vitest";

import {
  canInspectionTransition,
  findingsFromItems,
  parseTemplateSections,
  scoreItems,
  templateToItems,
  type CapturedItem
} from "@/lib/operations/inspections-machine";
import {
  canComplaintTransition,
  canTicketTransition,
  complaintSlaDueAt,
  isValidRating,
  TICKET_SLA_HOURS,
  ticketSlaDueAt,
  totalCostMinor
} from "@/lib/operations/maintenance-machine";

describe("M18 inspection machine", () => {
  it("draft → completed/cancelled only; completed and cancelled are terminal", () => {
    expect(canInspectionTransition("draft", "completed")).toBe(true);
    expect(canInspectionTransition("draft", "cancelled")).toBe(true);
    expect(canInspectionTransition("completed", "draft")).toBe(false);
    expect(canInspectionTransition("cancelled", "completed")).toBe(false);
    expect(canInspectionTransition("draft", "draft")).toBe(false);
  });

  const items: CapturedItem[] = [
    { section: "Doors", item: "Door locks", result: "pass" },
    { section: "Doors", item: "Peephole intact", result: "pass" },
    { section: "Walls", item: "No holes", result: "fail", severity: "major", note: "hole behind door" },
    { section: "Electrical", item: "Lights work", result: "na" },
    { section: "Safety", item: "Detector works", result: "fail" } // severity defaults to minor
  ];

  it("score counts only applicable (non-NA) items", () => {
    const s = scoreItems(items);
    expect(s.passCount).toBe(2);
    expect(s.failCount).toBe(2);
    expect(s.naCount).toBe(1);
    expect(s.applicable).toBe(4);
    expect(s.overallScore).toBe(50);
  });

  it("all-NA checklist scores a perfect 100", () => {
    expect(scoreItems([{ section: "x", item: "y", result: "na" }]).overallScore).toBe(100);
  });

  it("every failed item becomes a finding with severity (default minor)", () => {
    const f = findingsFromItems(items);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ itemLabel: "No holes", severity: "major", note: "hole behind door" });
    expect(f[1]).toMatchObject({ itemLabel: "Detector works", severity: "minor" });
    expect(f[1].note).toContain("Failed during inspection");
  });

  it("parses template sections JSON and flattens to default capture items", () => {
    const sections = parseTemplateSections([{ title: "Doors", items: ["Locks", "Peephole"] }, { title: "Walls", items: ["No holes"] }, "junk"]);
    expect(sections).toHaveLength(2);
    const items = templateToItems(sections);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.result === "pass")).toBe(true);
    expect(parseTemplateSections("not-json")).toEqual([]);
  });
});

describe("M19 ticket machine + SLA", () => {
  it("follows open → assigned → in_progress → resolved → verified/closed", () => {
    expect(canTicketTransition("open", "assigned")).toBe(true);
    expect(canTicketTransition("open", "in_progress")).toBe(false);
    expect(canTicketTransition("assigned", "in_progress")).toBe(true);
    expect(canTicketTransition("in_progress", "resolved")).toBe(true);
    expect(canTicketTransition("resolved", "verified")).toBe(true);
    expect(canTicketTransition("resolved", "closed")).toBe(true);
    expect(canTicketTransition("verified", "closed")).toBe(true);
    expect(canTicketTransition("verified", "resolved")).toBe(false);
    expect(canTicketTransition("in_progress", "assigned")).toBe(false);
    expect(canTicketTransition("closed", "open")).toBe(false);
    expect(canTicketTransition("open", "cancelled")).toBe(true);
    expect(canTicketTransition("in_progress", "cancelled")).toBe(false);
  });

  it("SLA hours: urgent 4, high 24, medium 72, low 168", () => {
    expect(TICKET_SLA_HOURS).toEqual({ urgent: 4, high: 24, medium: 72, low: 168 });
    const created = new Date("2026-09-05T10:00:00.000Z");
    expect(ticketSlaDueAt("urgent", created)!.toISOString()).toBe("2026-09-05T14:00:00.000Z");
    expect(ticketSlaDueAt("medium", created)!.toISOString()).toBe("2026-09-08T10:00:00.000Z");
    expect(ticketSlaDueAt("catastrophic", created)).toBeNull();
  });

  it("cost totals sum labor + materials in minor units", () => {
    expect(totalCostMinor([
      { kind: "labor", label: "2h technician", amountMinor: 5000 },
      { kind: "material", label: "valve", amountMinor: 2500 },
      { kind: "material", label: "seals", amountMinor: 350 }
    ])).toBe(7850);
    expect(totalCostMinor([])).toBe(0);
  });
});

describe("M22 complaint machine + SLA + rating", () => {
  it("new → acknowledged → in_progress|resolved → closed; no skips", () => {
    expect(canComplaintTransition("new", "acknowledged")).toBe(true);
    expect(canComplaintTransition("new", "in_progress")).toBe(false);
    expect(canComplaintTransition("acknowledged", "resolved")).toBe(true);
    expect(canComplaintTransition("acknowledged", "in_progress")).toBe(true);
    expect(canComplaintTransition("in_progress", "resolved")).toBe(true);
    expect(canComplaintTransition("resolved", "closed")).toBe(true);
    expect(canComplaintTransition("closed", "new")).toBe(false);
    expect(canComplaintTransition("resolved", "in_progress")).toBe(false);
  });

  it("SLA hours: high 24, medium 72, low 168; unknown priority rejected", () => {
    const created = new Date("2026-09-05T10:00:00.000Z");
    expect(complaintSlaDueAt("high", created)!.toISOString()).toBe("2026-09-06T10:00:00.000Z");
    expect(complaintSlaDueAt("low", created)!.toISOString()).toBe("2026-09-12T10:00:00.000Z");
    expect(complaintSlaDueAt("urgent", created)).toBeNull(); // not a complaint priority
  });

  it("rating must be an integer 1..5", () => {
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(4.5)).toBe(false);
  });
});
