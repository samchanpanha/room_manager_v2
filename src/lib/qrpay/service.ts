/// M13 QR payment orchestration: dynamic QR per invoice (§M13). A "Pay by
/// QR" intent is just an M09 pending payment with method=qr, explicit
/// allocation to that invoice and a deterministic idempotency key — repeat
/// clicks reuse the SAME pending payment (and its gateway ref), so the QR is
/// stable and confirmation stays exactly-once (§M13 acceptance).
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createPayment } from "@/lib/payments/service";
import { resolveProvider } from "./adapter";
import type { ActorCtx } from "@/lib/payments/service";

export type InvoiceQrResult =
  | {
      ok: true;
      paymentId: string;
      paymentCode: string;
      amountMinor: number;
      provider: string;
      qrString: string;
      imageDataUrl: string;
      expiresAt: Date;
      reused: boolean;
    }
  | { ok: false; code: string; message: string };

/// Build (or reuse) the pending QR payment for an invoice and render its QR.
export async function createInvoiceQr(
  invoiceId: string,
  actor: ActorCtx,
  opts: { provider?: string } = {}
): Promise<InvoiceQrResult> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { member: { include: { party: true } } } });
  if (!invoice) return { ok: false, code: "NOT_FOUND", message: "Invoice not found" };
  if (invoice.status === "void") return { ok: false, code: "INVOICE_VOID", message: "This invoice was voided" };
  const due = invoice.amountDueMinor;
  if (due <= 0) return { ok: false, code: "NOTHING_DUE", message: "This invoice has no outstanding balance" };

  // Deterministic key per invoice + due snapshot; skip past failed attempts
  // so a failed gateway try regenerates a fresh intent.
  let reused = false;
  let idempotencyKey = `QR:${invoice.id}:${due}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (!existing) break;
    if (existing.status === "pending") {
      reused = true;
      break;
    }
    idempotencyKey = `QR:${invoice.id}:${due}:r${attempt + 1}`;
  }

  const org = await prisma.setting.findUnique({ where: { key: "org.profile" } });
  const orgProfile = org ? (JSON.parse(org.value) as { name?: string }) : {};
  const gatewayRef = `QRPAY-${randomBytes(5).toString("hex").toUpperCase()}`;

  const created = await createPayment(actor, {
    memberProfileId: invoice.memberProfileId,
    method: "qr",
    amountMinor: due,
    allocations: [{ invoiceId: invoice.id, amountMinor: due }],
    idempotencyKey,
    gatewayRef
  });
  if (!created.ok) return { ok: false, code: created.code, message: created.message };

  const paymentId = created.paymentId;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "pending") {
    return { ok: false, code: "ALREADY_SETTLED", message: `This QR payment is already ${payment.status}` };
  }
  void reused;

  const provider = resolveProvider(opts.provider);
  const charge = await provider.generateQR({
    amountMinor: due,
    ref: payment.gatewayRef ?? payment.code,
    orgAccount: orgProfile.name ?? "RentManager"
  });
  return {
    ok: true,
    paymentId: payment.id,
    paymentCode: payment.code,
    amountMinor: due,
    provider: provider.name,
    qrString: charge.qrString,
    imageDataUrl: charge.imageDataUrl,
    expiresAt: charge.expiresAt,
    reused
  };
}

/// Public /pay page data for a member token (name + open balances only).
export async function memberDuesForToken(memberProfileId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberProfileId },
    include: { party: true }
  });
  if (!member) return null;
  const open = await prisma.invoice.findMany({
    where: { memberProfileId, status: { in: ["issued", "partial_paid", "overdue"] }, amountDueMinor: { gt: 0 } },
    orderBy: { dueDate: "asc" },
    select: { id: true, code: true, status: true, dueDate: true, totalMinor: true, amountDueMinor: true, periodStart: true, periodEnd: true }
  });
  return {
    member: { id: member.id, name: member.party.name },
    invoices: open.map((i) => ({
      id: i.id,
      code: i.code,
      status: i.status,
      dueDate: i.dueDate,
      totalMinor: i.totalMinor,
      amountDueMinor: i.amountDueMinor,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd
    })),
    totalDueMinor: open.reduce((s, i) => s + i.amountDueMinor, 0)
  };
}
