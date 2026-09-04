import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { hasModuleAccess } from "@/lib/rbac/can";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { createMeter } from "@/lib/utilities/service";
import { isMeterType, METER_TYPES } from "@/lib/utilities/machines";
import { visiblePropertyScope, propertyInScope } from "@/lib/rbac/propscope";

/// M11 meters — scoped by the room's property (staff see their buildings).
export async function GET() {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M11")) return fail(403, "FORBIDDEN", "Missing permission M11:read");
  const meters = await prisma.meter.findMany({
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } },
      readings: { orderBy: { readAt: "desc" }, take: 1 },
      charges: { where: { status: "pending" }, select: { amountMinor: true, anomaly: true } }
    },
    orderBy: { code: "asc" }
  });
  const scope = await visiblePropertyScope(user, user.permissions, "M11");
  const visible = meters.filter((m) => propertyInScope(m.room.floor.building.propertyId, scope));
  return ok({
    meters: visible.map((m) => {
      const latest = m.readings[0] ?? null;
      return {
        id: m.id,
        code: m.code,
        type: m.type,
        unitLabel: m.unitLabel,
        room: { id: m.roomId, number: m.room.number, property: m.room.floor.building.property.name },
        isActive: m.isActive,
        latestReading: latest ? { valueMilli: latest.valueMilli, readAt: latest.readAt, estimated: latest.estimated } : null,
        pendingCharges: m.charges.length,
        pendingMinor: m.charges.reduce((s, c) => s + c.amountMinor, 0),
        hasAnomaly: m.charges.some((c) => c.anomaly)
      };
    }),
    types: METER_TYPES
  });
}

const createSchema = z.object({
  code: z.string().min(2).max(30),
  type: z.string().refine(isMeterType, "type must be elec, water or gas"),
  roomId: z.string().min(1),
  unitLabel: z.string().max(10).optional()
});

/// Register a meter on a room.
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId }, include: { floor: { include: { building: true } } } });
  if (!room) return fail(404, "NOT_FOUND", "Room not found");
  const g = await authorize("create", "M11", { propertyId: room.floor.building.propertyId });
  if (g.response) return g.response;
  const result = await createMeter(parsed.data, { id: g.user.id, name: g.user.name }, clientIp(req));
  if (!result.ok) {
    return fail(result.code === "NOT_FOUND" ? 404 : result.code === "DUPLICATE_CODE" || result.code === "INVALID_TYPE" ? 400 : 422, result.code, result.message);
  }
  return ok(result.data, 201);
}
