import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { memberStatement } from "@/lib/ledger/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const REF_VARIANT: Record<string, "secondary" | "info" | "warning" | "destructive" | "success" | "outline"> = {
  invoice: "info",
  late_fee: "warning",
  credit_note: "secondary",
  invoice_void: "destructive",
  payment: "success",
  refund: "outline"
};

export default async function MemberStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) notFound();

  const globalRead = user.permissions.some((p) => p.module === "M08" && p.action === "read" && p.scope === "GLOBAL");
  if (!globalRead) {
    const own = user.partyId
      ? await prisma.memberProfile.findFirst({ where: { id, partyId: user.partyId } })
      : null;
    if (!own) notFound();
  }

  const member = await prisma.memberProfile.findUnique({ where: { id }, include: { party: true } });
  if (!member) notFound();
  const statement = await memberStatement(id);
  const invoices = await prisma.invoice.findMany({
    where: { memberProfileId: id, status: { in: ["issued", "partial_paid", "overdue"] } },
    orderBy: { dueDate: "asc" }
  });
  const openInvoices = invoices.filter((i) => i.amountDueMinor > 0);

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href={`/members/${id}`} className="underline underline-offset-4 hover:text-foreground">
          {member.party.name}
        </Link>{" "}
        / <span className="text-foreground"><Tx>Ledger statement</Tx></span>
      </div>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight"><Tx>Account statement</Tx></h1>
      <p className="mb-6 text-sm text-muted-foreground"><Tx>
        Every ledger posting on this member&apos;s account, oldest first · receivable balance runs on 1300 Rent
        Receivable · corrections appear as reversals
      </Tx></p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Current receivable" value={formatMinor(statement.receivableMinor)} sub="Σ DR − Σ CR on 1300" />
        <StatCard label="Open invoices" value={openInvoices.length} />
        <StatCard label="Postings" value={statement.rows.length} />
      </div>

      {openInvoices.length > 0 ? (
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium"><Tx>Open invoices</Tx></p>
            <ul className="space-y-1.5 text-sm">
              {openInvoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3">
                  <span>
                    <Link href={`/invoices/${i.id}`} className="font-mono text-xs underline underline-offset-4">
                      {i.code}
                    </Link>{" "}
                    <Badge variant={i.status === "overdue" ? "destructive" : "info"}>{i.status.replaceAll("_", " ")}</Badge>
                  </span>
                  <span className="tabular-nums">{formatMinor(i.amountDueMinor)} due</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Posting</TableHead>
                <HeadEntries />
                <TableHead className="text-right">Receivable after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.postedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={REF_VARIANT[r.refType] ?? "outline"}>{r.refType.replaceAll("_", " ")}</Badge>
                      <span className="text-sm">{r.memo}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      {r.entries.map((e, idx) => (
                        <span key={idx} className="font-mono">
                          {e.code} {e.debit > 0 ? `DR ${formatMinor(e.debit)}` : `CR ${formatMinor(e.credit)}`}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(r.totalMinor)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMinor(r.receivableAfter)}</TableCell>
                </TableRow>
              ))}
              {statement.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No ledger activity for this member yet.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function HeadEntries() {
  return <TableHead className="text-right">Total</TableHead>;
}
