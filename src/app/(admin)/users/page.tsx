import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { NewUserButton, UserRowActions } from "./user-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getAuthUser();
  if (!user || !can(user, "read", "M01")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Users & RBDC (M01)." />;
  }
  const canCreate = can(user, "create", "M01");
  const canUpdate = can(user, "update", "M01");

  const [users, roles, properties] = await Promise.all([
    prisma.user.findMany({
      include: { roles: { include: { role: true } }, assignments: { include: { property: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
    prisma.property.findMany({ orderBy: { code: "asc" } })
  ]);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Accounts, role assignments and property scoping"
        actions={canCreate ? <NewUserButton roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key }))} properties={properties.map((p) => ({ id: p.id, name: `${p.name} (${p.code})` }))} /> : undefined}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {canUpdate ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === user.id ? <span className="ml-1 text-xs text-muted-foreground"><Tx>(you)</Tx></span> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((ur) => (
                        <Badge key={ur.roleId} variant={ur.role.key === "SUPER_ADMIN" ? "default" : "secondary"}>
                          {ur.role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.assignments.length === 0 ? "All (global)" : u.assignments.map((a) => a.property.code).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "success" : "destructive"}>{u.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                  {canUpdate ? (
                    <TableCell className="text-right">
                      <UserRowActions
                        target={{ id: u.id, name: u.name, status: u.status }}
                        roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key, isProtected: r.isProtected }))}
                        properties={properties.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
                        currentRoleIds={u.roles.map((ur) => ur.roleId)}
                        currentPropertyIds={u.assignments.map((a) => a.propertyId)}
                        isSelf={u.id === user.id}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
