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

import { BACKEND_ENABLED } from "@/lib/backend/config";
import { api as backend } from "@/lib/backend/client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getAuthUser();
  if (!user || !can(user, "read", "M01")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Users & RBDC (M01)." />;
  }
  const canCreate = can(user, "create", "M01");
  const canUpdate = can(user, "update", "M01");

  let users: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    createdAt: Date;
    mustChangePassword?: boolean;
    roles: { roleId?: string | null; role?: { id: string; key: string; name: string } | null }[];
    assignments: { propertyId?: string | null; property?: { code: string } | null }[];
  }> = [];
  let roles: Array<{ id: string; name: string; key: string; isSystem: boolean; isProtected?: boolean }> = [];
  let properties: Array<{ id: string; name: string; code: string }> = [];

  if (BACKEND_ENABLED) {
    try {
      const [bUsers, bRoles, bProps] = await Promise.all([
        backend.users.list(),
        backend.roles.list(),
        backend.properties.list()
      ]);
      users = (bUsers as Array<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        status: string;
        createdAt?: string;
        roles?: { role?: { id: string; key: string; name: string } }[];
      }>).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        roles: (u.roles || []).map((r) => ({ role: r.role })),
        assignments: []
      }));
      roles = (bRoles as Array<{ id: string; name: string; key: string; isSystem: boolean; isProtected?: boolean }>).map((r) => ({
        id: r.id,
        name: r.name,
        key: r.key,
        isSystem: r.isSystem,
        isProtected: r.isProtected
      }));
      properties = (bProps as Array<{ id: string; name: string; code: string }>).map((p) => ({ id: p.id, name: p.name, code: p.code }));
    } catch {
      users = [];
      roles = [];
      properties = [];
    }
  } else {
    const [dbUsers, dbRoles, dbProperties] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId: user.tenantId },
        include: { roles: { include: { role: true } }, assignments: { include: { property: true } } },
        orderBy: { createdAt: "asc" }
      }),
      prisma.role.findMany({ where: { active: true }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
      prisma.property.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } })
    ]);
    users = dbUsers.map((du) => ({
      id: du.id,
      name: du.name,
      email: du.email,
      phone: null,
      status: du.status,
      createdAt: du.createdAt,
      mustChangePassword: du.mustChangePassword,
      roles: du.roles.map((ur) => ({ roleId: ur.roleId, role: ur.role })),
      assignments: du.assignments.map((a) => ({ propertyId: a.propertyId, property: a.property }))
    }));
    roles = dbRoles;
    properties = dbProperties;
  }

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
                        <Badge key={ur.roleId || ur.role?.id} variant={ur.role?.key === "SUPER_ADMIN" ? "default" : "secondary"}>
                          {ur.role?.name ?? ur.role?.key}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.assignments.length === 0 ? "All (global)" : u.assignments.map((a) => a.property?.code ?? a.propertyId).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "success" : "destructive"}>{u.status}</Badge>
                    {u.mustChangePassword && u.status === "active" ? (
                      <span className="block">
                        <Badge variant="warning"><Tx>must change password</Tx></Badge>
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                  {canUpdate ? (
                    <TableCell className="text-right">
                      <UserRowActions
                        target={{ id: u.id, name: u.name, status: u.status }}
                        roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key, isProtected: r.isProtected }))}
                        properties={properties.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
                        currentRoleIds={u.roles.map((ur) => ur.role?.id ?? ur.roleId ?? "")}
                        currentPropertyIds={u.assignments.map((a) => a.propertyId ?? "")}
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
