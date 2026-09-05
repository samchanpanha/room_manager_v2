import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMember, memberInvoice } from "@/lib/portal";
import { getT } from "@/lib/locale-server";
import { PayPanel } from "./pay-panel";

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/// §M25 invoice detail — line items, amounts, and the QR pay panel.
export default async function PortalInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ member }, { tUi }] = await Promise.all([requireMember(), getT()]);
  const invoice = await memberInvoice(member.id, id);
  if (!invoice) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{invoice.code}</h1>
        <Badge variant={invoice.status === "paid" ? "success" : "secondary"}>{invoice.status.replace("_", " ")}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {invoice.periodStart.toISOString().slice(0, 10)} – {invoice.periodEnd.toISOString().slice(0, 10)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-1.5">{item.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(item.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 text-muted-foreground">{tUi("Subtotal")}</td>
                <td className="pt-2 text-right tabular-nums">{money(invoice.subtotalMinor)}</td>
              </tr>
              {invoice.taxMinor > 0 ? (
                <tr>
                  <td className="text-muted-foreground">{tUi("Tax")}</td>
                  <td className="text-right tabular-nums">{money(invoice.taxMinor)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="pt-1 font-medium">{tUi("Due")}</td>
                <td className="pt-1 text-right font-semibold tabular-nums">{money(invoice.amountDueMinor)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {invoice.amountDueMinor > 0 ? <PayPanel invoiceId={invoice.id} amountMinor={invoice.amountDueMinor} /> : null}
    </div>
  );
}
