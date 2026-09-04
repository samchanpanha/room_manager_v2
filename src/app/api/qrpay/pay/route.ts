import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { verifyMemberToken } from "@/lib/qrpay/tokens";
import { prisma } from "@/lib/db";
import { createInvoiceQr } from "@/lib/qrpay/service";
import { GATEWAY_ACTOR } from "@/lib/payments/service";

const schema = z.object({
  m: z.string().min(10).max(200),
  invoiceId: z.string().min(1),
  provider: z.string().max(20).optional()
});

/// Public (poster flow, §M13): start a QR payment for one of the token
/// member's open invoices. The amount is ALWAYS the invoice's outstanding
/// due — no free-form amounts without login. Rate-limited.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`qrpay-pay:${ip}`, 10, 60_000)) return fail(429, "RATE_LIMITED", "Too many attempts — try again shortly");
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const memberId = verifyMemberToken(parsed.data.m);
  if (!memberId) return fail(401, "INVALID_TOKEN", "This QR is not valid");
  const invoice = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId }, select: { memberProfileId: true } });
  if (!invoice || invoice.memberProfileId !== memberId) return fail(404, "NOT_FOUND", "Invoice not found for this member");
  const result = await createInvoiceQr(parsed.data.invoiceId, GATEWAY_ACTOR, { provider: parsed.data.provider });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "NOTHING_DUE" || result.code === "INVOICE_VOID" || result.code === "ALREADY_SETTLED" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  return ok(result);
}
