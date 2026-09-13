/// M13 QR payment orchestration: dynamic QR per invoice (§M13). A "Pay by
/// QR" intent is just an M09 pending payment with method=qr, explicit
/// allocation to that invoice and a deterministic idempotency key — repeat
/// clicks reuse the SAME pending payment (and its gateway ref), so the QR is
/// stable and confirmation stays exactly-once (§M13 acceptance).
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { createPayment, getOpenMemberInvoices, openInvoicesTotalMinor } from "@/lib/payments/service";
import { getSettings } from "@/lib/settings";
import { resolveProvider, resolveDefaultProvider } from "./adapter";
import type { AbaQrConfig } from "./adapter";
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

  const { org, paymentGateway } = await getSettings(invoice.member?.party?.tenantId ?? "DEFAULT");
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

  const provider = resolveProvider(opts.provider ?? resolveDefaultProvider(paymentGateway));
  const charge = await provider.generateQR({
    amountMinor: due,
    ref: payment.gatewayRef ?? payment.code,
    orgAccount: org.name ?? "RentManager",
    ...(provider.name === "aba" ? { aba: paymentGateway.aba as AbaQrConfig } : {})
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
  const open = await getOpenMemberInvoices(memberProfileId);
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
    totalDueMinor: openInvoicesTotalMinor(open)
  };
}

/// A single "pay everything" QR: one pending payment for the member's TOTAL
/// outstanding balance (Σ all open invoices). Allocations are left empty so
/// confirmPayment applies FIFO coverage across every open invoice (§9.5) —
/// oldest first — with any subsisting excess landing as member credit. The
/// idempotency key is deterministic on the balance snapshot, so repeat clicks
/// (or a client retry after a failed gateway try) reuse/regenerate the same
/// intent exactly-once, mirroring createInvoiceQr (§M13).
export async function createMemberPayAllQr(
  memberProfileId: string,
  actor: ActorCtx,
  opts: { provider?: string } = {}
): Promise<InvoiceQrResult> {
  const member = await prisma.memberProfile.findUnique({ where: { id: memberProfileId }, include: { party: true } });
  if (!member) return { ok: false, code: "NOT_FOUND", message: "Member not found" };

  const open = await getOpenMemberInvoices(memberProfileId);
  const totalDueMinor = openInvoicesTotalMinor(open);
  if (totalDueMinor <= 0) return { ok: false, code: "NOTHING_DUE", message: "This member has no outstanding balance" };

  // Deterministic key per member + balance snapshot; skip past failed attempts
  // so a failed gateway try regenerates a fresh intent.
  let reused = false;
  let idempotencyKey = `QRALL:${memberProfileId}:${totalDueMinor}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (!existing) break;
    if (existing.status === "pending") {
      reused = true;
      break;
    }
    idempotencyKey = `QRALL:${memberProfileId}:${totalDueMinor}:r${attempt + 1}`;
  }

  const { org, paymentGateway } = await getSettings(member.party?.tenantId ?? "DEFAULT");
  const gatewayRef = `QRPAYALL-${randomBytes(5).toString("hex").toUpperCase()}`;

  const created = await createPayment(actor, {
    memberProfileId,
    method: "qr",
    amountMinor: totalDueMinor,
    idempotencyKey,
    gatewayRef
  });
  if (!created.ok) return { ok: false, code: created.code, message: created.message };

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
  if (payment.status !== "pending") {
    return { ok: false, code: "ALREADY_SETTLED", message: `This pay-all QR payment is already ${payment.status}` };
  }

  const provider = resolveProvider(opts.provider ?? resolveDefaultProvider(paymentGateway));
  const charge = await provider.generateQR({
    amountMinor: totalDueMinor,
    ref: payment.gatewayRef ?? payment.code,
    orgAccount: org.name ?? "RentManager",
    ...(provider.name === "aba" ? { aba: paymentGateway.aba as AbaQrConfig } : {})
  });

  return {
    ok: true,
    paymentId: payment.id,
    paymentCode: payment.code,
    amountMinor: totalDueMinor,
    provider: provider.name,
    qrString: charge.qrString,
    imageDataUrl: charge.imageDataUrl,
    expiresAt: charge.expiresAt,
    reused
  };
}
