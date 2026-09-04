import { describe, expect, it } from "vitest";
import { canPaymentTransition, PAYMENT_TRANSITIONS, settlementAccountCode } from "@/lib/payments/machines";
import { allocateOldestFirst, validateExplicitAllocations, type OpenInvoice } from "@/lib/payments/allocation";

// ── machine ──────────────────────────────────────────────────────────────────

describe("payment state machine", () => {
  it("pending → confirmed|failed; confirmed → refunded; refunded & failed terminal", () => {
    expect(canPaymentTransition("pending", "confirmed")).toBe(true);
    expect(canPaymentTransition("pending", "failed")).toBe(true);
    expect(canPaymentTransition("confirmed", "refunded")).toBe(true);
    expect(canPaymentTransition("pending", "refunded")).toBe(false);
    expect(canPaymentTransition("refunded", "confirmed")).toBe(false);
    expect(canPaymentTransition("failed", "confirmed")).toBe(false);
    expect(PAYMENT_TRANSITIONS.refunded).toEqual([]);
    expect(PAYMENT_TRANSITIONS.failed).toEqual([]);
  });

  it("routes methods to the right settlement account", () => {
    expect(settlementAccountCode("cash")).toBe("1100");
    expect(settlementAccountCode("cheque")).toBe("1100");
    expect(settlementAccountCode("bank_transfer")).toBe("1200");
    expect(settlementAccountCode("qr")).toBe("1200");
    expect(settlementAccountCode("card")).toBe("1200");
  });
});

// ── allocation math (§9.5) ───────────────────────────────────────────────────

const inv = (id: string, dueMinor: number, day: number): OpenInvoice => ({
  id,
  dueMinor,
  dueDate: new Date(Date.UTC(2026, 8, day)),
  periodStart: new Date(Date.UTC(2026, 8, day))
});

describe("allocateOldestFirst", () => {
  it("pays the oldest invoice first, then spills into the next", () => {
    const { allocations, remainderMinor } = allocateOldestFirst([inv("a", 14533, 1), inv("b", 26500, 15)], 15000);
    expect(allocations).toEqual([
      { invoiceId: "a", amountMinor: 14533 },
      { invoiceId: "b", amountMinor: 467 }
    ]);
    expect(remainderMinor).toBe(0);
  });

  it("caps at each invoice's outstanding due", () => {
    const { allocations, remainderMinor } = allocateOldestFirst([inv("a", 10000, 1)], 14533);
    expect(allocations).toEqual([{ invoiceId: "a", amountMinor: 10000 }]);
    expect(remainderMinor).toBe(4533); // member credit (§9.5)
  });

  it("underpays leave later invoices untouched", () => {
    const { allocations, remainderMinor } = allocateOldestFirst([inv("a", 14533, 1), inv("b", 26500, 15)], 5000);
    expect(allocations).toEqual([{ invoiceId: "a", amountMinor: 5000 }]);
    expect(remainderMinor).toBe(0);
  });

  it("full coverage leaves no remainder", () => {
    const { allocations, remainderMinor } = allocateOldestFirst([inv("a", 14533, 1), inv("b", 26500, 15)], 41033);
    expect(allocations).toHaveLength(2);
    expect(remainderMinor).toBe(0);
  });

  it("handles zero/negative amounts and zero-due invoices", () => {
    expect(allocateOldestFirst([inv("a", 100, 1)], 0)).toEqual({ allocations: [], remainderMinor: 0 });
    expect(allocateOldestFirst([inv("a", 0, 1)], 500)).toEqual({ allocations: [], remainderMinor: 500 });
  });
});

describe("validateExplicitAllocations", () => {
  it("accepts allocations within the payment amount", () => {
    expect(
      validateExplicitAllocations(
        [
          { invoiceId: "a", amountMinor: 100 },
          { invoiceId: "b", amountMinor: 200 }
        ],
        300
      )
    ).toEqual({ ok: true });
  });

  it("rejects non-positive, duplicate or exceeding allocations", () => {
    expect(validateExplicitAllocations([{ invoiceId: "a", amountMinor: 0 }], 100).ok).toBe(false);
    expect(validateExplicitAllocations([{ invoiceId: "a", amountMinor: -5 }], 100).ok).toBe(false);
    expect(
      validateExplicitAllocations(
        [
          { invoiceId: "a", amountMinor: 100 },
          { invoiceId: "a", amountMinor: 100 }
        ],
        500
      ).ok
    ).toBe(false);
    expect(validateExplicitAllocations([{ invoiceId: "a", amountMinor: 150 }], 100).ok).toBe(false);
  });
});
