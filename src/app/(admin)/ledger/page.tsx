import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { trialBalance, journal, ledgerIntegrity } from "@/lib/ledger/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { SearchableSelect } from "@/components/ui/searchable-select";

export const dynamic = "force-dynamic";

const REF_VARIANT: Record<string, "secondary" | "info" | "warning" | "destructive" | "success" | "outline"> = {
  invoice: "info",
  late_fee: "warning",
  credit_note: "secondary",
  invoice_void: "destructive",
  payment: "success",
  refund: "outline",
  deposit: "secondary",
  expense: "outline",
  payout: "outline",
  opening: "secondary",
  adjustment: "outline"
};

const ACCOUNT_OPTIONS = [
  "1100", "1200", "1300", "2100", "2200", "2300",
  "4000", "4100", "4200", "4300", "4900", "5000", "5100"
];

export default async function LedgerPage({
  searchParams
}: {
  searchParams: Promise<{ account?: string; refType?: string; memberId?: string; from?: string; to?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || !user.permissions.some((p) => p.module === "M08" && p.action === "read" && p.scope === "GLOBAL")) {
    return <EmptyState title="No access" hint="Ledger screens need global M08:read (Admin/Accountant)." />;
  }
  const sp = await searchParams;

  const [tb, integrity, transactions, memberFilter] = await Promise.all([
    trialBalance(),
    ledgerIntegrity(),
    journal({
      accountCode: sp.account || undefined,
      refType: sp.refType || undefined,
      memberId: sp.memberId || undefined,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to) : undefined,
      take: 100
    }),
    sp.memberId
      ? prisma.memberProfile.findUnique({ where: { id: sp.memberId }, include: { party: true } })
      : null
  ]);

  return (
    <div>
      <PageHeader
        title="Ledger"
        description="Immutable double-entry spine — postings are append-only, corrections are reversals"
        actions={
          integrity.balanced ? (
            <Badge variant="success">Σ debits = Σ credits · balanced</Badge>
          ) : (
            <Badge variant="destructive">OUT OF BALANCE — investigate immediately</Badge>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Postings" value={integrity.transactions} />
        <StatCard label="Σ debits" value={formatMinor(integrity.totalDebit)} />
        <StatCard label="Σ credits" value={formatMinor(integrity.totalCredit)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">Trial balance</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debits</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tb.rows.map((r) => (
                  <TableRow key={r.code} className={r.debit === 0 && r.credit === 0 ? "text-muted-foreground" : ""}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>
                      {r.name}
                      <span className="block text-xs text-muted-foreground">{r.type.toLowerCase()}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.debit ? formatMinor(r.debit) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.credit ? formatMinor(r.credit) : "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMinor(r.balance)}</TableCell>
                  </TableRow>
                ))}
                {tb.rows.every((r) => r.debit === 0 && r.credit === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No postings yet — issue an invoice to see the books move.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
              <span>Totals</span>
              <span className="flex items-center gap-4">
                <span className="tabular-nums">DR {formatMinor(tb.totalDebit)}</span>
                <span className="tabular-nums">CR {formatMinor(tb.totalCredit)}</span>
                <Badge variant={tb.balanced ? "success" : "destructive"}>{tb.balanced ? "nets 0" : "off!"}</Badge>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">Journal</p>
            <form method="get" className="mb-4 flex flex-wrap items-end gap-2 text-sm">
              <div className="space-y-1">
                <label htmlFor="jf-account" className="text-xs text-muted-foreground">Account</label>
                <SearchableSelect
                  id="jf-account"
                  name="account"
                  defaultValue={sp.account ?? ""}
                  options={[
                    { value: "", label: "All" },
                    ...ACCOUNT_OPTIONS.map((c) => ({ value: c, label: c }))
                  ]}
                  className="h-9 rounded-md border bg-background px-2"
                  placeholder="All"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="jf-ref" className="text-xs text-muted-foreground">Ref type</label>
                <SearchableSelect
                  id="jf-ref"
                  name="refType"
                  defaultValue={sp.refType ?? ""}
                  options={[
                    { value: "", label: "All" },
                    { value: "invoice", label: "invoice" },
                    { value: "late_fee", label: "late fee" },
                    { value: "credit_note", label: "credit note" },
                    { value: "invoice_void", label: "invoice void" },
                    { value: "payment", label: "payment" },
                    { value: "refund", label: "refund" },
                    { value: "deposit", label: "deposit" },
                    { value: "expense", label: "expense" },
                    { value: "payout", label: "payout" }
                  ]}
                  className="h-9 rounded-md border bg-background px-2"
                  placeholder="All"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="jf-from" className="text-xs text-muted-foreground">From</label>
                <input id="jf-from" name="from" type="date" defaultValue={sp.from ?? ""} className="h-9 rounded-md border bg-background px-2" />
              </div>
              <div className="space-y-1">
                <label htmlFor="jf-to" className="text-xs text-muted-foreground">To</label>
                <input id="jf-to" name="to" type="date" defaultValue={sp.to ?? ""} className="h-9 rounded-md border bg-background px-2" />
              </div>
              {memberFilter ? <input type="hidden" name="memberId" value={memberFilter.id} /> : null}
              <button type="submit" className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90">
                Filter
              </button>
              {memberFilter ? (
                <span className="pb-2 text-xs text-muted-foreground">
                  member: <span className="text-foreground">{memberFilter.party.name}</span>{" "}
                  <a href="/ledger" className="underline underline-offset-4">clear</a>
                </span>
              ) : null}
            </form>

            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No postings match the filters.</p>
              ) : null}
              {transactions.map((t) => (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={REF_VARIANT[t.refType] ?? "outline"}>{t.refType.replaceAll("_", " ")}</Badge>
                      <span className="text-sm">{t.memo}</span>
                      {t.reversalOf ? (
                        <Badge variant="outline" title={t.reversalOf.memo}>reversal</Badge>
                      ) : null}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t.postedAt.toISOString().slice(0, 16).replace("T", " ")} · {formatMinor(t.totalDebit)}
                    </span>
                  </div>
                  <Table>
                    <TableBody>
                      {t.entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="w-14 py-1 font-mono text-xs text-muted-foreground">{e.account.code}</TableCell>
                          <TableCell className="py-1 text-sm">{e.account.name}{e.memo ? <span className="text-muted-foreground"> · {e.memo}</span> : null}</TableCell>
                          <TableCell className="w-24 py-1 text-right text-sm tabular-nums">{e.debit ? formatMinor(e.debit) : ""}</TableCell>
                          <TableCell className="w-24 py-1 text-right text-sm tabular-nums">{e.credit ? formatMinor(e.credit) : ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
