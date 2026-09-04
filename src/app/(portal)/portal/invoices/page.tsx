import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireMember, memberOpenInvoices } from "@/lib/portal";

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  paid: "success",
  partial_paid: "warning",
  overdue: "destructive",
  issued: "secondary"
};

/// §M25 invoices — the member's open invoices only (OWN by construction).
export default async function PortalInvoicesPage() {
  const { member } = await requireMember();
  const invoices = await memberOpenInvoices(member.id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Rent & invoices</h1>
      {invoices.length === 0 ? (
        <EmptyState title="Nothing due" hint="Open invoices appear here when they are issued." />
      ) : (
        invoices.map((inv) => (
          <Link key={inv.id} href={`/portal/invoices/${inv.id}`} className="block">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{inv.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.periodStart.toISOString().slice(0, 10)} – {inv.periodEnd.toISOString().slice(0, 10)}
                    {inv.dueDate ? ` · due ${inv.dueDate.toISOString().slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{money(inv.amountDueMinor)}</p>
                  <Badge variant={STATUS_VARIANT[inv.status] ?? "secondary"}>{inv.status.replace("_", " ")}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
