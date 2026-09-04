import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { createSession } from "@/lib/auth/session";
import { verifyMemberOtp } from "@/lib/auth/member-otp";

const schema = z.object({ identifier: z.string().min(3).max(120), code: z.string().regex(/^\d{6}$/) });

/// §M25 OTP login step 2: on success the member's User (role MEMBER) is
/// ensured and a normal M01 session cookie is set — from here every portal
/// capability rides the existing module APIs with OWN scoping.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`portal-otp-ver:${ip}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many attempts — try again shortly");
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;

  const result = await verifyMemberOtp(parsed.data.identifier, parsed.data.code);
  if (!result.ok) {
    const status = result.code === "LOCKED" ? 429 : 401;
    return fail(status, result.code, result.message);
  }
  await createSession(result.userId, { userAgent: req.headers.get("user-agent"), ip: clientIp(req) });
  return ok({ name: result.memberName });
}
