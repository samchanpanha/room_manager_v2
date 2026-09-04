/// Signed login challenges (M27): when a user has TOTP enabled, the password
/// step returns a short-lived challenge token instead of a session; the client
/// completes login by presenting the challenge + a current TOTP code.
/// Token = base64url(payload).hmac — payload {sub, exp}, 5-minute TTL.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;

function challengeSecret(): string {
  return process.env.AUTH_CHALLENGE_SECRET ?? process.env.FILE_SIGNING_SECRET ?? `dev-challenge-${randomBytes(16).toString("hex")}`;
}

function hmac(body: string): string {
  return createHmac("sha256", challengeSecret()).update(body).digest("base64url");
}

export function createChallenge(userId: string, ttlMs = TTL_MS): string {
  const body = JSON.stringify({ sub: userId, exp: Date.now() + ttlMs, n: randomBytes(6).toString("hex") });
  const b64 = Buffer.from(body).toString("base64url");
  return `${b64}.${hmac(b64)}`;
}

export function verifyChallenge(token: string, userId: string): boolean {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return false;
  const b64 = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = Buffer.from(hmac(b64));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { sub: string; exp: number };
    return payload.sub === userId && payload.exp > Date.now();
  } catch {
    return false;
  }
}
