import { fail, ok, clientIp } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { generateTotpSecret, otpauthUri } from "@/lib/auth/totp";
import { seal } from "@/lib/crypto/sealed";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";
import { rateLimit } from "@/lib/ratelimit";
import QRCode from "qrcode";

/// §M27 TOTP enrollment step 1: mint (or re-mint) the sealed shared secret and
/// return the otpauth URI + QR data URL for the authenticator app.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M27")) return fail(403, "FORBIDDEN", "Missing permission M27:update");
  if (!rateLimit(`2fa:${user.id}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many requests");

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: seal(secret) } });
  const uri = otpauthUri(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabled: true } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "update",
    entityType: "user",
    entityId: user.id,
    summary: "TOTP enrollment started (secret sealed, not logged)",
    ip
  });
  return ok({ otpauth: uri, qrDataUrl, verified: row.totpEnabled });
}
