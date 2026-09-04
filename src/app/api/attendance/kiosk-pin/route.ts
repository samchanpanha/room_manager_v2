import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { pinHashFor } from "@/lib/operations/attendance-service";

const schema = z.object({
  userId: z.string().min(1).optional(), // omitted ⇒ set own PIN
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits")
});

/// Set a kiosk PIN (§M23 "kiosk PIN"): self-service for any authenticated
/// user; setting someone else's requires M23:update. Audited (hash never logged).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const targetId = parsed.data.userId && parsed.data.userId !== user.id ? parsed.data.userId : user.id;
  if (targetId !== user.id && !can(user, "update", "M23")) return fail(403, "FORBIDDEN", "Missing permission M23:update");
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, status: true } });
  if (!target) return fail(404, "NOT_FOUND", "User not found");
  await prisma.user.update({ where: { id: targetId }, data: { kioskPinHash: pinHashFor(parsed.data.pin) } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M23",
    action: "attendance.kiosk_pin_set",
    entityType: "user",
    entityId: targetId,
    summary: targetId === user.id ? "Kiosk PIN set (self)" : `Kiosk PIN set for ${target.name}`,
    ip: clientIp(req)
  });
  return ok({ userId: targetId, self: targetId === user.id }, 201);
}
