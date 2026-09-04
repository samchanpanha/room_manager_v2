import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visiblePaymentScope } from "@/lib/payments/visibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { PaymentActions, RecordPaymentButton } from "./payment-jobs";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  pending: "warning",
  confirmed: "success",
  refunded: "secondary",
  failed: "destructive"
};

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; method?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M09")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Payments (M09)." />;
  }
  const sp = await searchParams;
  const scope = await visiblePaymentScope(user, user.permissions);
  if (scope !== "ALL" && scope.propertyIds.length === 0 && scope.memberIds.length === 0) {
    return (
      <div>
        <PageHeader title="Payments" />
        <EmptyState title="No payments visible" hint="Payments are scoped by property (or your own records)." />
      </div>
    );
  }

  const payments = await prisma.payment.findMany({
    where: {
      ...(sp.status ? { status: sp.status } : {}),
      ...(sp.method ? { method: sp.method } : {}),
      ...(scope === "ALL" ? {} : { OR: [{ propertyId: { in: scope.propertyIds } }, { memberProfileId: { in: scope.memberIds } }] })
    },
    include: { member: { include: { party: true } }, allocations: { include: { invoice: true } } },
    orderBy: { receivedAt: "desc" },
    take: 200
  });

  const canUpdate = can(user, "update", "M09");
  const canRefund = user.permissions.some((p) => p.module === "M09" && p.action === "update" && p.scope === "GLOBAL");
  const confirmed = payments.filter((p) => p.status === "confirmed" || p.status === "refunded");
  const collected = confirmed.reduce((s, p) => s + p.amountMinor, 0);
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const credit = confirmed.reduce((s, p) => s + p.remainingMinor, 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Collections against invoices — receipts numbered, allocations oldest-first, money through the ledger"
        actions={<RecordPaymentButton canCreate={can(user, "create", "M09")} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected (confirmed)" value={formatMinor(collected)} sub={`${confirmed.length} payment(s)`} />
        <StatCard label="Pending" value={pendingCount} sub="awaiting confirmation" />
        <StatCard label="Unallocated member credit" value={formatMinor(credit)} sub="refundable by Accountant+" />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="pf-status" className="text-xs text-muted-foreground">Status</label>
          <select id="pf-status" name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border bg-background px-2">
            <option value="">All</option>
            {["pending", "confirmed", "refunded", "failed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="pf-method" className="text-xs text-muted-foreground">Method</label>
          <select id="pf-method" name="method" defaultValue={sp.method ?? ""} className="h-9 rounded-md border bg-background px-2">
            <option value="">All</option>
            {["cash", "bank_transfer", "qr", "card", "cheque"].map((m) => (
              <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
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
                <TableHead>Payment</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Applied to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Credit left</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <a href={`/payments/${p.id}`} className="font-mono text-xs font-medium underline-offset-4 hover:underline">
                      {p.code}
                    </a>
                    {p.receiptCode ? <span className="block text-xs text-muted-foreground">{p.receiptCode}</span> : null}
                  </TableCell>
                  <TableCell>
                    <a href={`/members/${p.memberProfileId}`} className="underline-offset-4 hover:underline">
                      {p.member.party.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.method.replaceAll("_", " ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.allocations.length > 0
                      ? p.allocations.map((a) => `${a.invoice.code} (${formatMinor(a.amountMinor)})`).join(", ")
                      : "member credit"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(p.receivedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(p.amountMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.status === "refunded" ? "—" : formatMinor(p.remainingMinor)}</TableCell>
                  <TableCell className="text-right">
                    <PaymentActions
                      paymentId={p.id}
                      status={p.status}
                      remainingMinor={p.remainingMinor}
                      canUpdate={canUpdate}
                      canRefund={canRefund}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    No payments yet — record one (top right) or wait for portal/QR payments.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Partial payments set invoices to <span className="font-mono">partial_paid</span>; allocations are immutable; refunds of
        member credit need Accountant approval and reverse via the ledger; gateway webhooks are idempotent (duplicates ignored).
      </p>
    </div>
  );
}
