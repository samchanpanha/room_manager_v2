import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { verifyMemberToken } from "@/lib/qrpay/tokens";
import { prisma } from "@/lib/db";

const schema = z.object({ m: z.string().min(10).max(200), paymentId: z.string().min(1) });

/// Public polling fallback (§M13 "confirmation via webhook + polling
/// fallback"): minimal status for a token-owned QR payment — no financial
/// detail beyond the payment state.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`qrpay-status:${ip}`, 120, 60_000)) return fail(429, "RATE_LIMITED", "Too many requests");
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const memberId = verifyMemberToken(parsed.data.m);
  if (!memberId) return fail(401, "INVALID_TOKEN", "This QR is not valid");
  const payment = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId }, select: { memberProfileId: true, status: true, code: true } });
  if (!payment || payment.memberProfileId !== memberId) return fail(404, "NOT_FOUND", "Payment not found");
  return ok({ status: payment.status, code: payment.code });
}
