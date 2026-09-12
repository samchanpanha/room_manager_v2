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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tx } from "@/components/i18n-text";
import { ExportButton } from "@/components/export-button";
import { WorkflowGuide } from "@/components/workflow-guide";

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
      member: { party: { tenantId: user.tenantId } },
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

  const memberProfiles = await prisma.memberProfile.findMany({
    where: {
      party: { tenantId: user.tenantId },
      ...(scope === "ALL" ? {} : scope.propertyIds.length > 0 ? { homePropertyId: { in: scope.propertyIds } } : {})
    },
    include: {
      party: true,
      leases: {
        where: { status: { in: ["active", "draft"] } },
        select: { room: { select: { number: true } } },
        take: 1
      }
    },
    orderBy: { party: { name: "asc" } },
    take: 300
  });

  const memberOptions = memberProfiles.map((m) => {
    const room = m.leases[0]?.room?.number;
    const phone = m.party.phone;
    return {
      id: m.id,
      name: `${m.party.name}${room ? ` (Room ${room})` : ""}${phone ? ` · ${phone}` : ""}`
    };
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Collections against invoices — receipts numbered, allocations oldest-first, money through the ledger"
        actions={
          <div className="flex items-center gap-2">
            <ExportButton entity="payments" status={sp.status} />
            <RecordPaymentButton canCreate={can(user, "create", "M09")} initialMembers={memberOptions} />
          </div>
        }
      />

      <WorkflowGuide
        moduleKey="M09"
        title="How Payments & Collections Work"
        subtitle="Receipt recording, verification, invoice allocation, and ledger postings"
        steps={[
          {
            title: "1. Record Payment",
            description: "Front desk or clerk logs the money received (cash, bank transfer, qr, card, cheque) with status 'pending'.",
            badge: "Intake",
            badgeVariant: "secondary"
          },
          {
            title: "2. Verify & Confirm",
            description: "Staff confirms payment once verified against the physical till drawer or bank statement line.",
            badge: "Confirmed",
            badgeVariant: "info"
          },
          {
            title: "3. Allocation & Receipting",
            description: "System allocates money to open invoices (oldest-first or specific) and issues a gapless receipt (RCP-xxxx).",
            badge: "Allocated",
            badgeVariant: "warning"
          },
          {
            title: "4. Ledger Balanced",
            description: "Confirmation posts DR 1100 Cash / 1200 Bank and CR 1300 Rent Receivable. Any remainder stays as Member Credit.",
            badge: "Ledger",
            badgeVariant: "success"
          }
        ]}
        tip="If a payment has leftover unallocated money, it becomes Member Credit. Accountants can refund member credit directly."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected (confirmed)" value={formatMinor(collected)} sub={`${confirmed.length} payment(s)`} />
        <StatCard label="Pending" value={pendingCount} sub="awaiting confirmation" />
        <StatCard label="Unallocated member credit" value={formatMinor(credit)} sub="refundable by Accountant+" />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="pf-status" className="text-xs text-muted-foreground"><Tx>Status</Tx></label>
          <SearchableSelect
            id="pf-status"
            name="status"
            defaultValue={sp.status ?? ""}
            options={[
              { value: "", label: "All" },
              { value: "pending", label: "pending" },
              { value: "confirmed", label: "confirmed" },
              { value: "refunded", label: "refunded" },
              { value: "failed", label: "failed" }
            ]}
            className="h-9 rounded-md border bg-background px-2"
            placeholder="All"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pf-method" className="text-xs text-muted-foreground"><Tx>Method</Tx></label>
          <SearchableSelect
            id="pf-method"
            name="method"
            defaultValue={sp.method ?? ""}
            options={[
              { value: "", label: "All" },
              { value: "cash", label: "cash" },
              { value: "bank_transfer", label: "bank transfer" },
              { value: "qr", label: "qr" },
              { value: "card", label: "card" },
              { value: "cheque", label: "cheque" }
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
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No payments yet — record one (top right) or wait for portal/QR payments.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Partial payments set invoices to </Tx><span className="font-mono"><Tx>partial_paid</Tx></span><Tx>; allocations are immutable; refunds of
        member credit need Accountant approval and reverse via the ledger; gateway webhooks are idempotent (duplicates ignored).
      </Tx></p>
    </div>
  );
}
