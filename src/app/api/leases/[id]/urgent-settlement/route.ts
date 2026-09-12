import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import {
  getUrgentSettlementPreview,
  executeUrgentSettlement,
  startUrgentSettlementQr
} from "@/lib/leases/urgent-settlement";

const bodySchema = z.object({
  departureDate: z.string().optional(),
  reason: z.string().min(3).max(500),
  earlyTerminationFee: z.coerce.number().min(0).optional(),
  damageFee: z.coerce.number().min(0).optional(),
  fastTrackInspection: z.boolean().optional(),
  settlementMode: z.enum(["direct_pay", "deposit_offset", "combo", "zero_due", "qr_pay"]).default("direct_pay"),
  paymentMethod: z.enum(["cash", "bank_transfer", "qr", "card", "cheque"]).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  provider: z.string().max(20).optional()
});

/// GET /api/leases/[id]/urgent-settlement — returns the financial preview & audit
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lease = await prisma.lease.findUnique({ where: { id }, select: { propertyId: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const g = await authorize("read", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;

  const url = new URL(req.url);
  const departureDate = url.searchParams.get("departureDate") ?? undefined;

  const result = await getUrgentSettlementPreview(id, departureDate);
  if (!result.ok) {
    return fail(result.code === "NOT_FOUND" ? 404 : 422, result.code, result.message);
  }

  return ok(result.data);
}

/// POST /api/leases/[id]/urgent-settlement — executes the urgent checkout & payment
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = await parseBody(req, bodySchema);
  if (parsed.response) return parsed.response;

  const lease = await prisma.lease.findUnique({ where: { id }, select: { propertyId: true } });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const g = await authorize("update", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;

  const d = parsed.data;

  const base = {
    departureDate: d.departureDate,
    reason: d.reason,
    earlyTerminationFeeMinor: d.earlyTerminationFee ? Math.round(d.earlyTerminationFee * 100) : undefined,
    damageFeeMinor: d.damageFee ? Math.round(d.damageFee * 100) : undefined,
    fastTrackInspection: d.fastTrackInspection
  };

  // QR-first: issue the final invoice and open a pending QR payment, return
  // the QR to display. The lease terminates only after the gateway webhook
  // confirms the payment (completeUrgentSettlementAfterPayment).
  if (d.settlementMode === "qr_pay") {
    const qr = await startUrgentSettlementQr(id, { ...base, provider: d.provider }, { id: g.user.id, name: g.user.name }, clientIp(req));
    if (!qr.ok) {
      const status = qr.code === "NOT_FOUND" ? 404 : 422;
      return fail(status, qr.code ?? "SETTLEMENT_FAILED", qr.message ?? "Failed to start QR settlement");
    }
    return ok(qr);
  }

  const result = await executeUrgentSettlement(
    id,
    {
      ...base,
      settlementMode: d.settlementMode,
      paymentMethod: d.paymentMethod,
      amountPaidMinor: d.amountPaid ? Math.round(d.amountPaid * 100) : undefined
    },
    { id: g.user.id, name: g.user.name },
    clientIp(req)
  );

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "OPEN_DUES_REMAINING" ? 422 : 400;
    return fail(status, result.code ?? "SETTLEMENT_FAILED", result.message ?? "Urgent settlement failed");
  }

  return ok(result);
}
