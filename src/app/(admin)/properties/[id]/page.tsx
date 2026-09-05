import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { getOwnerLinkForUser } from "@/lib/owners";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { AddBuildingForm, BuildingSection } from "./building-section";
import type { RoomStatus } from "@/lib/rooms/status";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) notFound();

  const ownerLink = await getOwnerLinkForUser(user);
  let property = await prisma.property.findUnique({
    where: { id },
    include: {
      buildings: {
        orderBy: { createdAt: "asc" },
        include: {
          floors: {
            orderBy: { level: "asc" },
            include: {
              rooms: {
                orderBy: { number: "asc" },
                include: { beds: true }
              }
            }
          }
        }
      }
    }
  });
  if (!property) notFound();

  // Owner viewers: only buildings they own; others: standard resource check.
  const isOwnerViewer = Boolean(ownerLink) && !can(user, "read", "M04");
  if (isOwnerViewer) {
    const ownsAny = property.buildings.some((b) => ownerLink?.ownedBuildingIds.includes(b.id));
    if (!ownsAny) {
      return <EmptyState title="No access to this property" hint="Owners see only properties that contain buildings they own." />;
    }
  } else if (!can(user, "read", "M04", { propertyId: property.id })) {
    return <EmptyState title="No access to this property" hint="PROPERTY-scoped roles can only see assigned properties." />;
  }

  const canCreate = can(user, "create", "M04", { propertyId: property.id });
  const canUpdate = can(user, "update", "M04", { propertyId: property.id });

  const allBuildings = property.buildings;
  property = { ...property, buildings: isOwnerViewer ? allBuildings.filter((b) => ownerLink?.ownedBuildingIds.includes(b.id)) : allBuildings };
  const rooms = property.buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms));
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const occupancy = rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;
  const bookValue = rooms.reduce((s, r) => s + r.basePriceMinor, 0);

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/properties" className="underline underline-offset-4 hover:text-foreground">
          <Tx>Properties</Tx>
        </Link>{" "}
        / <span className="text-foreground">{property.code}</span>
      </div>
      <PageHeader
        title={property.name}
        description={property.address ?? undefined}
        actions={
          <>
            <Badge variant="secondary">{occupancy}% occupied</Badge>
            <Badge variant="outline">{rooms.length} rooms</Badge>
            <Badge variant="outline">{formatMinor(bookValue)} / mo book value</Badge>
          </>
        }
      />

      {property.buildings.length === 0 ? (
        <EmptyState title="No buildings yet" hint="Add a building, then floors, then rooms." />
      ) : (
        <div className="space-y-6">
          {property.buildings.map((b) => (
            <BuildingSection
              key={b.id}
              building={{
                id: b.id,
                name: b.name,
                floors: b.floors.map((f) => ({
                  id: f.id,
                  name: f.name,
                  level: f.level,
                  rooms: f.rooms.map((r) => ({
                    id: r.id,
                    number: r.number,
                    type: r.type,
                    status: r.status as RoomStatus,
                    basePriceMinor: r.basePriceMinor,
                    capacity: r.capacity,
                    notes: r.notes,
                    beds: r.beds.map((bd) => bd.label)
                  }))
                }))
              }}
              canCreate={canCreate}
              canUpdate={canUpdate}
            />
          ))}
        </div>
      )}

      {canCreate && !isOwnerViewer ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Add a building</CardTitle>
          </CardHeader>
          <CardContent>
            <AddBuildingForm propertyId={property.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
