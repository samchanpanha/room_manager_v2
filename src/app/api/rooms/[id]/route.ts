import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toMinor } from "@/lib/money";

const patchSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  type: z.enum(["STANDARD", "DELUXE", "STUDIO", "SUITE"]).optional(),
  basePrice: z.coerce.number().min(0).max(1_000_000).optional(),
  capacity: z.coerce.number().int().min(1).max(8).optional(),
  notes: z.string().max(500).nullable().optional()
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, patchSchema);
  if (parsed.response) return parsed.response;

  const room = await prisma.room.findUnique({ where: { id }, include: { floor: { include: { building: true } } } });
  if (!room) return fail(404, "NOT_FOUND", "Room not found");

  const g = await authorize("update", "M04", { propertyId: room.floor.building.propertyId });
  if (g.response) return g.response;

  const d = parsed.data;
  const data = {
    number: d.number,
    type: d.type,
    basePriceMinor: d.basePrice === undefined ? undefined : toMinor(d.basePrice),
    capacity: d.capacity,
    notes: d.notes
  };
  const updated = await prisma.room.update({ where: { id }, data });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M04",
    action: "update",
    entityType: "room",
    entityId: id,
    summary: `Updated room ${updated.number}`,
    propertyId: room.floor.building.propertyId,
    before: { number: room.number, type: room.type, basePriceMinor: room.basePriceMinor, capacity: room.capacity },
    after: { number: updated.number, type: updated.type, basePriceMinor: updated.basePriceMinor, capacity: updated.capacity },
    ip: clientIp(req)
  });
  return ok(updated);
}
