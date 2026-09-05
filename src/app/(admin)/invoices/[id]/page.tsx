import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { timeAgo } from "@/lib/utils";
import { InvoiceActions } from "./invoice-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  draft: "secondary",
  issued: "info",
  partial_paid: "warning",
  paid: "success",
  overdue: "destructive",
  void: "outline"
};

const KIND_LABEL: Record<string, string> = {
  rent: "Rent",
  service: "Service",
  utility: "Utility",
  one_time: "One-time",
  late_fee: "Late fee",
  credit: "Credit"
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M07")) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      property: true,
      member: { include: { party: true } },
      lease: { include: { room: true } },
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
      creditNotes: { orderBy: { issuedAt: "desc" } }
    }
  });
  if (!invoice) notFound();
  if (!can(user, "read", "M07", { propertyId: invoice.propertyId })) {
    return <EmptyState title="No access to this invoice" hint="Invoices are property-scoped (owners/members see their own)." />;
  }

  const activity = await prisma.auditLog.findMany({
    where: { entityType: { in: ["invoice", "invoice_status", "invoice_late_fee", "invoice_dunning", "credit_note"] }, entityId: { in: [id, ...invoice.creditNotes.map((c) => c.id)] } },
    orderBy: { createdAt: "desc" },
    take: 12
  });

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/invoices" className="underline underline-offset-4 hover:text-foreground">
          <Tx>Invoices</Tx>
        </Link>{" "}
        / <span className="text-foreground">{invoice.code}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-mono text-2xl font-semibold tracking-tight">
            {invoice.code}
            <Badge variant={STATUS_VARIANT[invoice.status] ?? "secondary"}>
              {invoice.status.replaceAll("_", " ")}
              {invoice.dunningStage > 0 ? ` · dunning ${invoice.dunningStage}/3` : ""}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/members/${invoice.memberProfileId}`} className="underline underline-offset-4">
              {invoice.member.party.name}
            </Link>{" "}
            · {invoice.property.name}
            {invoice.lease ? (
              <>
                {" · "}
                <Link href={`/leases/${invoice.leaseId}`} className="underline underline-offset-4">
                  {invoice.lease.code}
                </Link>{" "}
                (room {invoice.lease.room.number})
              </>
            ) : null}
          </p>
        </div>
        <InvoiceActions
          invoice={{
            id: invoice.id,
            code: invoice.code,
            status: invoice.status,
            amountDueMinor: invoice.amountDueMinor
          }}
          flags={{
            canIssue: can(user, "update", "M07", { propertyId: invoice.propertyId }) && invoice.status === "draft",
            canVoid: can(user, "void", "M07", { propertyId: invoice.propertyId }),
            canCredit: can(user, "update", "M07", { propertyId: invoice.propertyId }) && ["issued", "partial_paid", "overdue"].includes(invoice.status)
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium"><Tx>Line items</Tx></p>
            <Table className="[&_th:first-child]:pl-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className={item.kind === "credit" ? "text-success" : ""}>{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMinor(item.unitMinor)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${item.kind === "credit" ? "text-success" : ""}`}>
                      {formatMinor(item.amountMinor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><Tx>Subtotal</Tx></span>
                  <span className="tabular-nums">{formatMinor(invoice.subtotalMinor)}</span>
                </div>
                {invoice.discountMinor > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><Tx>Discount</Tx></span>
                    <span className="tabular-nums">−{formatMinor(invoice.discountMinor)}</span>
                  </div>
                ) : null}
                {invoice.taxMinor > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><Tx>Tax</Tx></span>
                    <span className="tabular-nums">{formatMinor(invoice.taxMinor)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span><Tx>Total</Tx></span>
                  <span className="tabular-nums">{formatMinor(invoice.totalMinor)}</span>
                </div>
                {invoice.amountCreditedMinor > 0 || invoice.amountPaidMinor > 0 ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span><Tx>Paid so far</Tx></span>
                      <span className="tabular-nums">{formatMinor(invoice.amountPaidMinor)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span><Tx>Credited</Tx></span>
                      <span className="tabular-nums">{formatMinor(invoice.amountCreditedMinor)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-destructive">
                      <span><Tx>Amount due</Tx></span>
                      <span className="tabular-nums">{formatMinor(invoice.amountDueMinor)}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-right text-xs text-muted-foreground"><Tx>total = Σ items − discount + tax · enforced in engine, service and CI</Tx></p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-medium"><Tx>Details</Tx></p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><Tx>Period</Tx></dt>
                  <dd>
                    {invoice.periodStart.toISOString().slice(0, 10)} → {new Date(invoice.periodEnd.getTime() - 86_400_000).toISOString().slice(0, 10)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Issued</dt>
                  <dd>{invoice.issuedAt?.toISOString().slice(0, 10) ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><Tx>Due</Tx></dt>
                  <dd>{invoice.dueDate?.toISOString().slice(0, 10) ?? "—"}</dd>
                </div>
                {invoice.voidReason ? (
                  <div className="border-t pt-2">
                    <dt className="text-destructive"><Tx>Voided</Tx></dt>
                    <dd className="text-destructive">{invoice.voidReason}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {invoice.creditNotes.length > 0 ? (
            <Card>
              <CardContent className="p-5">
                <p className="mb-3 text-sm font-medium"><Tx>Credit notes</Tx></p>
                <ul className="divide-y text-sm">
                  {invoice.creditNotes.map((c) => (
                    <li key={c.id} className="py-2">
                      <p className="font-medium">
                        {c.code} · {formatMinor(c.amountMinor)}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.reason}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

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
    </div>
  );
}
