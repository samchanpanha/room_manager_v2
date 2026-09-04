/// Deposit state machine (INTENT.md M10): pending → billed → held → settled.
/// Forward-only: a settled deposit stays settled (compensations are new
/// movements, never status rewinds).
export const DEPOSIT_STATUSES = ["pending", "billed", "held", "settled"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const DEPOSIT_TRANSITIONS: Record<DepositStatus, DepositStatus[]> = {
  pending: ["billed"],
  billed: ["held"],
  held: ["settled"],
  settled: []
};

export function canDepositTransition(from: DepositStatus, to: DepositStatus): boolean {
  return DEPOSIT_TRANSITIONS[from].includes(to);
}

/// Settlement movement types. Collections are NOT movements here — they ride
/// the deposit invoice (M09 payments); only liability-releasing movements
/// (deduction, refund) are recorded.
export const DEPOSIT_MOVEMENTS = ["deduction", "refund"] as const;
export type DepositMovement = (typeof DEPOSIT_MOVEMENTS)[number];

export const DEDUCTION_REASONS = ["damage", "cleaning", "unpaid_rent", "other"] as const;
export type DeductionReason = (typeof DEDUCTION_REASONS)[number];

export function isDeductionReason(v: string): v is DeductionReason {
  return (DEDUCTION_REASONS as readonly string[]).includes(v);
}

/// Deduction credit side: damage/cleaning/other are recovered cost (revenue);
/// unpaid_rent settles outstanding receivable instead of booking income.
export function deductionCreditAccount(reason: DeductionReason): "1300" | "4900" {
  return reason === "unpaid_rent" ? "1300" : "4900";
}

/// Installment split: base = floor(total / n), the last installment absorbs
/// the rounding remainder so Σ installments = total exactly.
export function installmentSplit(totalMinor: number, installments: number): number[] {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) throw new Error("INVALID: deposit total must be a positive integer");
  if (!Number.isInteger(installments) || installments < 1 || installments > 12) throw new Error("INVALID: installments must be 1..12");
  const base = Math.floor(totalMinor / installments);
  const amounts = Array.from({ length: installments }, () => base);
  amounts[installments - 1] += totalMinor - base * installments;
  return amounts;
}

/// Deposit lease states that allow settlement movements (move-out window).
export const SETTLEMENT_LEASE_STATUSES = ["notice", "completed", "terminated"] as const;

export function leaseAllowsSettlement(leaseStatus: string): boolean {
  return (SETTLEMENT_LEASE_STATUSES as readonly string[]).includes(leaseStatus);
}
