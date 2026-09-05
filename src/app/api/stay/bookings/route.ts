import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess, can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { createBooking, listBookings } from "@/lib/operations/stay-service";

const createSchema = z.object({
  moduleId: z.string().min(1),
  roomId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.coerce.number().int().positive().default(1),
  guestName: z.string().min(2).max(120),
  guestPhone: z.string().max(40).optional(),
  guestIdNumber: z.string().max(60).optional(),
  memberProfileId: z.string().optional(),
  depositMinor: z.coerce.number().int().nonnegative().default(0),
  posMode: z.enum(["direct", "tab"]).default("direct"),
  notes: z.string().max(500).optional()
});

const listSchema = z.object({
  status: z.string().default("all"),
  roomId: z.string().optional(),
  date: z.string().optional()
});

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");

  const url = new URL(req.url);
  const parsed = listSchema.safeParse({ status: url.searchParams.get("status") ?? "all", roomId: url.searchParams.get("roomId") ?? undefined, date: url.searchParams.get("date") ?? undefined });
  if (!parsed.success) return fail(400, "INVALID_QUERY", "Invalid query parameters");

  const from = parsed.data.date ? new Date(`${parsed.data.date}T00:00:00`) : undefined;
  const to = parsed.data.date ? new Date(new Date(`${parsed.data.date}T00:00:00`).getTime() + 86_400_000) : undefined;
  const bookings = await listBookings({ status: parsed.data.status, roomId: parsed.data.roomId, from, to });
  return ok({ bookings });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "create", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:create");
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;

  const room = await prisma.room.findUnique({ where: { id: parsed.data.roomId }, include: { floor: { include: { building: true } } } });
  if (!room) return fail(404, "NOT_FOUND", "Room not found");
  if (!can(user, "create", "M32", { propertyId: room.floor.building.propertyId })) return fail(403, "FORBIDDEN", "No create access to this property");

  const result = await createBooking(
    {
      moduleId: parsed.data.moduleId,
      roomId: parsed.data.roomId,
      checkIn: new Date(parsed.data.checkIn),
      checkOut: new Date(parsed.data.checkOut),
      guests: parsed.data.guests,
      guestName: parsed.data.guestName,
      guestPhone: parsed.data.guestPhone,
      guestIdNumber: parsed.data.guestIdNumber,
      memberProfileId: parsed.data.memberProfileId,
      depositMinor: parsed.data.depositMinor,
      posMode: parsed.data.posMode,
      notes: parsed.data.notes
    },
    { id: user.id, name: user.name }
  );
  if (!result.ok) return fail(result.code === "UNAVAILABLE" ? 409 : 400, result.code, result.message);
  return ok(result.data, 201);
}