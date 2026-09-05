import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PageHeader } from "@/components/ui/misc";
import { NewLeaseForm } from "./new-lease-form";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

export default async function NewLeasePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!can(user, "create", "M05")) {
    return (
      <div>
        <PageHeader title="New lease" />
        <p className="text-sm text-destructive"><Tx>Your roles do not include create on Leases (M05).</Tx></p>
      </div>
    );
  }

  // Candidates: verified/active members (KYC done), not blacklisted.
  const members = await prisma.memberProfile.findMany({
    where: { blacklisted: false, status: { in: ["verified", "active"] } },
    include: { party: true },
    orderBy: { createdAt: "asc" }
  });

  const rooms = await prisma.room.findMany({
    where: { status: { in: ["vacant", "reserved", "occupied"] } },
    include: {
      floor: { include: { building: { include: { property: true } } } },
      beds: true,
      leases: { where: { status: { in: ["draft", "active", "notice"] } }, select: { id: true, bedId: true } }
    },
    orderBy: { number: "asc" }
  });

  const properties = new Map<string, { id: string; label: string }>();
  const buildings = new Map<string, { id: string; label: string; propertyId: string }>();
  const floors = new Map<string, { id: string; label: string; buildingId: string }>();
  const roomViews: Array<{
    id: string;
    label: string;
    floorId: string;
    status: string;
    capacity: number;
    basePriceMinor: number;
    beds: Array<{ id: string; label: string; taken: boolean }>;
    wholeRoomFree: boolean;
  }> = [];

  for (const r of rooms) {
    const usableBeds = r.beds.map((b) => ({
      id: b.id,
      label: b.label,
      taken: r.leases.some((l) => l.bedId === b.id)
    }));
    const blocked = r.leases.some((l) => l.bedId === null);
    roomViews.push({
      id: r.id,
      label: `${r.floor.building.property.code}/${r.floor.building.name}/${r.number}`,
      floorId: r.floor.id,
      status: r.status,
      capacity: r.capacity,
      basePriceMinor: r.basePriceMinor,
      beds: usableBeds,
      wholeRoomFree: !blocked && r.leases.length === 0
    });
    floors.set(r.floor.id, { id: r.floor.id, label: r.floor.name, buildingId: r.floor.buildingId });
    buildings.set(r.floor.buildingId, {
      id: r.floor.buildingId,
      label: `${r.floor.building.property.code}/${r.floor.building.name}`,
      propertyId: r.floor.building.propertyId
    });
    properties.set(r.floor.building.propertyId, {
      id: r.floor.building.propertyId,
      label: `${r.floor.building.property.code} · ${r.floor.building.property.name}`
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New member lease" description="M05 — creates a draft; activation applies occupancy effects" />
      <NewLeaseForm
        members={members.map((m) => ({ id: m.id, label: `${m.party.name} (${m.status})` }))}
        properties={[...properties.values()]}
        buildings={[...buildings.values()]}
        floors={[...floors.values()]}
        rooms={roomViews}
      />
    </div>
  );
}
