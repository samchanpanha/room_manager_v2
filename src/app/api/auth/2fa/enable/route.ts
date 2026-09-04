import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { open as unseal } from "@/lib/crypto/sealed";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";

const bodySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

/// §M27 TOTP enrollment step 2: verify a current code, then switch 2FA on.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M27")) return fail(403, "FORBIDDEN", "Missing permission M27:update");
  if (!rateLimit(`2fa:${user.id}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many requests");

  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabled: true } });
  if (row.totpEnabled) return fail(409, "ALREADY_ENABLED", "2FA is already enabled");
  const secret = row.totpSecret ? unseal(row.totpSecret) : null;
  if (!secret) return fail(409, "NO_ENROLLMENT", "Start enrollment first");
  if (!verifyTotp(secret, parsed.data.code)) return fail(401, "TOTP_INVALID", "That code is not valid");

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "update",
    entityType: "user",
    entityId: user.id,
    summary: "TOTP 2FA enabled",
    ip
  });
  return ok({ enabled: true });
}
