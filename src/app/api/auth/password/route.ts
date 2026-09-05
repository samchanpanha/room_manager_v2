import { z } from "zod";
import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  password: z.string().min(8).max(100)
});

/// M34 self-service password change — any signed-in user may rotate their own
/// password. Clearing the `mustChangePassword` flag releases the forced
/// change screen; other sessions are revoked so the new secret is actually in
/// force everywhere.
export async function POST(req: Request) {
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) return fail(401, "UNAUTHENTICATED", "Account not found");
  if (!verifyPassword(parsed.data.currentPassword, row.passwordHash)) {
    return fail(422, "WRONG_PASSWORD", "Current password is incorrect");
  }
  if (verifyPassword(parsed.data.password, row.passwordHash)) {
    return fail(422, "SAME_PASSWORD", "New password must differ from the current one");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(parsed.data.password), mustChangePassword: false } }),
    prisma.session.updateMany({
      where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M01",
    action: "password_changed",
    entityType: "user",
    entityId: user.id,
    summary: "Changed own password (other sessions revoked)",
    ip: clientIp(req)
  });
  await emitDomainEvent("user.password_changed", { userId: user.id });

  return ok({ changed: true });
}