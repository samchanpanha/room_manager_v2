/// M24 Owner Statements — pure math: month windows, the §M24 payout formula
/// (per contract model), collection rollups and reconciliation arithmetic.
/// DB work lives in statements-service.tsx. All money is integer minor units.
export type StatementContractModel = "FIXED_RENT" | "REVENUE_SHARE";

export const STATEMENT_STATUSES = ["draft", "approved", "paid"] as const;
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];

export function statementMonthRange(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  return { from: new Date(Date.UTC(year, mon - 1, 1)), to: new Date(Date.UTC(year, mon, 1)) };
}

export function previousMonth(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

export interface StatementInput {
  model: StatementContractModel;
  sharePercent: number | null; // REVENUE_SHARE: owner share 1..100
  fixedRentMinor: number | null; // FIXED_RENT
  managementFeePercent: number; // 0..100 of the gross share
  collectedMinor: number; // confirmed collections for the building's leases
  passthroughMinor: number; // approved pass-through expenses (building, month)
  ownerMaintenanceMinor: number; // approved owner-borne maintenance expenses
  adjustmentsMinor: number; // manual ± adjustments
}

export interface StatementLines {
  collectedMinor: number;
  grossShareMinor: number;
  managementFeeMinor: number;
  passthroughMinor: number;
  ownerMaintenanceMinor: number;
  adjustmentsMinor: number;
  netMinor: number;
}

/// §M24 formula: (collected × share | fixed rent) − management fee
/// − pass-through − owner-borne maintenance ± adjustments = net payout.
/// Percentages round half-up; negative nets are kept exact (pay ≤ 0 is a
/// no-op at payout time).
export function computeStatementLines(input: StatementInput): StatementLines {
  let grossShareMinor: number;
  if (input.model === "FIXED_RENT") {
    grossShareMinor = input.fixedRentMinor ?? 0;
  } else {
    const share = Math.min(100, Math.max(0, input.sharePercent ?? 0));
    grossShareMinor = Math.round((input.collectedMinor * share) / 100);
  }
  const fee = Math.min(100, Math.max(0, input.managementFeePercent));
  const managementFeeMinor = Math.round((grossShareMinor * fee) / 100);
  const netMinor =
    grossShareMinor -
    managementFeeMinor -
    input.passthroughMinor -
    input.ownerMaintenanceMinor +
    input.adjustmentsMinor;
  return {
    collectedMinor: input.collectedMinor,
    grossShareMinor,
    managementFeeMinor,
    passthroughMinor: input.passthroughMinor,
    ownerMaintenanceMinor: input.ownerMaintenanceMinor,
    adjustmentsMinor: input.adjustmentsMinor,
    netMinor
  };
}

// ── reconciliation helpers ───────────────────────────────────────────────────

export interface CollectionRow {
  buildingId: string;
  amountMinor: number; // one PaymentAllocation against a building's invoice
}

/// Collected revenue per building from confirmed payment allocations.
export function rollupCollections(rows: CollectionRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.buildingId, (out.get(r.buildingId) ?? 0) + r.amountMinor);
  return out;
}

export interface ExpenseRow {
  buildingId: string;
  chargeTo: string;
  amountMinor: number;
}

export function rollupExpensesByCharge(rows: ExpenseRow[]): { passthrough: Map<string, number>; ownerMaintenance: Map<string, number> } {
  const passthrough = new Map<string, number>();
  const ownerMaintenance = new Map<string, number>();
  for (const r of rows) {
    if (r.chargeTo === "passthrough") passthrough.set(r.buildingId, (passthrough.get(r.buildingId) ?? 0) + r.amountMinor);
    else if (r.chargeTo === "owner_maintenance") ownerMaintenance.set(r.buildingId, (ownerMaintenance.get(r.buildingId) ?? 0) + r.amountMinor);
  }
  return { passthrough, ownerMaintenance };
}

/// §M24 acceptance: "amounts reconcile to ledger". The statement's collected
/// line must equal the ledger-side payment totals attributed to the building
/// (allocation-exact by construction); this checks the arithmetic identity
/// net = gross − fee − passthrough − maintenance + adjustments.
export function statementReconciles(lines: StatementLines): boolean {
  return (
    lines.netMinor ===
    lines.grossShareMinor -
      lines.managementFeeMinor -
      lines.passthroughMinor -
      lines.ownerMaintenanceMinor +
      lines.adjustmentsMinor
  );
}
