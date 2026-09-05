import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { createChallenge } from "@/lib/auth/challenge";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 10, 60_000)) {
    return fail(429, "RATE_LIMITED", "Too many attempts, wait a minute");
  }
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { roles: { include: { role: true } } }
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail(401, "BAD_CREDENTIALS", "Invalid email or password");
  }
  if (user.status !== "active") {
    return fail(403, "USER_DISABLED", "This account is disabled");
  }

  // §M27: TOTP-enabled users must present a current code before a session is
  // minted — the password step alone returns a 5-minute signed challenge.
  if (user.totpEnabled && user.totpSecret) {
    return ok({ totpRequired: true, challenge: createChallenge(user.id) });
  }

  await createSession(user.id, { userAgent: req.headers.get("user-agent"), ip });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "login",
    entityType: "session",
    entityId: user.id,
    summary: `Signed in (${user.roles.map((ur) => ur.role.key).join(", ")})`,
    ip
  });

  const roles = user.roles.map((ur) => ur.role.key);
  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
    // Admin+ must complete TOTP enrollment before any other module capability
    // resolves (can()/hasModuleAccess() gate on the session user's flag).
    totpEnrollmentRequired: roles.some((r) => r === "SUPER_ADMIN" || r === "ADMIN") && !user.totpEnabled,
    // M34: an admin-set default/temporary password forces a change at next sign-in.
    mustChangePassword: user.mustChangePassword
  });
}
