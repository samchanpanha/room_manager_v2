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

  // Candidates: all non-blacklisted members (prospect, verified, active, notice).
  const members = await prisma.memberProfile.findMany({
    where: {
      party: { tenantId: user.tenantId },
      blacklisted: false,
      status: { not: "moved_out" }
    },
    include: { party: true },
    orderBy: { createdAt: "asc" }
  });

  const rooms = await prisma.room.findMany({
    where: {
      floor: { building: { property: { tenantId: user.tenantId } } },
      status: { in: ["vacant", "reserved", "occupied"] }
    },
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
    number: string;
    floorId: string;
    buildingId: string;
    propertyId: string;
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
      number: r.number,
      floorId: r.floor.id,
      buildingId: r.floor.buildingId,
      propertyId: r.floor.building.propertyId,
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

  const [catalog, parkingSlots, wifiAccounts] = await Promise.all([
    prisma.serviceCatalog.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.parkingSlot.findMany({ where: { status: "free", property: { tenantId: user.tenantId } }, orderBy: { code: "asc" } }),
    prisma.wifiAccount.findMany({ where: { status: "free", property: { tenantId: user.tenantId } }, orderBy: { ssid: "asc" } })
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New member lease" description="M05 — creates a draft; activation applies occupancy effects" />
      <NewLeaseForm
        members={members.map((m) => ({ id: m.id, label: `${m.party.name} (${m.status})`, status: m.status, name: m.party.name }))}
        properties={[...properties.values()]}
        buildings={[...buildings.values()]}
        floors={[...floors.values()]}
        rooms={roomViews}
        catalog={catalog.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          pricingModel: c.pricingModel,
          unitPriceMinor: c.unitPriceMinor,
          unitLabel: c.unitLabel
        }))}
        parkingSlots={parkingSlots.map((s) => ({
          id: s.id,
          code: s.code,
          propertyId: s.propertyId,
          monthlyFeeMinor: s.monthlyFeeMinor
        }))}
        wifiAccounts={wifiAccounts.map((w) => ({
          id: w.id,
          ssid: w.ssid,
          propertyId: w.propertyId,
          speedLabel: w.speedLabel
        }))}
      />
    </div>
  );
}
