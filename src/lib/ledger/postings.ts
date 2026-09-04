/// Pure posting builders (M08): domain facts → balanced double-entry lines.
/// No DB access here — everything is plain data so the balance invariant is
/// unit-testable to the eyebrows. All amounts integer minor units.
import { ACC, CREDIT_ACCOUNT_BY_KIND } from "./accounts";

export interface PostingLine {
  code: string;
  debit: number;
  credit: number;
  memo?: string;
}

/// Sanity guard for builders: a balanced, non-empty, single-sided set.
export function assertBalanced(lines: PostingLine[]): void {
  if (lines.length < 2) throw new Error("UNBALANCED: a posting needs at least a debit and a credit line");
  let debits = 0;
  let credits = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0) {
      throw new Error(`UNBALANCED: invalid line amounts for ${l.code}`);
    }
    if ((l.debit > 0) === (l.credit > 0)) {
      throw new Error(`UNBALANCED: line ${l.code} must be exactly one of debit/credit`);
    }
    debits += l.debit;
    credits += l.credit;
  }
  if (debits === 0 || debits !== credits) {
    throw new Error(`UNBALANCED: Σ debits ${debits} != Σ credits ${credits}`);
  }
}

/// Half-up proportional allocation of `total` across positive `weights`,
/// largest-remainder fix-up so Σshares = total exactly (integer minor units).
export function allocateProportional(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || sum <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => Math.round((total * w) / sum));
  const diff = total - shares.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    // distribute the rounding residual one minor unit at a time, largest
    // weights first (ties by index) — deterministic and keeps big categories whole
    const order = weights
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .map((x) => x.i);
    const sign = diff > 0 ? 1 : -1;
    for (let k = 0; k < Math.abs(diff); k++) {
      shares[order[k % order.length]] += sign;
    }
  }
  return shares;
}

/// Invoice issue (accrual basis): DR 1300 Rent Receivable with the invoice
/// total; CR revenue by item kind with the invoice-level discount prorated
/// across kinds (largest-remainder); tax → 2300 Tax Payable.
export function invoiceIssueLines(inv: {
  totalMinor: number;
  discountMinor: number;
  taxMinor: number;
  items: Array<{ kind: string; amountMinor: number }>;
}): PostingLine[] {
  if (inv.totalMinor <= 0) throw new Error("UNBALANCED: invoice total must be positive");
  const byKind = new Map<string, number>();
  for (const item of inv.items) {
    if (item.amountMinor < 0) throw new Error(`UNBALANCED: negative item amount (${item.kind})`);
    byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + item.amountMinor);
  }
  const kinds = [...byKind.keys()];
  const gross = kinds.map((k) => byKind.get(k) ?? 0);
  const discounts = allocateProportional(inv.discountMinor, gross);
  const nets = kinds.map((k, i) => (byKind.get(k) ?? 0) - discounts[i]);

  const lines: PostingLine[] = [{ code: ACC.RENT_RECEIVABLE, debit: inv.totalMinor, credit: 0 }];
  kinds.forEach((kind, i) => {
    const code = CREDIT_ACCOUNT_BY_KIND[kind] ?? ACC.OTHER_REVENUE;
    if (nets[i] <= 0) return; // fully-discounted category contributes nothing
    const existing = lines.find((l) => l.code === code && l.credit > 0);
    if (existing) existing.credit += nets[i];
    else lines.push({ code, debit: 0, credit: nets[i] });
  });
  if (inv.taxMinor > 0) {
    lines.push({ code: ACC.TAX_PAYABLE, debit: 0, credit: inv.taxMinor, memo: "Output tax" });
  }
  assertBalanced(lines); // holds by the §9.4 invariant: total = Σnets + tax
  return lines;
}

/// Late fee: DR 1300 (the member now owes more), CR 4300 Late Fee Revenue.
export function lateFeeLines(amountMinor: number, invoiceCode: string): PostingLine[] {
  const lines: PostingLine[] = [
    { code: ACC.RENT_RECEIVABLE, debit: amountMinor, credit: 0 },
    { code: ACC.LATE_FEE_REVENUE, debit: 0, credit: amountMinor, memo: `Late fee on ${invoiceCode}` }
  ];
  assertBalanced(lines);
  return lines;
}

/// Credit note against an invoice's original revenue allocation: DR revenue
/// pro-rata of the issue posting's revenue lines, CR 1300. Falls back to
/// Other Revenue when no original posting exists (pre-ledger invoices).
export function creditNoteLines(
  originalRevenue: Array<{ code: string; credit: number }>,
  amountMinor: number
): PostingLine[] {
  if (amountMinor <= 0) throw new Error("UNBALANCED: credit amount must be positive");
  const live = originalRevenue.filter((l) => l.credit > 0);
  const lines: PostingLine[] = [];
  if (live.length === 0) {
    lines.push({ code: ACC.OTHER_REVENUE, debit: amountMinor, credit: 0, memo: "Credit note (no original posting)" });
  } else {
    const shares = allocateProportional(amountMinor, live.map((l) => l.credit));
    live.forEach((l, i) => {
      if (shares[i] <= 0) return;
      lines.push({ code: l.code, debit: shares[i], credit: 0, memo: "Credit note" });
    });
  }
  lines.push({ code: ACC.RENT_RECEIVABLE, debit: 0, credit: amountMinor });
  assertBalanced(lines);
  return lines;
}

/// Mirror of a balanced posting (swap debit/credit per line) — the basis of
/// every correction: reversals only, never edits (§9.3).
export function reversalLines(lines: Array<{ code: string; debit: number; credit: number; memo?: string }>): PostingLine[] {
  const mirrored = lines.map((l) => ({ code: l.code, debit: l.credit, credit: l.debit, memo: l.memo }));
  const out: PostingLine[] = mirrored.map((l) =>
    l.debit > 0 ? { code: l.code, debit: l.debit, credit: 0, memo: l.memo } : { code: l.code, debit: 0, credit: l.credit, memo: l.memo }
  );
  assertBalanced(out);
  return out;
}
