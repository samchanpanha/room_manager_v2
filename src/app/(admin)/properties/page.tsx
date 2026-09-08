import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { getOwnerLinkForUser } from "@/lib/owners";
import { BACKEND_ENABLED } from "@/lib/backend/config";
import { api as backend, BackendError, type PropertyRow } from "@/lib/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NewPropertyButton } from "./new-property";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

/**
 * Frontend/backend split: when BACKEND_ORIGIN is set, this page sources its data
 * from the Spring Boot backend (RBDC scope + occupancy stats resolved
 * server-side in PropertyService). Otherwise it falls back to the legacy direct
 * Prisma path below, so the app runs unchanged until the backend is wired.
 */
async function loadFromBackend(): Promise<
  { rows: PropertyRow[] } | { forbidden: true }
> {
  try {
    const rows = await backend.properties.list();
    return { rows };
  } catch (e) {
    if (e instanceof BackendError && (e.status === 401 || e.status === 403)) {
      return { forbidden: true };
    }
    throw e;
  }
}

export default async function PropertiesPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M04")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Properties & Rooms (M04)." />;
  }

  // ---- Data source: backend (split) or legacy Prisma (monolith) -----------
  let rows: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    buildingCount: number;
    roomsTotal: number;
    roomsOccupied: number;
    assignedUsers: number | null;
  }[];

  if (BACKEND_ENABLED) {
    const result = await loadFromBackend();
    if ("forbidden" in result) {
      return <EmptyState title="No access" hint="Your roles do not include read on Properties & Rooms (M04)." />;
    }
    rows = result.rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      address: p.address,
      buildingCount: p.buildingCount,
      roomsTotal: p.roomsTotal,
      roomsOccupied: p.roomsOccupied,
      assignedUsers: null // assigned-user counts move to the backend in a later slice
    }));
  } else {
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

    const readsAllProperties = can(user, "read", "M04");
    let properties = allProperties;
    if (ownerLink && !readsAllProperties) {
      const ownedProps = new Set(
        (
          await prisma.building.findMany({
            where: { id: { in: ownerLink.ownedBuildingIds } },
            select: { propertyId: true }
          })
        ).map((b) => b.propertyId)
      );
      properties = allProperties.filter((p) => ownedProps.has(p.id));
    } else if (!readsAllProperties) {
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

    rows = properties.map((p) => {
      const s = stats.get(p.id) ?? { total: 0, occupied: 0 };
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        address: p.address,
        buildingCount: p._count.buildings,
        roomsTotal: s.total,
        roomsOccupied: s.occupied,
        assignedUsers: p._count.assignedUsers
      };
    });
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Physical inventory: properties → buildings → floors → rooms → beds"
        actions={can(user, "create", "M04") ? <NewPropertyButton /> : undefined}
      />
      {rows.length === 0 ? (
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
                {rows.map((p) => {
                  const pct = p.roomsTotal > 0 ? Math.round((p.roomsOccupied / p.roomsTotal) * 100) : 0;
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
                      <TableCell className="text-right tabular-nums">{p.buildingCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pct > 0 ? "success" : "secondary"}>{pct}%</Badge>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.roomsOccupied}/{p.roomsTotal}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.assignedUsers ?? "—"}</TableCell>
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
