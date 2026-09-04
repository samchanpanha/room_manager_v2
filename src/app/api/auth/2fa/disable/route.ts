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

/// §M27: 2FA is mandatory for Admin+ (§15 v1.4a) — non-admin users may disable
/// it with a current code; admins must go through SUPER_ADMIN admin-reset.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M27")) return fail(403, "FORBIDDEN", "Missing permission M27:update");
  if (!rateLimit(`2fa:${user.id}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many requests");
  if (user.roles.some((r) => r === "SUPER_ADMIN" || r === "ADMIN")) {
    return fail(403, "TWO_FACTOR_MANDATORY", "2FA is mandatory for Admin+ — ask a Super Admin for a reset");
  }

  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabled: true } });
  if (!row.totpEnabled || !row.totpSecret) return fail(409, "NOT_ENABLED", "2FA is not enabled");
  const secret = unseal(row.totpSecret);
  if (!secret || !verifyTotp(secret, parsed.data.code)) return fail(401, "TOTP_INVALID", "That code is not valid");

  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "update",
    entityType: "user",
    entityId: user.id,
    summary: "TOTP 2FA disabled (self-service, code verified)",
    ip
  });
  return ok({ enabled: false });
}
