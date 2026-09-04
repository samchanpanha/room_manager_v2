/// Room moves (M16) — pure rules: state machine + proration math.
/// The move's adjustment invoice IS the new lease's first billing period:
/// new rent prorated over the remainder + move fee − unused old-rent credit
/// (as invoice discount) → the net is the exact proration delta, and the
/// engine's per-period duplicate check prevents double billing.
import { prorate, type ProrationBasis } from "@/lib/billing/proration";

export const ROOM_MOVE_STATUSES = ["requested", "approved", "executed", "cancelled"] as const;
export type RoomMoveStatus = (typeof ROOM_MOVE_STATUSES)[number];

export function isRoomMoveStatus(v: string): v is RoomMoveStatus {
  return (ROOM_MOVE_STATUSES as readonly string[]).includes(v);
}

export const ROOM_MOVE_TRANSITIONS: Record<RoomMoveStatus, RoomMoveStatus[]> = {
  requested: ["approved", "cancelled"],
  approved: ["executed", "cancelled"],
  executed: [],
  cancelled: []
};

export function canRoomMoveTransition(from: string, to: string): boolean {
  if (!isRoomMoveStatus(from) || !isRoomMoveStatus(to)) return false;
  return ROOM_MOVE_TRANSITIONS[from].includes(to);
}

export interface MoveProrationInput {
  oldRentMinor: number;
  newRentMinor: number;
  moveFeeMinor: number;
  effectiveAt: Date;
  /** End of the billing period containing the move (= new lease's first period end). */
  periodEnd: Date;
  prorationBasis: ProrationBasis;
  billingCycleDay: number;
}

export interface MoveProration {
  /** Unused remainder of the OLD lease's rent for the overlap window — applied as invoice discount. */
  oldRentCreditMinor: number;
  /** Prorated NEW rent charged on the adjustment invoice. */
  newRentChargeMinor: number;
  moveFeeMinor: number;
  /** newCharge + fee − oldCredit (the exact delta the member sees). */
  netMinor: number;
  days: number;
  denominator: number;
  factor: string;
}

/// Proration delta for a move effective inside [effectiveAt, periodEnd):
/// both rents prorated on the same denominator (the old lease's basis/cycle),
/// the delta is what the single adjustment invoice nets out to.
export function computeMoveProration(input: MoveProrationInput): MoveProration {
  const newCharge = prorate(input.newRentMinor, input.effectiveAt, input.periodEnd, input.prorationBasis, input.billingCycleDay);
  const oldCredit = prorate(input.oldRentMinor, input.effectiveAt, input.periodEnd, input.prorationBasis, input.billingCycleDay);
  const netMinor = newCharge.amountMinor + input.moveFeeMinor - oldCredit.amountMinor;
  return {
    oldRentCreditMinor: oldCredit.amountMinor,
    newRentChargeMinor: newCharge.amountMinor,
    moveFeeMinor: input.moveFeeMinor,
    netMinor,
    days: newCharge.days,
    denominator: newCharge.cycleDays,
    factor: newCharge.factor
  };
}

/// Start of the billing period containing `today` (the earliest effective
/// date a move may target — earlier windows would span several cycles).
export function currentCycleStart(today: Date, billingCycleDay: number): Date {
  const day = Math.min(Math.max(billingCycleDay, 1), 28);
  const sameMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
  if (sameMonth.getTime() <= today.getTime()) return sameMonth;
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, day));
}
