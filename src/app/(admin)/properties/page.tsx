import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { getOwnerLinkForUser } from "@/lib/owners";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NewPropertyButton } from "./new-property";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M04")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Properties & Rooms (M04)." />;
  }

  const [allProperties, rooms, ownerLink] = await Promise.all([
    prisma.property.findMany({
      include: { _count: { select: { buildings: true, assignedUsers: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.room.findMany({
      select: { status: true, floor: { select: { building: { select: { propertyId: true } } } } }
    }),
    getOwnerLinkForUser(user)
  ]);

  // Data scoping: GLOBAL sees all · PROPERTY sees assigned · owner-link sees owned buildings' properties.
  const readsAllProperties = can(user, "read", "M04"); // true only for GLOBAL-scope grants
  let properties = allProperties;
  if (ownerLink && !readsAllProperties) {
    const ownedProps = new Set(
      (await prisma.building.findMany({ where: { id: { in: ownerLink.ownedBuildingIds } }, select: { propertyId: true } })).map((b) => b.propertyId)
    );
    properties = allProperties.filter((p) => ownedProps.has(p.id));
  } else if (!readsAllProperties) {
    // PROPERTY-scope without owner link
    properties = allProperties.filter((p) => user.propertyIds.includes(p.id));
  }

  const stats = new Map<string, { total: number; occupied: number }>();
  for (const r of rooms) {
    const pid = r.floor.building.propertyId;
    const s = stats.get(pid) ?? { total: 0, occupied: 0 };
    s.total += 1;
    if (r.status === "occupied") s.occupied += 1;
    stats.set(pid, s);
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Physical inventory: properties → buildings → floors → rooms → beds"
        actions={can(user, "create", "M04") ? <NewPropertyButton /> : undefined}
      />
      {properties.length === 0 ? (
        <EmptyState title="No properties yet" hint="Create your first property to start adding buildings and rooms." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Buildings</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">Assigned users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => {
                  const s = stats.get(p.id) ?? { total: 0, occupied: 0 };
                  const pct = s.total > 0 ? Math.round((s.occupied / s.total) * 100) : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/properties/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                          {p.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/properties/${p.id}`} className="underline-offset-4 hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground">{p.address ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{p._count.buildings}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pct > 0 ? "success" : "secondary"}>{pct}%</Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.occupied}/{s.total}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p._count.assignedUsers}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {can(user, "read", "M01") ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Tx>Tip: property scoping is enforced server-side — e.g. the demo Property Manager is assigned to BLR only and cannot
          mutate Riverside Villa, even via direct API calls.</Tx>
        </p>
      ) : null}
      <div className="mt-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          <Tx>← Dashboard</Tx>
        </Link>
      </div>
    </div>
  );
}
