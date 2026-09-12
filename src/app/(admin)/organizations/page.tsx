import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tx } from "@/components/i18n-text";
import { EditOrgModal, SwitchOrgButton, NewOrgModal } from "./org-actions";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  // Strict tenant scoping: only Platform Root super-admin can view/manage all organizations across the platform.
  // Tenant owners and admins are strictly scoped to their own organization.
  const isPlatformRoot = user.tenantId === "DEFAULT" && user.roles.includes("SUPER_ADMIN");
  const canCreate = isPlatformRoot;
  const canEdit = isPlatformRoot || user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN");

  const where = isPlatformRoot ? {} : { id: user.tenantId };

  const [tenants, currentTenant] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            properties: true,
            parties: true
          }
        },
        properties: {
          select: { id: true, name: true, code: true, status: true },
          take: 4
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        _count: {
          select: {
            users: true,
            properties: true,
            parties: true
          }
        }
      }
    })
  ]);

  const activeTenant = currentTenant ?? tenants[0] ?? {
    id: user.tenantId,
    name: user.tenantName ?? "Default Workspace",
    slug: user.tenantSlug ?? "default",
    contactEmail: null,
    status: "active",
    createdAt: new Date(),
    _count: { users: 1, properties: 0, parties: 0 }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Organizations & Multi-Tenancy"
          description="Manage workspace organizations, data partitions, and cross-tenant isolation."
        />
        <div className="flex items-center gap-2">
          {canCreate && <NewOrgModal canCreate={canCreate} />}
        </div>
      </div>

      {/* Current Workspace Hero Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                <Tx>Active Workspace</Tx>
              </span>
              <Badge variant={activeTenant.status === "active" ? "success" : "secondary"}>
                {activeTenant.status}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold">{activeTenant.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              <Tx>Slug:</Tx> <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{activeTenant.slug}</code> &bull; <Tx>ID:</Tx> <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{activeTenant.id}</code>
            </p>
          </div>
          <EditOrgModal
            tenant={{
              id: activeTenant.id,
              name: activeTenant.name,
              slug: activeTenant.slug,
              contactEmail: activeTenant.contactEmail,
              status: activeTenant.status
            }}
            canEdit={canEdit}
          />
        </CardHeader>
        <CardContent>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground"><Tx>Contact Email</Tx></p>
              <p className="mt-1 text-sm font-semibold truncate">{activeTenant.contactEmail || "—"}</p>
            </div>
            <div className="rounded-xl border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground"><Tx>Properties</Tx></p>
              <p className="mt-1 text-xl font-bold text-primary">{activeTenant._count.properties}</p>
            </div>
            <div className="rounded-xl border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground"><Tx>Users / Admins</Tx></p>
              <p className="mt-1 text-xl font-bold text-primary">{activeTenant._count.users}</p>
            </div>
            <div className="rounded-xl border bg-background/50 p-3">
              <p className="text-xs font-medium text-muted-foreground"><Tx>Members / Profiles</Tx></p>
              <p className="mt-1 text-xl font-bold text-primary">{activeTenant._count.parties}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Directory */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {isPlatformRoot ? <Tx>All Registered Organizations (Platform Overview)</Tx> : <Tx>Organization Workspace</Tx>}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {isPlatformRoot ? (
                  <Tx>Platform Root view: switch active context, audit partitions, and manage tenant organizations.</Tx>
                ) : (
                  <Tx>Your organization workspace partition and resource allocations.</Tx>
                )}
              </p>
            </div>
            <Badge variant="outline">{tenants.length} <Tx>organization(s)</Tx></Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="py-3 px-4"><Tx>Organization</Tx></th>
                  <th className="py-3 px-4"><Tx>Slug</Tx></th>
                  <th className="py-3 px-4"><Tx>Contact</Tx></th>
                  <th className="py-3 px-4"><Tx>Properties</Tx></th>
                  <th className="py-3 px-4"><Tx>Users</Tx></th>
                  <th className="py-3 px-4"><Tx>Status</Tx></th>
                  <th className="py-3 px-4 text-right"><Tx>Actions</Tx></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((t) => {
                  const isCurrent = t.id === user.tenantId;
                  return (
                    <tr key={t.id} className={isCurrent ? "bg-primary/5 font-medium" : "hover:bg-muted/20"}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span>{t.name}</span>
                          {isCurrent && (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5">
                              <Tx>Active</Tx>
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{t.slug}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{t.contactEmail ?? "—"}</td>
                      <td className="py-3 px-4">{t._count.properties}</td>
                      <td className="py-3 px-4">{t._count.users}</td>
                      <td className="py-3 px-4">
                        <Badge variant={t.status === "active" ? "success" : "secondary"}>
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPlatformRoot && !isCurrent && (
                            <SwitchOrgButton tenantId={t.id} tenantName={t.name} />
                          )}
                          <EditOrgModal
                            tenant={{
                              id: t.id,
                              name: t.name,
                              slug: t.slug,
                              contactEmail: t.contactEmail,
                              status: t.status
                            }}
                            canEdit={isPlatformRoot || (user.tenantId === t.id && (user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN")))}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
