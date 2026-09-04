/// Pure allocation math (M09, §9.5): apply a payment across a member's open
/// invoices oldest-first; Σ allocations ≤ amount; the remainder stays member
/// credit. Deterministic and unit-tested — no DB here.
export interface OpenInvoice {
  id: string;
  /** current outstanding amount in minor units (> 0) */
  dueMinor: number;
  /** ordering key: due date, then period start */
  dueDate: Date;
  periodStart?: Date;
}

export interface Allocation {
  invoiceId: string;
  amountMinor: number;
}

/// Sorts open invoices oldest-first and consumes the payment amount against
/// their outstanding dues (FIFO), capped per invoice.
export function allocateOldestFirst(openInvoices: OpenInvoice[], amountMinor: number): {
  allocations: Allocation[];
  remainderMinor: number;
} {
  if (amountMinor <= 0) return { allocations: [], remainderMinor: 0 };
  const ordered = [...openInvoices]
    .filter((i) => i.dueMinor > 0)
    .sort((a, b) =>
      a.dueDate.getTime() - b.dueDate.getTime() ||
      (a.periodStart?.getTime() ?? 0) - (b.periodStart?.getTime() ?? 0)
    );
  let left = amountMinor;
  const allocations: Allocation[] = [];
  for (const inv of ordered) {
    if (left <= 0) break;
    const applied = Math.min(left, inv.dueMinor);
    allocations.push({ invoiceId: inv.id, amountMinor: applied });
    left -= applied;
  }
  return { allocations, remainderMinor: left };
}

/// Validation for explicit allocations (API input): every invoice must carry a
/// positive share, Σ ≤ amount. Per-invoice caps and membership are checked
/// against the DB in the service.
export function validateExplicitAllocations(
  allocations: Array<{ invoiceId: string; amountMinor: number }>,
  amountMinor: number
): { ok: true } | { ok: false; message: string } {
  let sum = 0;
  const seen = new Set<string>();
  for (const a of allocations) {
    if (!Number.isInteger(a.amountMinor) || a.amountMinor <= 0) {
      return { ok: false, message: "Allocation amounts must be positive integers (minor units)" };
    }
    if (seen.has(a.invoiceId)) return { ok: false, message: "Duplicate invoice in allocations" };
    seen.add(a.invoiceId);
    sum += a.amountMinor;
  }
  if (sum > amountMinor) {
    return { ok: false, message: "Allocations exceed the payment amount" };
  }
  return { ok: true };
}
