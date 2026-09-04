/// Payment state machine (INTENT.md M09):
/// pending → confirmed → refunded · pending → failed. refunded & failed terminal.
export const PAYMENT_STATUSES = ["pending", "confirmed", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["confirmed", "failed"],
  confirmed: ["refunded"],
  refunded: [],
  failed: []
};

export function isPaymentStatus(v: string): v is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(v);
}

export function canPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "qr", "card", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(v: string): v is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v);
}

/// Cash-drawer accounts: cash & cheque land in 1100, everything else 1200.
export function settlementAccountCode(method: string): "1100" | "1200" {
  return method === "cash" || method === "cheque" ? "1100" : "1200";
}
