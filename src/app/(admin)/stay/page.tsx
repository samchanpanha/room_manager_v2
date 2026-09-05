import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StayManager } from "./stay-manager";

export const dynamic = "force-dynamic";

export default async function StayPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M32")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Short Stays (M32)." />;
  }
  const grants = user.permissions.filter((p) => p.module === "M32" && p.action === "read");
  const global = grants.some((g) => g.scope === "GLOBAL");
  const scopes = [...new Set(user.propertyIds)];
  const visibleProps = global ? (await prisma.property.findMany({ select: { id: true } })).map((p) => p.id) : scopes;

  const [modules, rates, bookings, rooms, properties] = await Promise.all([
    prisma.rentModule.findMany({
      include: { _count: { select: { bookings: true, rates: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.stayRateRule.findMany({ include: { module: { select: { name: true } } }, orderBy: [{ moduleId: "asc" }, { toMinutes: "asc" }] }),
    prisma.stayBooking.findMany({
      where: visibleProps.length > 0 ? { propertyId: { in: visibleProps } } : {},
      include: { room: { select: { number: true, type: true } }, module: { select: { name: true } }, tabInvoice: { select: { id: true, code: true, status: true, totalMinor: true, amountDueMinor: true } } },
      orderBy: [{ checkIn: "desc" }],
      take: 200
    }),
    prisma.room.findMany({
      where: visibleProps.length > 0 ? { floor: { building: { propertyId: { in: visibleProps } } } } : {},
      include: { floor: { include: { building: { include: { property: { select: { id: true, code: true } } } } } } },
      orderBy: [{ number: "asc" }]
    }),
    prisma.property.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } })
  ]);

  const canWrite = can(user, "create", "M32") || can(user, "update", "M32") || can(user, "delete", "M32");

  return (
    <div className="p-6">
      <PageHeader
        title="Short Stays"
        description="Hourly / overnight / day-use rentals — progressive-duration pricing, booking lifecycle and one settlement invoice with optional POS tab."
      />
      <StayManager
        modules={JSON.parse(JSON.stringify(modules))}
        rates={JSON.parse(JSON.stringify(rates))}
        bookings={JSON.parse(JSON.stringify(bookings))}
        rooms={JSON.parse(JSON.stringify(rooms))}
        properties={JSON.parse(JSON.stringify(properties))}
        canWrite={canWrite}
      />
    </div>
  );
}