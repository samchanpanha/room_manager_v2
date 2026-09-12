import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { verifyMemberToken } from "@/lib/qrpay/tokens";
import { createMemberPayAllQr } from "@/lib/qrpay/service";
import { GATEWAY_ACTOR } from "@/lib/payments/service";

const schema = z.object({
  m: z.string().min(10).max(200),
  provider: z.string().max(20).optional()
});

/// Public (poster flow, §M13): start ONE QR payment covering the token
/// member's entire outstanding balance (Σ all open invoices, §9.5 FIFO on
/// confirm). No free-form amounts without login. Rate-limited.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`qrpay-payall:${ip}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many attempts — try again shortly");
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const memberId = verifyMemberToken(parsed.data.m);
  if (!memberId) return fail(401, "INVALID_TOKEN", "This QR is not valid");
  const result = await createMemberPayAllQr(memberId, GATEWAY_ACTOR, { provider: parsed.data.provider });
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "NOTHING_DUE" || result.code === "ALREADY_SETTLED" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}