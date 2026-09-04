import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { verifyMemberToken } from "@/lib/qrpay/tokens";
import { memberDuesForToken } from "@/lib/qrpay/service";

const schema = z.object({ m: z.string().min(10).max(200) });

/// Public (poster flow, §M13 pay-without-login): resolve a signed member QR
/// token into the member's open balances. Rate-limited; reveals nothing
/// beyond name + open invoice totals.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`qrpay-dues:${ip}`, 30, 60_000)) return fail(429, "RATE_LIMITED", "Too many requests — try again shortly");
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const memberId = verifyMemberToken(parsed.data.m);
  if (!memberId) return fail(401, "INVALID_TOKEN", "This QR is not valid");
  const dues = await memberDuesForToken(memberId);
  if (!dues) return fail(404, "NOT_FOUND", "Member not found");
  return ok(dues);
}
