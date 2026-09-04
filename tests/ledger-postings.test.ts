import { describe, expect, it } from "vitest";
import {
  allocateProportional,
  assertBalanced,
  creditNoteLines,
  invoiceIssueLines,
  lateFeeLines,
  reversalLines,
  type PostingLine
} from "@/lib/ledger/postings";
import { ACC } from "@/lib/ledger/accounts";

describe("allocateProportional", () => {
  it("splits exactly when divisible", () => {
    expect(allocateProportional(1000, [500, 500])).toEqual([500, 500]);
  });

  it("distributes the rounding residual one unit at a time, largest weights first", () => {
    // 100 across thirds: 33/33/33 + 1 residual → first index of the (tied) largest
    expect(allocateProportional(100, [1, 1, 1])).toEqual([34, 33, 33]);
    // negative residual spreads across the two largest: 3,3,3,3 + (−2) → [2,2,3,3]
    expect(allocateProportional(10, [1, 1, 1, 1])).toEqual([2, 2, 3, 3]);
  });

  it("handles discount proration on an invoice-shaped split", () => {
    // rent 26500 + service 1500, discount 1000 → 946.4→946 and 53.6→54
    expect(allocateProportional(1000, [26500, 1500])).toEqual([946, 54]);
  });

  it("zero/empty weights yield zeros (never NaN)", () => {
    expect(allocateProportional(100, [])).toEqual([]);
    expect(allocateProportional(100, [0, 0])).toEqual([0, 0]);
  });
});

describe("invoiceIssueLines", () => {
  it("posts DR receivable / CR revenue by kind, balanced with the §9.4 total", () => {
    const lines = invoiceIssueLines({
      totalMinor: 28000,
      discountMinor: 0,
      taxMinor: 0,
      items: [
        { kind: "rent", amountMinor: 26500 },
        { kind: "service", amountMinor: 1500 }
      ]
    });
    expect(lines).toEqual([
      { code: ACC.RENT_RECEIVABLE, debit: 28000, credit: 0 },
      { code: ACC.RENT_REVENUE, debit: 0, credit: 26500 },
      { code: ACC.SERVICE_REVENUE, debit: 0, credit: 1500 }
    ]);
    assertBalanced(lines); // does not throw
  });

  it("prorates the invoice-level discount across revenue kinds", () => {
    const lines = invoiceIssueLines({
      totalMinor: 27000,
      discountMinor: 1000,
      taxMinor: 0,
      items: [
        { kind: "rent", amountMinor: 26500 },
        { kind: "service", amountMinor: 1500 }
      ]
    });
    const rent = lines.find((l) => l.code === ACC.RENT_REVENUE);
    const svc = lines.find((l) => l.code === ACC.SERVICE_REVENUE);
    expect(rent?.credit).toBe(25554); // 26500 − 946
    expect(svc?.credit).toBe(1446); // 1500 − 54
    const credits = lines.reduce((s, l) => s + l.credit, 0);
    expect(credits).toBe(27000); // = invoice total
    assertBalanced(lines);
  });

  it("books tax to the 2300 liability, merging same-kind items", () => {
    const lines = invoiceIssueLines({
      totalMinor: 2200,
      discountMinor: 0,
      taxMinor: 200,
      items: [
        { kind: "utility", amountMinor: 1200 },
        { kind: "utility", amountMinor: 800 }
      ]
    });
    expect(lines).toEqual([
      { code: ACC.RENT_RECEIVABLE, debit: 2200, credit: 0 },
      { code: ACC.UTILITY_REVENUE, debit: 0, credit: 2000 },
      { code: ACC.TAX_PAYABLE, debit: 0, credit: 200, memo: "Output tax" }
    ]);
    assertBalanced(lines);
  });

  it("maps late_fee and one_time kinds; throws on negative items or zero totals", () => {
    const lines = invoiceIssueLines({ totalMinor: 500, discountMinor: 0, taxMinor: 0, items: [{ kind: "late_fee", amountMinor: 500 }] });
    expect(lines[1].code).toBe(ACC.LATE_FEE_REVENUE);
    const ot = invoiceIssueLines({ totalMinor: 700, discountMinor: 0, taxMinor: 0, items: [{ kind: "one_time", amountMinor: 700 }] });
    expect(ot[1].code).toBe(ACC.OTHER_REVENUE);

    expect(() => invoiceIssueLines({ totalMinor: 0, discountMinor: 0, taxMinor: 0, items: [] })).toThrowError(/positive/);
    expect(() => invoiceIssueLines({ totalMinor: 100, discountMinor: 0, taxMinor: 0, items: [{ kind: "rent", amountMinor: -5 }] })).toThrowError(/negative/);
  });
});

describe("lateFeeLines / creditNoteLines / reversalLines", () => {
  it("late fee is DR receivable / CR late-fee revenue", () => {
    const lines = lateFeeLines(500, "BLR-2026-0001");
    expect(lines).toEqual([
      { code: ACC.RENT_RECEIVABLE, debit: 500, credit: 0 },
      { code: ACC.LATE_FEE_REVENUE, debit: 0, credit: 500, memo: "Late fee on BLR-2026-0001" }
    ]);
  });

  it("credit note allocates pro-rata across the original revenue lines and credits receivable", () => {
    const original = [
      { code: ACC.RENT_REVENUE, credit: 13710 },
      { code: ACC.LATE_FEE_REVENUE, credit: 500 },
      { code: ACC.SERVICE_REVENUE, credit: 823 }
    ];
    const lines = creditNoteLines(original, 15033);
    const byCode = new Map(lines.map((l) => [l.code, l]));
    expect(byCode.get(ACC.RENT_RECEIVABLE)).toMatchObject({ debit: 0, credit: 15033 });
    expect(byCode.get(ACC.RENT_REVENUE)?.debit).toBe(13710); // exact split, no rounding drift
    expect(byCode.get(ACC.LATE_FEE_REVENUE)?.debit).toBe(500);
    expect(byCode.get(ACC.SERVICE_REVENUE)?.debit).toBe(823);
    assertBalanced(lines);
  });

  it("credit note falls back to Other Revenue without an original posting", () => {
    const lines = creditNoteLines([], 1000);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ code: ACC.OTHER_REVENUE, debit: 1000, credit: 0 });
    expect(lines[1]).toMatchObject({ code: ACC.RENT_RECEIVABLE, debit: 0, credit: 1000 });
  });

  it("reversals mirror every line", () => {
    const original: PostingLine[] = [
      { code: ACC.RENT_RECEIVABLE, debit: 1000, credit: 0 },
      { code: ACC.RENT_REVENUE, debit: 0, credit: 1000, memo: "Rent" }
    ];
    const mirrored = reversalLines(original);
    expect(mirrored).toEqual([
      { code: ACC.RENT_RECEIVABLE, debit: 0, credit: 1000 },
      { code: ACC.RENT_REVENUE, debit: 1000, credit: 0, memo: "Rent" }
    ]);
    assertBalanced(mirrored);
  });
});

describe("assertBalanced", () => {
  const dr = (code: string, amount: number): PostingLine => ({ code, debit: amount, credit: 0 });
  const cr = (code: string, amount: number): PostingLine => ({ code, debit: 0, credit: amount });

  it("accepts a proper balanced posting", () => {
    expect(() => assertBalanced([dr("1300", 100), cr("4000", 100)])).not.toThrow();
  });

  it("rejects unbalanced, single-sided, two-sided, zero and negative lines", () => {
    expect(() => assertBalanced([dr("1300", 100), cr("4000", 99)])).toThrowError(/Σ debits/);
    expect(() => assertBalanced([dr("1300", 100)])).toThrowError(/at least/);
    expect(() => assertBalanced([dr("1300", 0), cr("4000", 0)])).toThrowError(/exactly one/); // zero lines are single-sided violations
    expect(() => assertBalanced([{ code: "1300", debit: 50, credit: 50 }, cr("4000", 100)])).toThrowError(/exactly one/);
    expect(() => assertBalanced([dr("1300", -100), cr("4000", -100)])).toThrowError(/invalid line/);
  });
});
