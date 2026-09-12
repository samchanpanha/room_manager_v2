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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tx } from "@/components/i18n-text";
import { WorkflowGuide } from "@/components/workflow-guide";

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
      lease: { property: { tenantId: user.tenantId } },
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
      invoiceId: d.invoiceId,
      invoiceCode: d.invoice?.code ?? null
    };
  });

  const held = rows.reduce((s, r) => s + r.remainingMinor, 0);
  const awaiting = rows.filter((r) => r.status === "billed").length;
  const settling = rows.filter((r) => r.status === "held" && r.leaseStatus !== "active").length;
  const canUpdate = can(user, "update", "M10");
  const canRefund = user.permissions.some((p) => p.module === "M10" && p.action === "update" && p.scope === "GLOBAL");
  const canCollectPayment = can(user, "create", "M09");

  return (
    <div>
      <PageHeader
        title="Deposits"
        description="Security deposits — collected as installment invoices, held in 2100 Deposit Liability, settled with evidence-backed deductions + refund at move-out"
      />

      <WorkflowGuide
        moduleKey="M10"
        title="Security Deposit Lifecycle & Settlement Workflow"
        subtitle="Installment billing, liability holding (2100), evidence-backed deductions, and move-out refunds"
        steps={[
          {
            title: "1. Billed on Activation",
            description: "Activating a lease automatically generates a deposit installment invoice (isDeposit=true) with status 'billed'.",
            badge: "Billed",
            badgeVariant: "warning"
          },
          {
            title: "2. Collected & Held",
            description: "When the member pays the deposit invoice (M09), status flips to 'held' and money sits in 2100 Deposit Liability.",
            badge: "Held (2100)",
            badgeVariant: "success"
          },
          {
            title: "3. Move-Out Inspection",
            description: "At lease end (notice/completed/terminated), a completed move-out inspection (M18) catalogs any room damages.",
            badge: "Gate (M18)",
            badgeVariant: "info"
          },
          {
            title: "4. Settle: Deduct & Refund",
            description: "Staff posts deductions with uploaded evidence photos/reports, and refunds the remainder. Liability nets to 0 ('settled').",
            badge: "Settled",
            badgeVariant: "outline"
          }
        ]}
        tip="Deductions require an evidence document from the document registry. Unpaid rent deductions credit 1300 Receivable; damage/cleaning deductions credit 4900 Revenue."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Held (liability)" value={formatMinor(held)} sub={`${rows.length} deposit(s)`} />
        <StatCard label="Awaiting collection" value={awaiting} sub="deposit invoice open" />
        <StatCard label="Ready to settle" value={settling} sub="lease ended, money held" />
      </div>

      <form method="get" className="mb-4 flex items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="df-status" className="text-xs text-muted-foreground"><Tx>Status</Tx></label>
          <SearchableSelect
            id="df-status"
            name="status"
            defaultValue={sp.status ?? ""}
            options={[
              { value: "", label: "All" },
              { value: "pending", label: "pending" },
              { value: "billed", label: "billed" },
              { value: "held", label: "held" },
              { value: "settled", label: "settled" }
            ]}
            className="h-9 rounded-md border bg-background px-2"
            placeholder="All"
          />
        </div>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90">
          <Tx>Filter</Tx>
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
                      <div className="flex items-center gap-1.5">
                        <a href={`/invoices/${d.invoiceId}`} className="font-mono text-xs underline underline-offset-4 hover:underline">
                          {d.invoiceCode ?? "view"}
                        </a>
                        <Badge variant={d.collectedMinor >= d.requiredMinor ? "success" : "warning"} className="text-[10px] px-1 py-0">
                          {d.collectedMinor >= d.requiredMinor ? "paid" : "unpaid"}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground"><Tx>not billed</Tx></span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(d.requiredMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(d.collectedMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(d.deductedMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(d.refundedMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatMinor(d.remainingMinor)}</TableCell>
                  <TableCell className="text-right">
                    <DepositActions
                      deposit={{
                        id: d.id,
                        leaseId: d.leaseId,
                        leaseStatus: d.leaseStatus,
                        status: d.status,
                        remainingMinor: d.remainingMinor,
                        requiredMinor: d.requiredMinor,
                        collectedMinor: d.collectedMinor,
                        invoiceId: d.invoiceId,
                        invoiceCode: d.invoiceCode,
                        memberProfileId: d.member.id,
                        memberName: d.member.name
                      }}
                      canUpdate={canUpdate}
                      canRefund={canRefund}
                      canCollectPayment={canCollectPayment}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No deposits yet — deposits are billed automatically when a lease with deposit terms is activated.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Installments bill through invoices (pay them via Payments — oldest-first picks the deposit first). Deductions require an
        evidence document; refunds need Accountant approval. The 2100 liability nets to 0 once a closed lease is fully settled.</Tx>
      </p>
    </div>
  );
}
