import { z } from "zod";
import { clientIp, fail, ok } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { getProviderSecret } from "@/lib/settings";
import { handlePaymentWebhook, GATEWAY_ACTOR } from "@/lib/payments/service";
import { resolveProvider, tryNormalizeWebhook } from "@/lib/qrpay/adapter";
import { prisma } from "@/lib/db";
import { completeUrgentSettlementAfterPayment } from "@/lib/leases/urgent-settlement";

const URGENT_QR_PREFIX = "URGENT:";

/// A confirmed QR-first urgent settlement (gatewayRef `URGENT:<leaseId>:…`)
/// finally terminates the lease — only here, so the lease stays open until the
/// gateway actually confirms the money (§M05 QR-first move-out).
async function maybeFinishUrgentSettlement(
  refs: { paymentId?: string; gatewayRef?: string; idempotencyKey?: string },
  receiptCode: string | null
): Promise<void> {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          ...(refs.paymentId ? [{ id: refs.paymentId }] : []),
          ...(refs.gatewayRef ? [{ gatewayRef: refs.gatewayRef }] : []),
          ...(refs.idempotencyKey ? [{ idempotencyKey: refs.idempotencyKey }] : []),
          ...(receiptCode ? [{ receiptCode }] : [])
        ]
      }
    });
    if (!payment || !payment.gatewayRef?.startsWith(URGENT_QR_PREFIX)) return;
    await completeUrgentSettlementAfterPayment(payment.id, GATEWAY_ACTOR);
  } catch {
    // Settlement completion is a side-effect of the webhook — never fail the
    // 200 ack because of it; the lease can be closed manually if needed.
  }
}

const genericSchema = z
  .object({
    paymentId: z.string().optional(),
    gatewayRef: z.string().optional(),
    idempotencyKey: z.string().optional(),
    status: z.enum(["confirmed", "failed"]),
    reason: z.string().max(500).optional()
  })
  .refine((d) => d.paymentId || d.gatewayRef || d.idempotencyKey, { message: "One of paymentId | gatewayRef | idempotencyKey is required" });

/// Gateway webhook (signed with the shared secret). Provider payloads
/// (provider field present) are normalized through the M13 adapter
/// (`handleWebhook` §M13); generic payloads take the §9.6 shape directly.
/// Duplicate notifications are ignored idempotently: replays return 200
/// { ignored: true } and never double-post or re-issue receipts.
export async function POST(req: Request) {
  // M27: webhook rate limiting + M28: DB-sealed secret overrides the env default
  if (!rateLimit(`webhook-pay:${clientIp(req)}`, 60, 60_000)) {
    return fail(429, "RATE_LIMITED", "Too many requests");
  }
  const secret = req.headers.get("x-webhook-secret");
  const expected = await getProviderSecret("paymentCredentials");
  if (!secret || !expected || secret !== expected) {
    return fail(401, "UNAUTHENTICATED", "Invalid webhook secret");
  }

  const raw = (await req.json().catch(() => null)) as unknown;
  let payload: z.infer<typeof genericSchema>;
  if (typeof raw === "object" && raw !== null && "provider" in raw) {
    const normalized = resolveProvider((raw as { provider?: string }).provider).parseWebhook(raw);
    if (!normalized) return fail(400, "INVALID_PAYLOAD", "Unrecognized provider webhook payload");
    payload = { gatewayRef: normalized.gatewayRef, idempotencyKey: normalized.idempotencyKey, status: normalized.status, reason: normalized.reason };
    if (!payload.gatewayRef && !payload.idempotencyKey) {
      return fail(400, "INVALID_PAYLOAD", "Provider webhook must reference a payment (ref/idempotencyKey)");
    }
  } else {
    const parsed = genericSchema.safeParse(raw);
    if (!parsed.success) {
      // Not the generic §9.6 shape — try normalizing a raw provider callback
      // (e.g. ABA PayWay posts merchant_trans_id/app_trans_id/ack without any
      // provider marker, so the provider is detected by content).
      const detected = tryNormalizeWebhook(raw);
      if (!detected) {
        const first = parsed.error.issues[0];
        return fail(400, "VALIDATION_ERROR", `${first.path.join(".")}: ${first.message}`);
      }
      payload = { gatewayRef: detected.gatewayRef, idempotencyKey: detected.idempotencyKey, status: detected.status, reason: detected.reason };
      if (!payload.gatewayRef && !payload.idempotencyKey) {
        return fail(400, "INVALID_PAYLOAD", "Provider webhook must reference a payment (ref/idempotencyKey)");
      }
    } else {
      payload = parsed.data;
    }
  }

  const result = await handlePaymentWebhook(payload, clientIp(req));
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "INVALID_TRANSITION" ? 422 : 400;
    return fail(status, result.code, result.message);
  }
  if (payload.status === "confirmed") {
    await maybeFinishUrgentSettlement(payload, result.receiptCode);
  }
  return ok({ received: true, ignored: result.ignored, paymentStatus: result.paymentStatus, receiptCode: result.receiptCode });
}
