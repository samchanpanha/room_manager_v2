/**
 * M10 Deposits — pure rules: state machine, installment split, credit accounts,
 * settlement eligibility. No DB.
 */
import { describe, expect, it } from "vitest";
import {
  DEDUCTION_REASONS,
  DEPOSIT_MOVEMENTS,
  DEPOSIT_TRANSITIONS,
  deductionCreditAccount,
  installmentSplit,
  leaseAllowsSettlement
} from "@/lib/deposits/machines";

describe("deposit state machine", () => {
  it("is forward-only pending → billed → held → settled", () => {
    expect(DEPOSIT_TRANSITIONS.pending).toEqual(["billed"]);
    expect(DEPOSIT_TRANSITIONS.billed).toEqual(["held"]);
    expect(DEPOSIT_TRANSITIONS.held).toEqual(["settled"]);
    expect(DEPOSIT_TRANSITIONS.settled).toEqual([]);
  });

  it("movement types are deduction and refund only", () => {
    expect([...DEPOSIT_MOVEMENTS].sort()).toEqual(["deduction", "refund"]);
    expect([...DEDUCTION_REASONS].sort()).toEqual(["cleaning", "damage", "other", "unpaid_rent"]);
  });
});

describe("installmentSplit", () => {
  it("splits 50000 into 2 equal installments of 25000 (Σ = total)", () => {
    expect(installmentSplit(50000, 2)).toEqual([25000, 25000]);
  });

  it("floors and lets the last installment absorb the remainder", () => {
    expect(installmentSplit(100, 3)).toEqual([33, 33, 34]);
    expect(installmentSplit(10, 4)).toEqual([2, 2, 2, 4]);
  });

  it("handles single installment and rejects 0 installments", () => {
    expect(installmentSplit(50000, 1)).toEqual([50000]);
    expect(() => installmentSplit(50000, 0)).toThrow(/installments must be 1/);
  });
});

describe("deductionCreditAccount", () => {
  it("maps damage/cleaning/other to 4900 Other Income", () => {
    expect(deductionCreditAccount("damage")).toBe("4900");
    expect(deductionCreditAccount("cleaning")).toBe("4900");
    expect(deductionCreditAccount("other")).toBe("4900");
  });

  it("maps unpaid_rent to 1300 receivable (settles the open dues, no double income)", () => {
    expect(deductionCreditAccount("unpaid_rent")).toBe("1300");
  });
});

describe("leaseAllowsSettlement", () => {
  it("allows notice/completed/terminated only", () => {
    expect(leaseAllowsSettlement("notice")).toBe(true);
    expect(leaseAllowsSettlement("completed")).toBe(true);
    expect(leaseAllowsSettlement("terminated")).toBe(true);
    expect(leaseAllowsSettlement("active")).toBe(false);
    expect(leaseAllowsSettlement("draft")).toBe(false);
    expect(leaseAllowsSettlement("expired")).toBe(false);
  });
});
