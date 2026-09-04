import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { canTransition, isRoomStatus, transitionRequiresReason } from "@/lib/rooms/status";

const bodySchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).optional()
});

/// Room status machine transition (M04: transitions enforced + audited).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;
  const { to, reason } = parsed.data;

  if (!isRoomStatus(to)) return fail(400, "INVALID_STATUS", `Unknown room status: ${to}`);
  const room = await prisma.room.findUnique({ where: { id }, include: { floor: { include: { building: true } } } });
  if (!room) return fail(404, "NOT_FOUND", "Room not found");

  const g = await authorize("update", "M04", { propertyId: room.floor.building.propertyId });
  if (g.response) return g.response;

  const from = room.status;
  if (!isRoomStatus(from)) return fail(500, "CORRUPT_STATE", "Room has invalid status");
  if (!canTransition(from, to)) {
    return fail(422, "INVALID_TRANSITION", `Transition ${from} → ${to} is not allowed`);
  }
  if (transitionRequiresReason(to) && !reason) {
    return fail(400, "REASON_REQUIRED", "A reason is required when sending a room to maintenance");
  }

  const updated = await prisma.room.update({ where: { id }, data: { status: to } });
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M04",
    action: "update",
    entityType: "room_status",
    entityId: id,
    summary: `Room ${room.number}: ${from} → ${to}${reason ? ` (${reason})` : ""}`,
    propertyId: room.floor.building.propertyId,
    before: { status: from },
    after: { status: to },
    ip: clientIp(req)
  });
  await emitDomainEvent("room.status_changed", { roomId: id, from, to }, room.floor.building.propertyId);
  return ok(updated);
}
