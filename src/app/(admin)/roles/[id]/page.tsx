import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { ACTIONS, MODULES } from "@/lib/rbac/catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PermissionGrid } from "./permission-grid";

export const dynamic = "force-dynamic";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user || !can(user, "read", "M01")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Users & RBDC (M01)." />;
  }
  const canUpdate = can(user, "update", "M01");

  const role = await prisma.role.findUnique({
    where: { id },
    include: { permissions: true, _count: { select: { users: true } } }
  });
  if (!role) notFound();

  // current grid state: module → { actions: Set, scope }
  const current = MODULES.map((m) => {
    const rows = role.permissions.filter((p) => p.permissionId.startsWith(`${m.key}:`));
    const actions = [...new Set(rows.map((r) => r.permissionId.split(":")[1]))];
    const scope = rows[0]?.scope ?? "GLOBAL";
    return { module: m.key, actions, scope };
  }).filter((row) => row.actions.length > 0 || role.permissions.length === 0 ? true : true);

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/roles" className="underline underline-offset-4 hover:text-foreground">
          Roles
        </Link>{" "}
        / <span className="text-foreground">{role.name}</span>
      </div>
      <PageHeader
        title={`Permission grid — ${role.name}`}
        description={role.description ?? undefined}
        actions={
          <>
            <Badge variant="outline">{role._count.users} users</Badge>
            <Badge variant="outline">{role.permissions.length} grants</Badge>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module × action × scope</CardTitle>
          {role.isProtected ? (
            <p className="text-sm text-destructive">
              Super Admin is a protected role — it always holds full access and its grid cannot be edited.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Scope: GLOBAL = everywhere · PROPERTY = only assigned properties · OWN = own records only. Changes are audited and
              effective immediately (union across all roles of a user).
            </p>
          )}
        </CardHeader>
        <CardContent>
          <PermissionGrid
            roleId={role.id}
            modules={MODULES.map((m) => ({ key: m.key, name: m.name }))}
            actions={[...ACTIONS]}
            initial={current}
            disabled={!canUpdate || role.isProtected}
          />
        </CardContent>
      </Card>
    </div>
  );
}
