import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { toMinor } from "@/lib/money";

const createSchema = z.object({
  floorId: z.string().min(1),
  prefix: z.string().max(8).default(""),
  start: z.coerce.number().int().min(1).max(999),
  count: z.coerce.number().int().min(1).max(40),
  beds: z.coerce.number().int().min(1).max(8).default(1),
  type: z.enum(["STANDARD", "DELUXE", "STUDIO", "SUITE"]).default("STANDARD"),
  basePrice: z.coerce.number().min(0).max(1_000_000)
});

/// Bulk room creation wizard (M04 acceptance).
export async function POST(req: Request) {
  const parsed = await parseBody(req, createSchema);
  if (parsed.response) return parsed.response;
  const floor = await prisma.floor.findUnique({ where: { id: parsed.data.floorId }, include: { building: true } });
  if (!floor) return fail(404, "NOT_FOUND", "Floor not found");

  const g = await authorize("create", "M04", { propertyId: floor.building.propertyId });
  if (g.response) return g.response;

  const { floorId, prefix, start, count, beds, type, basePrice } = parsed.data;
  const roomIds: string[] = [];
  const created = await prisma.$transaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      const number = `${prefix}-${String(start + i).padStart(2, "0")}`;
      const dupe = await tx.room.findUnique({ where: { floorId_number: { floorId, number } } });
      if (dupe) throw new Error(`Room ${number} already exists on this floor`);
      const room = await tx.room.create({
        data: { floorId, number, type, basePriceMinor: toMinor(basePrice), capacity: beds }
      });
      for (let b = 1; b <= beds; b++) {
        await tx.bed.create({ data: { roomId: room.id, label: beds > 1 ? `Bed ${b}` : "Single" } });
      }
      roomIds.push(room.id);
    }
    return roomIds.length;
  });

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M04",
    action: "create",
    entityType: "room",
    entityId: null,
    summary: `Bulk created ${created} rooms (${prefix}-${String(start).padStart(2, "0")}…${prefix}-${String(start + count - 1).padStart(2, "0")}) on ${floor.name}/${floor.building.name}`,
    propertyId: floor.building.propertyId,
    after: { roomIds, count: created, type, beds, basePriceMinor: toMinor(basePrice) },
    ip: clientIp(req)
  });
  await emitDomainEvent("rooms.bulk_created", { count: created, roomIds }, floor.building.propertyId);
  return ok({ created }, 201);
}
