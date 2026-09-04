import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { getOwnerLinkForUser } from "@/lib/owners";
import { canManageStatements, statementsScope } from "@/lib/operations/statements-scope";
import { StatementsActions } from "./statements-actions";

export const dynamic = "force-dynamic";

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M24")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Owner Statements (M24)." />;
  }
  const sp = await searchParams;
  const month = sp.month ?? "";
  const scope = await statementsScope(user);
  const rows = await prisma.ownerStatement.findMany({
    where: {
      ...(scope.ownerProfileId ? { ownerProfileId: scope.ownerProfileId } : {}),
      ...(scope.propertyIds ? { propertyId: { in: scope.propertyIds } } : {}),
      ...(month ? { month } : {})
    },
    include: {
      ownerProfile: { include: { party: { select: { name: true } } } },
      contract: { select: { code: true, model: true, sharePercent: true, fixedRentMinor: true } },
      building: { select: { name: true } },
      property: { select: { code: true } }
    },
    orderBy: [{ month: "desc" }, { code: "asc" }]
  });

  const canManage = canManageStatements(user);
  const payable = await prisma.ledgerAccount.findUnique({ where: { code: "2200" }, select: { id: true } });
  let payableBalance: number | null = null;
  if (payable) {
    const agg = await prisma.ledgerEntry.aggregate({ where: { accountId: payable.id }, _sum: { debit: true, credit: true } });
    payableBalance = (agg._sum.credit ?? 0) - (agg._sum.debit ?? 0);
  }
  void getOwnerLinkForUser;

  const drafts = rows.filter((r) => r.status === "draft");
  const approved = rows.filter((r) => r.status === "approved");

  return (
    <div>
      <PageHeader
        title="Owner Statements"
        description="M24 — generation (contract payout day) → draft → approved (accrual DR 3900 / CR 2200) → paid (payout DR 2200 / CR cash|bank, Owner Payable nets to 0) → PDF to M17 → owner portal"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="outline">{rows.length} statement(s){month ? ` · ${month}` : ""}</Badge>
        <Badge variant={drafts.length > 0 ? "warning" : "outline"}>drafts: {drafts.length}</Badge>
        <Badge variant={approved.length > 0 ? "info" : "outline"}>awaiting payout: {approved.length}</Badge>
        {payableBalance != null ? <Badge variant={payableBalance === 0 ? "success" : "secondary"}>Owner Payable balance: {formatMinor(payableBalance)}</Badge> : null}
        <form className="ml-auto flex items-center gap-2" action="/statements" method="get">
          <input type="month" name="month" defaultValue={month} className="h-8 rounded-md border bg-transparent px-2 text-xs" />
          <button type="submit" className="h-8 rounded-md border px-2 text-xs hover:bg-accent">
            Filter month
          </button>
        </form>
      </div>

      {scope.ownerProfileId ? null : (
        <StatementsActions
          canManage={canManage}
          drafts={drafts.map((d) => ({ id: d.id, label: `${d.code} · ${d.ownerProfile.party.name} · ${formatMinor(d.netMinor)}` }))}
          approved={approved.map((d) => ({ id: d.id, label: `${d.code} · ${d.ownerProfile.party.name} · ${formatMinor(d.netMinor)}` }))}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statement</TableHead>
                <TableHead>Owner / contract</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Gross share</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Passthrough</TableHead>
                <TableHead className="text-right">Maint.</TableHead>
                <TableHead className="text-right">± Adj</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    {s.code}
                    <span className="block text-muted-foreground">{s.month} · {s.property.code} / {s.building.name}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.ownerProfile.party.name}
                    <span className="block text-muted-foreground">
                      {s.contract.code} · {s.contract.model === "FIXED_RENT" ? "fixed" : `${s.contract.sharePercent}% share`}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatMinor(s.collectedMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatMinor(s.grossShareMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{s.managementFeeMinor ? `−${formatMinor(s.managementFeeMinor)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{s.passthroughMinor ? `−${formatMinor(s.passthroughMinor)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{s.ownerMaintenanceMinor ? `−${formatMinor(s.ownerMaintenanceMinor)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{s.adjustmentsMinor ? `${s.adjustmentsMinor > 0 ? "+" : "−"}${formatMinor(Math.abs(s.adjustmentsMinor))}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatMinor(s.netMinor)}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "paid" ? "success" : s.status === "approved" ? "info" : "warning"}>
                      {s.status}{s.paidVia ? ` · ${s.paidVia}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.status === "draft" ? (
                      <span className="text-xs text-muted-foreground">on approval</span>
                    ) : (
                      <a href={`/api/statements/${s.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs underline">
                        PDF
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                    No statements yet — run the generation job for a month.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Formula (per contract model): collected revenue for the owner&apos;s units × revenue share — or fixed master rent — minus
        management fee, pass-through expenses and owner-borne maintenance, ± audited adjustments. Approval accrues Owner
        Payable (DR 3900 Owner Distributions / CR 2200); the payout settles it (DR 2200 / CR cash|bank, refType `payout`) so
        Owner Payable returns to 0 and the §M20 P&L payout term equals the cash distributed.
      </p>
    </div>
  );
}
