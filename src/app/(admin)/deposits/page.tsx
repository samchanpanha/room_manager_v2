import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visibleDepositScope } from "@/lib/deposits/visibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { DepositActions } from "./deposit-actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  pending: "secondary",
  billed: "warning",
  held: "success",
  settled: "outline"
};

export default async function DepositsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M10")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Deposits (M10)." />;
  }
  const sp = await searchParams;
  const scope = await visibleDepositScope(user, user.permissions);
  if (scope !== "ALL" && scope.propertyIds.length === 0 && scope.memberIds.length === 0) {
    return (
      <div>
        <PageHeader title="Deposits" />
        <EmptyState title="No deposits visible" hint="Deposits are scoped by property (or your own records)." />
      </div>
    );
  }

  const deposits = await prisma.deposit.findMany({
    where: {
      ...(sp.status ? { status: sp.status } : {}),
      ...(scope === "ALL" ? {} : { OR: [{ propertyId: { in: scope.propertyIds } }, { memberProfileId: { in: scope.memberIds } }] })
    },
    include: { lease: true, member: { include: { party: true } }, invoice: true, transactions: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const rows = deposits.map((d) => {
    const collected = d.invoice?.amountPaidMinor ?? 0;
    const deducted = d.transactions.filter((t) => t.type === "deduction").reduce((s, t) => s + t.amountMinor, 0);
    const refunded = d.transactions.filter((t) => t.type === "refund").reduce((s, t) => s + t.amountMinor, 0);
    return {
      id: d.id,
      leaseId: d.leaseId,
      leaseCode: d.lease.code,
      leaseStatus: d.lease.status,
      member: { id: d.memberProfileId, name: d.member.party.name },
      status: d.status,
      requiredMinor: d.requiredMinor,
      collectedMinor: collected,
      deductedMinor: deducted,
      refundedMinor: refunded,
      remainingMinor: Math.max(0, collected - deducted - refunded),
      invoiceId: d.invoiceId
    };
  });

  const held = rows.reduce((s, r) => s + r.remainingMinor, 0);
  const awaiting = rows.filter((r) => r.status === "billed").length;
  const settling = rows.filter((r) => r.status === "held" && r.leaseStatus !== "active").length;
  const canUpdate = can(user, "update", "M10");
  const canRefund = user.permissions.some((p) => p.module === "M10" && p.action === "update" && p.scope === "GLOBAL");

  return (
    <div>
      <PageHeader
        title="Deposits"
        description="Security deposits — collected as installment invoices, held in 2100 Deposit Liability, settled with evidence-backed deductions + refund at move-out"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Held (liability)" value={formatMinor(held)} sub={`${rows.length} deposit(s)`} />
        <StatCard label="Awaiting collection" value={awaiting} sub="deposit invoice open" />
        <StatCard label="Ready to settle" value={settling} sub="lease ended, money held" />
      </div>

      <form method="get" className="mb-4 flex items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="df-status" className="text-xs text-muted-foreground">Status</label>
          <select id="df-status" name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border bg-background px-2">
            <option value="">All</option>
            {["pending", "billed", "held", "settled"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90">
          Filter
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Deposit invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Deducted</TableHead>
                <TableHead className="text-right">Refunded</TableHead>
                <TableHead className="text-right">Held</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <a href={`/leases/${d.leaseId}`} className="font-mono text-xs underline underline-offset-4 hover:underline">
                      {d.leaseCode}
                    </a>
                    <span className="block text-xs text-muted-foreground">{d.leaseStatus}</span>
                  </TableCell>
                  <TableCell>
                    <a href={`/members/${d.member.id}`} className="underline-offset-4 hover:underline">
                      {d.member.name}
                    </a>
                  </TableCell>
                  <TableCell>
                    {d.invoiceId ? (
                      <a href={`/invoices/${d.invoiceId}`} className="font-mono text-xs underline underline-offset-4 hover:underline">
                        view
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">not billed</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(d.requiredMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(d.collectedMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.deductedMinor ? formatMinor(d.deductedMinor) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.refundedMinor ? formatMinor(d.refundedMinor) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMinor(d.remainingMinor)}</TableCell>
                  <TableCell className="text-right">
                    <DepositActions
                      deposit={{ id: d.id, leaseStatus: d.leaseStatus, status: d.status, remainingMinor: d.remainingMinor }}
                      canUpdate={canUpdate}
                      canRefund={canRefund}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    No deposits yet — deposits are billed automatically when a lease with deposit terms is activated.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Installments bill through invoices (pay them via Payments — oldest-first picks the deposit first). Deductions require an
        evidence document; refunds need Accountant approval. The 2100 liability nets to 0 once a closed lease is fully settled.
      </p>
    </div>
  );
}
