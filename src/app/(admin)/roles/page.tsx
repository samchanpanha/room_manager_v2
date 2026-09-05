import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NewRoleButton, DeleteRoleButton } from "./role-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await getAuthUser();
  if (!user || !can(user, "read", "M01")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Users & RBDC (M01)." />;
  }
  const canCreate = can(user, "create", "M01");
  const canDelete = can(user, "delete", "M01");

  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true, permissions: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }]
  });

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Dynamic RBDC — build any role by ticking the module × action grid"
        actions={canCreate ? <NewRoleButton /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Grants</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/roles/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                    {r.isProtected ? (
                      <Badge className="ml-2" variant="default">
                        protected
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.key}</TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r._count.permissions}</TableCell>
                  <TableCell className="text-right tabular-nums">{r._count.users}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/roles/${r.id}`}
                        className="rounded-md border border-input px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent"
                      >
                        <Tx>Edit grid</Tx>
                      </Link>
                      {canDelete && !r.isProtected ? <DeleteRoleButton id={r.id} name={r.name} inUse={r._count.users > 0} /> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Rules: a role in use cannot be deleted; Super Admin is protected; every grid change is audited and snapshot-tested in CI.</Tx>
      </p>
    </div>
  );
}
