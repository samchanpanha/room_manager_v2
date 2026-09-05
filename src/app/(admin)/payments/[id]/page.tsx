import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visiblePaymentScope, paymentInScope } from "@/lib/payments/visibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { PaymentActions } from "../payment-jobs";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  pending: "warning",
  confirmed: "success",
  refunded: "secondary",
  failed: "destructive"
};

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M09")) notFound();

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { member: { include: { party: true } }, allocations: { include: { invoice: true } } }
  });
  if (!payment) notFound();
  const scope = await visiblePaymentScope(user, user.permissions);
  if (!paymentInScope(payment, scope)) {
    return <EmptyState title="No access to this payment" hint="Payments are property-scoped (owners/members see their own)." />;
  }

  const activity = await prisma.auditLog.findMany({
    where: { entityType: "payment", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/payments" className="underline underline-offset-4 hover:text-foreground">
          <Tx>Payments</Tx>
        </Link>{" "}
        / <span className="text-foreground">{payment.code}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-2xl font-semibold tracking-tight">
            {payment.code}
            <Badge variant={STATUS_VARIANT[payment.status] ?? "secondary"}>{payment.status}</Badge>
            {payment.receiptCode ? <Badge variant="outline">{payment.receiptCode}</Badge> : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/members/${payment.memberProfileId}`} className="underline underline-offset-4">
              {payment.member.party.name}
            </Link>{" "}
            · {payment.method.replaceAll("_", " ")} <Tx>· received </Tx>{timeAgo(payment.receivedAt)}
          </p>
        </div>
        <PaymentActions
          paymentId={payment.id}
          status={payment.status}
          remainingMinor={payment.remainingMinor}
          canUpdate={can(user, "update", "M09", { propertyId: payment.propertyId ?? undefined })}
          canRefund={user.permissions.some((p) => p.module === "M09" && p.action === "update" && p.scope === "GLOBAL")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium"><Tx>Allocations (§9.5 — immutable after creation)</Tx></p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Invoice status</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/invoices/${a.invoiceId}`} className="font-mono text-xs underline underline-offset-4">
                        {a.invoice.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.invoice.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(a.amountMinor)}</TableCell>
                  </TableRow>
                ))}
                {payment.allocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-5 text-center text-sm text-muted-foreground"><Tx>
                      Not allocated — the full amount is member credit (refundable by an Accountant).
                    </Tx></TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><Tx>Allocated</Tx></span>
                  <span className="tabular-nums">{formatMinor(payment.amountMinor - payment.remainingMinor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><Tx>Member credit</Tx></span>
                  <span className="tabular-nums">{formatMinor(payment.remainingMinor)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span><Tx>Total</Tx></span>
                  <span className="tabular-nums">{formatMinor(payment.amountMinor)}</span>
                </div>
                {payment.refundedMinor > 0 ? (
                  <div className="flex justify-between text-destructive">
                    <span><Tx>Refunded</Tx></span>
                    <span className="tabular-nums">−{formatMinor(payment.refundedMinor)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium"><Tx>Timeline</Tx></p>
            <ul className="space-y-2.5">
              {activity.length === 0 ? <li className="text-sm text-muted-foreground"><Tx>No entries yet.</Tx></li> : null}
              {activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p>{a.summary}</p>
                    <p className="text-xs text-muted-foreground">{a.actorName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
