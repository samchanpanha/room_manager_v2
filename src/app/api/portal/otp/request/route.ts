import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { requestMemberOtp } from "@/lib/auth/member-otp";

const schema = z.object({ identifier: z.string().min(3).max(120) });

/// §M25 OTP login step 1. Deliberately generic: unknown identifiers get the
/// same shape without a code (no member enumeration, §M27 PII discipline).
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`portal-otp-req:${ip}`, 5, 60_000)) return fail(429, "RATE_LIMITED", "Too many attempts — try again shortly");
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;

  const result = await requestMemberOtp(parsed.data.identifier, clientIp(req));
  return ok({ delivered: result.delivered, ...(result.devCode ? { devCode: result.devCode } : {}) });
}
