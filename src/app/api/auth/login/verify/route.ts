import { fail, ok, parseBody, clientIp } from "@/lib/api";
import { verifyChallenge } from "@/lib/auth/challenge";
import { verifyTotp } from "@/lib/auth/totp";
import { open as unseal } from "@/lib/crypto/sealed";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  challenge: z.string().min(10),
  code: z.string().regex(/^\d{6}$/)
});

/// §M27 second step of the TOTP login: challenge + current code → session.
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`login-verify:${ip}`, 10, 60_000)) {
    return fail(429, "RATE_LIMITED", "Too many attempts, wait a minute");
  }
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;
  const { email, challenge, code } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { roles: { include: { role: true } } }
  });
  if (!user || user.status !== "active" || !user.totpEnabled || !user.totpSecret) {
    return fail(401, "BAD_CREDENTIALS", "Invalid login request");
  }
  if (!verifyChallenge(challenge, user.id)) {
    return fail(401, "CHALLENGE_INVALID", "This login attempt expired — sign in again");
  }
  const secret = unseal(user.totpSecret);
  if (!secret || !verifyTotp(secret, code)) {
    return fail(401, "TOTP_INVALID", "That code is not valid");
  }

  await createSession(user.id, { userAgent: req.headers.get("user-agent"), ip });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M27",
    action: "login",
    entityType: "session",
    entityId: user.id,
    summary: "Signed in (TOTP second factor verified)",
    ip
  });
  return ok({ id: user.id, name: user.name, email: user.email, roles: user.roles.map((ur) => ur.role.key) });
}
