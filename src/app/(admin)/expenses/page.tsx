import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { expensesScope, canApproveExpenses } from "@/lib/operations/expenses-scope";
import { profitAndLoss } from "@/lib/operations/expenses-service";
import { ExpensesActions } from "./expenses-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string; propertyId?: string }> }) {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M20")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Expenses & P&L (M20)." />;
  }
  const sp = await searchParams;
  const scope = await expensesScope(user);
  const month = sp.month ?? new Date().toISOString().slice(0, 7);
  const propertyId = sp.propertyId && scope.propertyIds.includes(sp.propertyId) ? sp.propertyId : scope.propertyIds[0] ?? null;

  const [properties, categories, expenses, recurring, pl] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: scope.propertyIds.length > 0 ? scope.propertyIds : ["—"] } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    propertyId ? prisma.expenseCategory.findMany({ where: { propertyId, isActive: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.expense.findMany({
      where: { propertyId: propertyId ? propertyId : { in: scope.propertyIds } },
      include: { category: true, property: { select: { code: true } }, receiptDoc: { select: { id: true, fileName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    propertyId ? prisma.recurringExpense.findMany({ where: { propertyId, isActive: true }, include: { category: { select: { name: true } } } }) : Promise.resolve([]),
    profitAndLoss({ month, propertyId, scopePropertyIds: scope.propertyIds })
  ]);

  const canApprove = canApproveExpenses(user);
  const canRecord = scope.propertyIds.length > 0 && (await import("@/lib/rbac/can")).can(user, "create", "M20", { propertyId: propertyId ?? scope.propertyIds[0] });
  const pending = expenses.filter((e) => e.status === "pending");
  const report = pl.ok ? pl.data : null;

  return (
    <div>
      <PageHeader
        title="Expenses & P&L"
        description="M20 — categories mapped to ledger expense accounts; approval above the configurable threshold; void = ledger reversal; P&L reconciles with the ledger exactly; budget vs actual variance"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {report ? (
          <>
            <Badge variant="info">revenue: {formatMinor(report.revenueTotalMinor)}</Badge>
            <Badge variant="warning">expenses: {formatMinor(report.expenseTotalMinor)}</Badge>
            <Badge variant={report.netMinor >= 0 ? "success" : "destructive"}>net: {formatMinor(report.netMinor)}</Badge>
            <Badge variant={report.reconcilesExactly ? "success" : "destructive"}>
              {report.reconcilesExactly ? "reconciles with ledger ✓" : "LEDGER MISMATCH"}
            </Badge>
          </>
        ) : null}
        <Badge variant={pending.length > 0 ? "warning" : "outline"}>pending approvals: {pending.length}</Badge>
        <form className="ml-auto flex items-center gap-2" action="/expenses" method="get">
          <input type="month" name="month" defaultValue={month} className="h-8 rounded-md border bg-transparent px-2 text-xs" />
          <button type="submit" className="h-8 rounded-md border px-2 text-xs hover:bg-accent">
            <Tx>View month</Tx>
          </button>
        </form>
      </div>

      <ExpensesActions
        canRecord={canRecord}
        canApprove={canApprove}
        properties={properties.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
        categories={categories.map((c) => ({ id: c.id, label: `${c.name} (→ ${c.accountCode})` }))}
        month={month}
        pending={pending.map((e) => ({ id: e.id, label: `${e.code} · ${e.vendorName} · ${formatMinor(e.amountMinor)}` }))}
        approved={expenses.filter((e) => e.status === "approved").map((e) => ({ id: e.id, label: `${e.code} · ${e.vendorName} · ${formatMinor(e.amountMinor)}` }))}
        recurring={recurring.map((r) => ({ id: r.id, label: `${r.vendorName} · ${formatMinor(r.amountMinor)} · day ${r.dayOfMonth}${r.lastRunMonth ? ` · ran ${r.lastRunMonth}` : ""}` }))}
      />

      {report ? (
        <div className="mt-2 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-0">
              <div className="border-b p-3 text-sm font-semibold">P&L — {report.month} ({report.scope})</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.revenue.map((l) => (
                    <TableRow key={`r${l.code}`}>
                      <TableCell className="text-xs">Revenue · {l.label} <span className="font-mono text-muted-foreground">{l.code}</span></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatMinor(l.amountMinor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium">
                    <TableCell className="text-xs"><Tx>Total revenue</Tx></TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatMinor(report.revenueTotalMinor)}</TableCell>
                  </TableRow>
                  {report.expenses.map((l) => (
                    <TableRow key={`e${l.code}`}>
                      <TableCell className="text-xs">Expense · {l.label} <span className="font-mono text-muted-foreground">{l.code}</span></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{formatMinor(l.amountMinor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium">
                    <TableCell className="text-xs"><Tx>Total operating expenses</Tx></TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatMinor(report.expenseTotalMinor)}</TableCell>
                  </TableRow>
                  {report.payoutTotalMinor > 0 ? (
                    <TableRow>
                      <TableCell className="text-xs"><Tx>Owner payouts</Tx></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">−{formatMinor(report.payoutTotalMinor)}</TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow className="font-semibold">
                    <TableCell className="text-xs"><Tx>Net</Tx></TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{formatMinor(report.netMinor)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="border-b p-3 text-sm font-semibold">
                  Register ↔ ledger reconciliation
                  <Badge variant={report.reconcilesExactly ? "success" : "destructive"} className="ml-2">
                    {report.reconcilesExactly ? "exact" : "mismatch"}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Register</TableHead>
                      <TableHead className="text-right">Ledger</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.reconciliation.map((r) => (
                      <TableRow key={r.code}>
                        <TableCell className="text-xs">{r.label} <span className="font-mono text-muted-foreground">{r.code}</span></TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{formatMinor(r.registerMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{formatMinor(r.ledgerMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{r.deltaMinor === 0 ? "—" : formatMinor(r.deltaMinor)}</TableCell>
                      </TableRow>
                    ))}
                    {report.reconciliation.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground"><Tx>
                          No expense postings this month.
                        </Tx></TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="border-b p-3 text-sm font-semibold">Budget vs actual — {report.month}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.budgets.map((b) => (
                      <TableRow key={b.category}>
                        <TableCell className="text-xs">{b.category}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{b.budgetMinor == null ? "—" : formatMinor(b.budgetMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">{formatMinor(b.actualMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {b.varianceMinor == null ? (
                            "—"
                          ) : (
                            <Badge variant={b.varianceMinor >= 0 ? "success" : "destructive"}>
                              {b.varianceMinor >= 0 ? "+" : ""}
                              {formatMinor(b.varianceMinor)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {report.budgets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground"><Tx>
                          No budgets or spend this month.
                        </Tx></TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="border-b p-3 text-sm font-semibold"><Tx>Expenses</Tx></div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">
                    {e.code}
                    <span className="block text-muted-foreground">{e.property.code} · {e.expenseDate.toISOString().slice(0, 10)}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.vendorName}
                    {e.description ? <span className="block text-muted-foreground">{e.description}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs">{e.category.name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatMinor(e.amountMinor)} · {e.paidVia === "cash" ? "cash" : "bank"}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === "approved" ? "success" : e.status === "pending" ? "warning" : e.status === "rejected" ? "destructive" : "secondary"}>
                      {e.status}{e.autoApproved ? " (auto)" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.receiptDoc ? e.receiptDoc.fileName : "—"}</TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    <Tx>No expenses recorded yet.</Tx>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground"><Tx>
        Approval above the threshold is Accountant+ (GLOBAL M20:update, mirroring the deposit-refund gate). Approval posts
        DR category-account / CR cash|bank with refType `expense`; voids reverse the posting — the P&L reads the ledger, so
        register and ledger always reconcile exactly.
      </Tx></p>
    </div>
  );
}
