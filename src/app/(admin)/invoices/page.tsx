import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visibleInvoicePropertyIds } from "@/lib/billing/visibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { JobsButtons } from "./jobs-buttons";
import { QrPayButton } from "./qr-pay";
import { formatMinor } from "@/lib/money";
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

export default async function InvoicesPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; propertyId?: string }>;
}) {
  const user = await getAuthUser();
  const ownMemberId = user?.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  if (!user || !hasModuleAccess(user, "read", "M07")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Invoices (M07)." />;
  }
  const sp = await searchParams;

  const scope = await visibleInvoicePropertyIds(user, user.permissions);
  if (scope !== "ALL" && scope.length === 0) {
    return (
      <div>
        <PageHeader title="Invoices" />
        <EmptyState title="No invoices visible" hint="Invoices are scoped by property (or your own records)." />
      </div>
    );
  }

  const memberScoped = scope !== "ALL" ? scope.filter((s) => s.startsWith("member:")).map((s) => s.slice(7)) : [];
  const propertyScoped = scope !== "ALL" ? scope.filter((s) => !s.startsWith("member:")) : undefined;

  const where = {
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.propertyId ? { propertyId: sp.propertyId } : propertyScoped ? { propertyId: { in: propertyScoped } } : {}),
    ...(memberScoped.length > 0
      ? { OR: [{ propertyId: { in: propertyScoped ?? [] } }, { memberProfileId: { in: memberScoped } }] }
      : {})
  };

  const [invoices, properties, totals] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { member: { include: { party: true } }, property: true, lease: true },
      orderBy: [{ periodStart: "desc" }, { code: "desc" }]
    }),
    prisma.property.findMany({ orderBy: { code: "asc" } }),
    prisma.invoice.aggregate({
      where: { ...where, status: { notIn: ["void", "draft"] } },
      _sum: { totalMinor: true, amountDueMinor: true }
    })
  ]);

  const billed = totals._sum.totalMinor ?? 0;
  const arrears = totals._sum.amountDueMinor ?? 0;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Billing documents composed by the rent engine (M06/M07)"
        actions={<JobsButtons canGenerate={can(user, "create", "M07")} canRunDaily={can(user, "update", "M06")} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Invoices shown" value={invoices.length} />
        <StatCard label="Billed (excl. void/draft)" value={formatMinor(billed)} />
        <StatCard label="Outstanding arrears" value={formatMinor(arrears)} sub="Σ amount due" />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1.5">
          <label htmlFor="f-status" className="text-sm font-medium">
            <Tx>Status</Tx>
          </label>
          <Select id="f-status" name="status" defaultValue={sp.status ?? ""}>
            <option value=""><Tx>All statuses</Tx></option>
            {["draft", "issued", "partial_paid", "paid", "overdue", "void"].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48 space-y-1.5">
          <label htmlFor="f-prop" className="text-sm font-medium">
            <Tx>Property</Tx>
          </label>
          <Select id="f-prop" name="propertyId" defaultValue={sp.propertyId ?? ""}>
            <option value=""><Tx>All properties</Tx></option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Tx>Filter</Tx>
        </button>
        <Link href="/invoices" className="pb-2 text-sm text-muted-foreground underline underline-offset-4">
          <Tx>Reset</Tx>
        </Link>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link href={`/invoices/${i.id}`} className="font-mono text-xs font-medium underline-offset-4 hover:underline">
                      {i.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/members/${i.memberProfileId}`} className="underline-offset-4 hover:underline">
                      {i.member.party.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.property.code}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.periodStart.toISOString().slice(0, 10)} → {new Date(i.periodEnd.getTime() - 86_400_000).toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.dueDate?.toISOString().slice(0, 10) ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[i.status] ?? "secondary"}>
                      {i.status.replaceAll("_", " ")}
                      {i.dunningStage > 0 ? ` · d${i.dunningStage}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(i.totalMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.status === "void" ? "—" : formatMinor(i.amountDueMinor)}
                  </TableCell>
                  <TableCell className="text-right">
                    {i.status !== "void" && i.amountDueMinor > 0 && (can(user, "create", "M13", { propertyId: i.propertyId }) || i.memberProfileId === ownMemberId) ? (
                      <QrPayButton invoiceId={i.id} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No invoices yet — run the generation job (top right) to bill all active leases.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Numbering </Tx><span className="font-mono">{"{PROP}-{YEAR}-{SEQ}"}</span> <Tx>is allocated gapless at issue time; issued invoices
        are immutable — corrections via credit notes; void requires Super Admin + reason. Dunning: +3/+7/+14 days past due.
      </Tx></p>
      <div className="mt-2 text-xs text-muted-foreground">
        <Link href="/rent-engine" className="underline underline-offset-4">
          <Tx>Rent engine rules →</Tx>
        </Link>
      </div>
    </div>
  );
}
