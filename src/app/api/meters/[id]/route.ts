import { fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";
import { prisma } from "@/lib/db";

/// M11 meter detail: readings history + charges (per-meter chart data).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M11")) return fail(403, "FORBIDDEN", "Missing permission M11:read");
  const meter = await prisma.meter.findUnique({
    where: { id },
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      readings: { orderBy: { readAt: "asc" } },
      charges: { orderBy: { createdAt: "desc" }, include: { lease: true } }
    }
  });
  if (!meter) return fail(404, "NOT_FOUND", "Meter not found");
  const scope = await visiblePropertyScope(user, user.permissions, "M11");
  if (!propertyInScope(meter.room.floor.building.propertyId, scope)) {
    return fail(403, "FORBIDDEN", "Meter outside your visible properties");
  }
  const readings = meter.readings.map((r, i) => ({
    id: r.id,
    readAt: r.readAt,
    valueMilli: r.valueMilli,
    consumptionMilli: i > 0 ? Math.max(0, r.valueMilli - meter.readings[i - 1].valueMilli) : 0,
    estimated: r.estimated,
    source: r.source,
    note: r.note
  }));
  return ok({
    meter: {
      id: meter.id,
      code: meter.code,
      type: meter.type,
      unitLabel: meter.unitLabel,
      room: { id: meter.roomId, number: meter.room.number, property: meter.room.floor.building.property.name }
    },
    readings,
    charges: meter.charges.map((c) => ({
      id: c.id,
      leaseCode: c.lease.code,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      consumptionMilli: c.consumptionMilli,
      amountMinor: c.amountMinor,
      tariffName: c.tariffName,
      status: c.status,
      anomaly: c.anomaly
    }))
  });
}
