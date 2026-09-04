import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";

const bodySchema = z.object({ userId: z.string().min(1) });

/// §M27/§15 v1.4c: security-config mutation — SUPER_ADMIN only. Clears the
/// target's TOTP enrollment (so they can re-enroll on next login) and revokes
/// their live sessions.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const actor = await getAuthUser();
  if (!actor) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!actor.isSuperAdmin) return fail(403, "FORBIDDEN", "Super Admin only");
  if (!rateLimit(`2fa-reset:${actor.id}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many requests");

  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const victim = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, name: true, email: true, totpEnabled: true } });
  if (!victim) return fail(404, "NOT_FOUND", "No such user");

  await prisma.user.update({ where: { id: victim.id }, data: { totpEnabled: false, totpSecret: null } });
  await prisma.session.updateMany({ where: { userId: victim.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M27",
    action: "update",
    entityType: "user",
    entityId: victim.id,
    summary: `TOTP 2FA reset for ${victim.email} by Super Admin (sessions revoked, re-enrollment required)`,
    ip
  });
  return ok({ reset: true });
}
