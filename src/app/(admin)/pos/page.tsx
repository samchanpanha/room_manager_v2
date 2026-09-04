import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { PosActions } from "./pos-actions";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M14")) {
    return <EmptyState title="No access" hint="Your roles do not include read on POS (M14)." />;
  }
  const scopes = [...new Set(user.propertyIds)];
  const property = scopes.length > 0 ? await prisma.property.findUnique({ where: { id: scopes[0] } }) : null;

  const sessions = await prisma.posSession.findMany({
    where: scopes.length > 0 ? { propertyId: { in: scopes } } : {},
    include: { sales: true },
    orderBy: { openedAt: "desc" },
    take: 10
  });
  const openSession = sessions.find((s) => s.status === "open");

  const sales = await prisma.posSale.findMany({
    where: scopes.length > 0 ? { propertyId: { in: scopes } } : {},
    include: { items: true, member: { include: { party: true } } },
    orderBy: { createdAt: "desc" },
    take: 25
  });
  const products = await prisma.posProduct.findMany({ where: { isActive: true }, include: { stockItem: true }, orderBy: { name: "asc" } });
  const members = await prisma.memberProfile.findMany({ where: { status: { in: ["active", "verified", "notice"] } }, include: { party: true }, orderBy: { id: "asc" }, take: 100 });
  const visibleMembers = members.filter((m) => !m.homePropertyId || scopes.length === 0 || scopes.includes(m.homePropertyId));

  const canWrite = can(user, "create", "M14");

  return (
    <div>
      <PageHeader
        title="POS — Canteen & Store"
        description="M14 — cash / QR / card sales settle to the drawer (cash feeds the session's expected count); room_charge posts a one-time invoice line on the member's account; every sale decrements stock and files a receipt PDF"
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          {openSession ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <Badge variant="success">session open</Badge>{" "}
                <span className="text-muted-foreground">
                  opened {openSession.openedAt.toISOString().slice(5, 16).replace("T", " ")} · float {formatMinor(openSession.openingFloatMinor)} ·{" "}
                  {openSession.sales.length} sale(s) · cash expected {formatMinor(openSession.openingFloatMinor + openSession.sales.filter((s) => s.method === "cash").reduce((sum, s) => sum + s.totalMinor, 0))}
                </span>
              </div>
              {canWrite ? <PosActions mode="close" sessionId={openSession.id} expectedCashMinor={openSession.openingFloatMinor + openSession.sales.filter((s) => s.method === "cash").reduce((sum, s) => sum + s.totalMinor, 0)} /> : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">No open session{property ? ` for ${property.code}` : ""}.</span>
              {canWrite && property ? <PosActions mode="open" propertyId={property.id} /> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite && openSession ? <PosActions mode="sale" sessionId={openSession.id} products={products.map((p) => ({ id: p.id, label: `${p.name} · ${formatMinor(p.priceMinor)}`, unit: p.stockItem?.unit ?? "pcs", qty: (p.stockItem?.qtyMilli ?? 0) / 1000 }))} members={visibleMembers.map((m) => ({ id: m.id, label: m.party.name }))} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Paid via</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{s.code}</span>
                    <span className="block text-xs text-muted-foreground">{s.createdAt.toISOString().slice(5, 16).replace("T", " ")}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.items.map((i) => (
                      <span key={i.id} className="block">
                        {i.qtyMilli % 1000 === 0 ? i.qtyMilli / 1000 : (i.qtyMilli / 1000).toFixed(3)} × {i.name}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.method === "room_charge" ? "warning" : s.method === "cash" ? "secondary" : "info"}>{s.method.replace("_", " ")}</Badge>
                    {s.member ? <span className="block text-xs text-muted-foreground">{s.member.party.name}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinor(s.totalMinor)}</TableCell>
                  <TableCell>
                    {s.method === "room_charge" && s.invoiceId ? (
                      <a href={`/invoices/${s.invoiceId}`} className="text-xs underline underline-offset-4">
                        invoice →
                      </a>
                    ) : s.receiptDocId ? (
                      <Badge variant="outline">PDF</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No sales yet — open a session and ring one up.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Closing a session reports expected vs counted cash with the variance (§M14). Cash sales raise the expected drawer count; room charges
        appear as one-time lines on the member&apos;s invoice (visible under Invoices).
      </p>
    </div>
  );
}
