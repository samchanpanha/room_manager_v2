/// UI phrase-table coverage tests.
///
/// The switch-language work translates *authored English* through a phrase
/// table (§lib/locales/ui-*.ts) rather than threading a key per string, so the
/// risk is a label silently falling back to English. These tests pin the
/// guarantee: km/zh stay in parity, and every label the shared vocabulary
/// produces (report titles/columns/sources/summaries, module guide, nav,
/// statuses) actually resolves in both locales.
import { describe, expect, it } from "vitest";
import { LOCALES, UI_PHRASES, tIn, tNavIn, tUiIn } from "@/lib/i18n";
import { lookupPhrase, mergeConflicts, normalizePhrase } from "@/lib/locales/phrase-table";
import { REPORTS } from "@/lib/reports/registry";
import { summaryLabel } from "@/lib/reports/config";
import { DRIVERJS_NOTE, MODULE_GUIDE } from "@/lib/module-guide";
import { NAV } from "@/lib/nav";

const ALT = ["km", "zh"] as const;

/// True when `text` resolves through the phrase table in every locale. Some
/// labels are intentionally identical across languages ("SLA %", "QR"), so this
/// checks coverage (a hit) rather than "the string changed".
const translatedEverywhere = (text: string) => ALT.every((l) => lookupPhrase(l, UI_PHRASES, text) !== null);

describe("phrase table", () => {
  it("merges without cross-file conflicts", () => {
    expect(mergeConflicts).toEqual([]);
  });

  it("keeps km and zh in parity", () => {
    const km = Object.keys(UI_PHRASES.km).sort();
    const zh = Object.keys(UI_PHRASES.zh).sort();
    expect(km).toEqual(zh);
    expect(km.length).toBeGreaterThan(1300);
  });

  it("has a non-empty value for every key", () => {
    for (const locale of ALT) {
      for (const [k, v] of Object.entries(UI_PHRASES[locale])) {
        expect(v.trim().length, `${locale}:${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("passes English through untouched", () => {
    expect(tUiIn("en", "Occupancy %")).toBe("Occupancy %");
    expect(tUiIn("en", "")).toBe("");
  });

  it("falls back to the original text for unknown phrases", () => {
    expect(tUiIn("km", "A member named Sopheara")).toBe("A member named Sopheara");
  });

  it("folds snake_case DB values onto the humanised label", () => {
    // Statuses render as `status.replace("_", " ")` in most places, but raw
    // enum values reach badges too — normalization must catch both.
    expect(tUiIn("km", "in_progress")).toBe(tUiIn("km", "In progress"));
    expect(tUiIn("zh", "partial_paid")).toBe(tUiIn("zh", "Partial paid"));
  });

  it("normalizes curly quotes/dashes so authored copy matches", () => {
    expect(normalizePhrase("“notice” — done")).toBe(normalizePhrase('"notice" - done'));
  });
});

describe("§M26 reports vocabulary translates", () => {
  it("translates every report title", () => {
    for (const r of REPORTS) expect(translatedEverywhere(r.title), r.key).toBe(true);
  });

  it("translates every column label", () => {
    for (const r of REPORTS) {
      for (const c of r.columns) expect(translatedEverywhere(c.label), `${r.key}.${c.key}`).toBe(true);
    }
  });

  it("translates every traceability source line", () => {
    for (const r of REPORTS) expect(translatedEverywhere(r.source), r.key).toBe(true);
  });

  it("translates the category chips and console chrome", () => {
    for (const label of ["OPS", "FIN", "Reports", "Run report", "Export", "Source"]) {
      expect(translatedEverywhere(label), label).toBe(true);
    }
  });

  it("translates every summary label the service can emit", () => {
    const keys = [
      "totalRooms", "occupancyPct", "monthlyRentMinor", "collectionsMinor", "arrearsMinor", "reconciles",
      "slaPct", "open", "netIncomeMinor", "payoutTotalMinor", "cashPositionMinor", "asOf", "month",
      "statements", "leases", "invoices", "staff", "resolved", "sales", "items", "minutes"
    ];
    for (const k of keys) {
      const label = summaryLabel(k);
      expect(label, k).not.toBe(k); // humanised, not camelCase
      expect(translatedEverywhere(label), `${k} → ${label}`).toBe(true);
    }
  });
});

describe("module guide + nav translate", () => {
  it("translates every module name and purpose", () => {
    for (const m of MODULE_GUIDE) {
      expect(translatedEverywhere(m.name), m.key).toBe(true);
      expect(translatedEverywhere(m.purpose), m.key).toBe(true);
    }
  });

  it("translates every pro tip and the Driver.js note", () => {
    for (const m of MODULE_GUIDE) {
      for (const tip of m.tips) expect(translatedEverywhere(tip), `${m.key}: ${tip}`).toBe(true);
    }
    expect(translatedEverywhere(DRIVERJS_NOTE)).toBe(true);
  });

  it("translates every nav group and item label", () => {
    for (const group of NAV) {
      // Group labels are dotted DICT keys (nav.overview), items are English labels.
      expect(tIn("km", group.label), group.label).not.toBe(group.label);
      expect(tIn("zh", group.label), group.label).not.toBe(group.label);
      for (const item of group.items) {
        expect(tNavIn("km", item.label), item.label).not.toBe(item.label);
        expect(tNavIn("zh", item.label), item.label).not.toBe(item.label);
      }
    }
  });
});

describe("resident portal (§M25) vocabulary translates", () => {
  const portal = [
    "Home", "Rent", "Requests", "Docs", "Me", "Resident", "Resident Portal", "My profile",
    "Rent & invoices", "Your tenancy is active", "No rent invoice is due right now.",
    "Pay now →", "View invoices →", "Subtotal", "Tax", "Sign out", "Resident sign-in",
    "Send code", "Maintenance", "Complaints", "Room move", "Move-out", "Raise ticket",
    "File complaint", "Request room move", "Give notice", "No tickets yet.", "No complaints filed."
  ];
  it("covers tab bar, headings and actions", () => {
    for (const p of portal) expect(translatedEverywhere(p), p).toBe(true);
  });

  it("keeps interpolated templates translatable with their placeholder", () => {
    expect(tUiIn("km", "{n}d late").replace("{n}", "3")).toContain("3");
    expect(tUiIn("zh", "Pay {amount} by QR")).toContain("{amount}");
    expect(tUiIn("km", "Your lease is already in notice ({status}).")).toContain("{status}");
  });
});

describe("locale surface", () => {
  it("offers exactly en / km / zh", () => {
    expect(LOCALES).toEqual(["en", "km", "zh"]);
  });
});

describe("action & error vocabulary (§ui-actions / §ui-errors)", () => {
  it("translates the ellipsis dialog triggers used across modules", () => {
    const triggers = [
      "Adjust…", "Approve…", "Assign…", "Close session…", "Comment…", "Complete…",
      "Consume…", "Correct punch…", "Credit note…", "Deduct…", "Fail…", "Generate…",
      "Manual entry…", "New ticket…", "Open session…", "Purchase…", "Record expense…",
      "Refund…", "Reject…", "Request move…", "Resolve…", "Set budget…", "Stocktake…",
      "Terminate…", "Transfer…", "Void…"
    ];
    for (const p of triggers) expect(translatedEverywhere(p), p).toBe(true);
  });

  it("translates the settings save buttons", () => {
    for (const p of ["Save billing", "Save late fees", "Save locale", "Save org",
                     "Save printers", "Save sidebar", "Save templates", "Save units",
                     "Save bot settings", "Save as org default"]) {
      expect(translatedEverywhere(p), p).toBe(true);
    }
  });

  it("translates the `+ New …` creation triggers", () => {
    for (const p of ["+ New property", "+ New role", "+ New user", "+ Add floor",
                     "+ Add contact", "+ Add service", "+ Bulk add rooms", "+ Upload document"]) {
      expect(translatedEverywhere(p), p).toBe(true);
    }
  });

  it("translates room-type and scope option labels", () => {
    for (const p of ["All types", "Standard", "Deluxe", "Studio", "Suite",
                     "Global (all properties)", "Shared (all properties / till)", "Progressive"]) {
      expect(translatedEverywhere(p), p).toBe(true);
    }
  });

  it("translates service-layer validation messages surfaced in toasts", () => {
    const messages = [
      "A void reason is required", "A resolution note is required", "Member not found",
      "Lease not found", "Invoice not found", "This invoice was voided",
      "Allocations exceed the payment amount", "Deposit already settled",
      "Only active leases can request a room move", "Unknown payment method",
      "Transfers stay within one property", "Too many attempts — request a new code"
    ];
    for (const p of messages) expect(translatedEverywhere(p), p).toBe(true);
  });

  it("translates the ledger system account names", () => {
    for (const p of ["Bank", "Rent Receivable", "Deposit Liability", "Owner Payable",
                     "Tax Payable", "Rent Revenue", "Service Revenue", "Utility Revenue",
                     "Late Fee Revenue", "Other Revenue", "Operating Expenses",
                     "Bank Fees", "Owner Distributions"]) {
      expect(translatedEverywhere(p), p).toBe(true);
    }
  });

  it("translates the seeded RBDC role descriptions", () => {
    for (const p of [
      "Owns the money: rent engine, invoices, ledger, statements.",
      "Runs assigned properties: rooms, leases, operations.",
      "Property landlord: read-only on own buildings, statements, tickets.",
      "Tenant/resident: own records only via tenant portal."
    ]) {
      expect(translatedEverywhere(p), p).toBe(true);
    }
  });

  it("leaves record data and field identifiers recognisable", () => {
    // Field-name-shaped messages keep the API identifier verbatim.
    expect(tUiIn("zh", "amountMinor must be a positive integer")).toContain("amountMinor");
    expect(tUiIn("km", "dayOfMonth must be 1–28")).toContain("dayOfMonth");
    // Sample/demo data is never translated.
    expect(tUiIn("zh", "Chan Ling")).toBe("Chan Ling");
    expect(tUiIn("km", "RentManager")).toBe("RentManager");
  });
});
