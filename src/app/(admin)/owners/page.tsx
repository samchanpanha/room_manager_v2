import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { visibleOwnerIdsFilter } from "@/lib/owners";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button-styles";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M03")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Owners (M03)." />;
  }

  const scope = await visibleOwnerIdsFilter(user, user.permissions);
  if (scope !== "ALL" && scope.ownerProfileIds.length === 0) {
    // Owner-role users are redirected to their portal instead of an empty list.
    if (user.roles.includes("OWNER")) {
      return (
        <EmptyState
          title="No owner record linked to your login"
          hint="Ask an administrator to bind your account to an owner profile."
        />
      );
    }
    return <EmptyState title="No owners visible" hint="PROPERTY-scoped roles see owners of buildings in their assigned properties." />;
  }

  const rows = await prisma.ownerProfile.findMany({
    where: scope === "ALL" ? undefined : { id: { in: scope.ownerProfileIds } },
    include: {
      party: { include: { users: { take: 1 } } },
      buildings: { include: { property: true } },
      payoutMethods: true
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <div>
      <PageHeader
        title="Owners"
        description="Landlords whose buildings are managed — payout details and portal access"
        actions={
          can(user, "create", "M03") ? (
            <Link href="/owners/new" className={buttonClassName()}>
              <Tx>+ New owner</Tx>
            </Link>
          ) : undefined
        }
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Buildings</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Portal login</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const primary = o.payoutMethods.find((m) => m.isPrimary) ?? o.payoutMethods[0];
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/owners/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                        {o.party.name}
                      </Link>
                      {o.companyName ? <p className="text-xs text-muted-foreground">{o.companyName}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={o.status === "active" ? "success" : "secondary"}>{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.buildings.length === 0
                        ? "—"
                        : o.buildings.map((b) => `${b.property.code}/${b.name}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {primary ? `${primary.kind} ••••${primary.accountNumber.slice(-4)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.party.users[0]?.email ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
