import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess, can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { quoteStay } from "@/lib/operations/stay-service";

const quoteSchema = z.object({
  moduleId: z.string().min(1),
  roomId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.coerce.number().int().positive().default(1)
});

/// M32 pricing + pickup data for the stays form: active modules and rooms
/// (flat list with property + type) visible in scope; POST probes a price.
export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");

  const propertyId = new URL(req.url).searchParams.get("propertyId") ?? undefined;
  const [modules, rooms] = await Promise.all([
    prisma.rentModule.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, minDurationMinutes: true, maxDurationMinutes: true, minGuests: true, maxGuests: true } }),
    prisma.room.findMany({
      where: { ...(propertyId ? { floor: { building: { propertyId } } } : {}) },
      include: { floor: { include: { building: { include: { property: { select: { id: true, name: true, code: true } } } } } } },
      orderBy: [{ number: "asc" }]
    })
  ]);
  const scopedRooms = rooms.filter((r) => can(user, "read", "M32", { propertyId: r.floor.building.property.id }));
  return ok({ modules, rooms: scopedRooms.map((r) => ({ id: r.id, number: r.number, type: r.type, capacity: r.capacity, status: r.status, basePriceMinor: r.basePriceMinor, property: r.floor.building.property })) });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");
  const parsed = await parseBody(req, quoteSchema);
  if (parsed.response) return parsed.response;
  const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId }, include: { floor: { include: { building: { include: { property: true } } } } } });
  if (!room) return fail(404, "NOT_FOUND", "Room not found");
  if (!can(user, "read", "M32", { propertyId: room.floor.building.propertyId })) return fail(403, "FORBIDDEN", "No read access to this property");

  const result = await quoteStay(
    { moduleId: parsed.data.moduleId, roomId: parsed.data.roomId, checkIn: new Date(parsed.data.checkIn), checkOut: new Date(parsed.data.checkOut), guests: parsed.data.guests },
    new Date()
  );
  if (!result.ok) return fail(result.code === "NOT_FOUND" ? 404 : 400, result.code, result.message);
  return ok(result.data);
}