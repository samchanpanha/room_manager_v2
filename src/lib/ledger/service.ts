/// Ledger service (M08) — the only writer of ledger rows. Everything is
/// append-only: post balanced transactions, correct via reversals. No update
/// or delete exists anywhere (DB triggers raise ABORT as the backstop).
/// All writes go through the caller's transaction client (SQLite deadlock rule).
import { prisma } from "@/lib/db";
import { isDebitNormal } from "./accounts";
import { assertBalanced, reversalLines, type PostingLine } from "./postings";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Tx = PrismaTx | typeof prisma;

export interface PostInput {
  memo: string;
  refType: string; // invoice | late_fee | credit_note | invoice_void | payment | refund | deposit | expense | payout | opening | adjustment
  refId?: string | null;
  propertyId?: string | null;
  memberId?: string | null;
  actorId?: string | null;
  reversalOfId?: string | null;
  lines: PostingLine[];
}

/// Post one balanced transaction (+ its entry lines) inside the given tx.
/// Throws UNBALANCED on any math violation — the caller's transaction rolls back.
export async function postTransaction(tx: Tx, input: PostInput): Promise<string> {
  assertBalanced(input.lines);

  const codes = [...new Set(input.lines.map((l) => l.code))];
  const accounts = await tx.ledgerAccount.findMany({ where: { code: { in: codes }, isActive: true } });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of codes) {
    if (!byCode.has(code)) throw new Error(`UNBALANCED: unknown or inactive account ${code}`);
  }

  const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0);
  const created = await tx.ledgerTransaction.create({
    data: {
      memo: input.memo,
      refType: input.refType,
      refId: input.refId ?? null,
      propertyId: input.propertyId ?? null,
      memberId: input.memberId ?? null,
      totalDebit,
      totalCredit: totalDebit,
      reversalOfId: input.reversalOfId ?? null,
      createdById: input.actorId ?? null,
      entries: {
        create: input.lines.map((l) => ({
          accountId: byCode.get(l.code)!.id,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo ?? null,
          propertyId: input.propertyId ?? null,
          memberId: input.memberId ?? null
        }))
      }
    }
  });
  return created.id;
}

/// Reverse a posted transaction (mirror lines, reversalOf back-link).
/// Rejects double reversals — one reversal per original, enforced here AND
/// checked again by callers racing in the same transaction.
export async function reverseTransaction(
  tx: Tx,
  originalId: string,
  opts: { memo: string; refType: string; refId?: string | null; actorId?: string | null }
): Promise<string> {
  const original = await tx.ledgerTransaction.findUnique({
    where: { id: originalId },
    include: { entries: { include: { account: true } } }
  });
  if (!original) throw new Error("REVERSAL_FAILED: original transaction not found");
  const existing = await tx.ledgerTransaction.findFirst({ where: { reversalOfId: originalId } });
  if (existing) throw new Error("REVERSAL_FAILED: transaction already reversed");

  const lines = reversalLines(
    original.entries.map((e) => ({ code: e.account.code, debit: e.debit, credit: e.credit, memo: e.memo ?? undefined }))
  );
  return postTransaction(tx, {
    memo: opts.memo,
    refType: opts.refType,
    refId: opts.refId ?? original.refId,
    propertyId: original.propertyId,
    memberId: original.memberId,
    actorId: opts.actorId ?? null,
    reversalOfId: originalId,
    lines
  });
}

/// Transactions referencing a ref that have not been reversed yet.
export async function liveTransactionIds(tx: Tx, refTypes: string[], refId: string): Promise<string[]> {
  const rows = await tx.ledgerTransaction.findMany({
    where: { refType: { in: refTypes }, refId, reversalOfId: null },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number; // normalized to the account's normal side
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export async function trialBalance(): Promise<TrialBalance> {
  const accounts = await prisma.ledgerAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
  const agg = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    _sum: { debit: true, credit: true }
  });
  const byAccount = new Map(agg.map((a) => [a.accountId, a]));

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const acc of accounts) {
    const sums = byAccount.get(acc.id);
    const debit = sums?._sum.debit ?? 0;
    const credit = sums?._sum.credit ?? 0;
    totalDebit += debit;
    totalCredit += credit;
    rows.push({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit,
      credit,
      balance: isDebitNormal(acc.type) ? debit - credit : credit - debit
    });
  }
  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export interface JournalFilters {
  accountCode?: string;
  propertyId?: string;
  memberId?: string;
  refType?: string;
  refId?: string;
  from?: Date;
  to?: Date;
  take?: number;
}

export async function journal(filters: JournalFilters) {
  const txWhere = {
    ...(filters.refType ? { refType: filters.refType } : {}),
    ...(filters.refId ? { refId: filters.refId } : {}),
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters.memberId ? { memberId: filters.memberId } : {}),
    ...(filters.from || filters.to
      ? { postedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {})
  };
  return prisma.ledgerTransaction.findMany({
    where: txWhere,
    include: {
      entries: {
        include: { account: true },
        ...(filters.accountCode ? { where: { account: { code: filters.accountCode } } } : {})
      },
      reversalOf: { select: { id: true, memo: true } }
    },
    orderBy: { postedAt: "desc" },
    take: Math.min(filters.take ?? 100, 500)
  });
}

/// Member account statement: every posting touching the member (any account),
/// oldest first, plus the running receivable balance (Σ DR − Σ CR on 1300).
export async function memberStatement(memberId: string) {
  const transactions = await prisma.ledgerTransaction.findMany({
    where: { memberId },
    include: { entries: { include: { account: true }, orderBy: { credit: "asc" } }, reversalOf: { select: { id: true, memo: true } } },
    orderBy: { postedAt: "asc" }
  });
  let receivable = 0;
  const rows = transactions.map((t) => {
    const arDelta = t.entries
      .filter((e) => e.account.code === "1300")
      .reduce((s, e) => s + e.debit - e.credit, 0);
    receivable += arDelta;
    return {
      id: t.id,
      postedAt: t.postedAt,
      memo: t.memo,
      refType: t.refType,
      refId: t.refId,
      isReversal: Boolean(t.reversalOfId),
      totalMinor: t.totalDebit,
      receivableAfter: receivable,
      entries: t.entries.map((e) => ({ code: e.account.code, name: e.account.name, debit: e.debit, credit: e.credit, memo: e.memo }))
    };
  });
  return { rows, receivableMinor: receivable };
}

/// CI/live integrity probe: Σ debits == Σ credits across the whole ledger
/// (per-transaction balance is already enforced by DB trigger).
export async function ledgerIntegrity(): Promise<{ totalDebit: number; totalCredit: number; balanced: boolean; transactions: number }> {
  const [sums, count] = await Promise.all([
    prisma.ledgerEntry.aggregate({ _sum: { debit: true, credit: true } }),
    prisma.ledgerTransaction.count()
  ]);
  const totalDebit = sums._sum.debit ?? 0;
  const totalCredit = sums._sum.credit ?? 0;
  return { totalDebit, totalCredit, balanced: totalDebit === totalCredit, transactions: count };
}
