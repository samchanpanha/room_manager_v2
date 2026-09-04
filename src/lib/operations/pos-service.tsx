/// M14 POS service — sessions (open/close with expected-vs-counted variance),
/// sales (cash/qr/card settle to the drawer; `room_charge` issues a one-time
/// invoice on the member's account), stock decrement (M15) and receipt PDFs
/// auto-filed to M17 (§M14 "receipt printing").
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { postTransaction } from "@/lib/ledger/service";
import { ACC } from "@/lib/ledger/accounts";
import type { ActorCtx } from "@/lib/payments/service";
import * as React from "react";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const HEAVY_TX = { timeout: 20000, maxWait: 10000 };

const DRAIN_ACCOUNT: Record<string, string> = { cash: ACC.CASH, qr: ACC.BANK, card: ACC.BANK };

/// Open a cash-drawer session (one open session per property at a time).
export async function openSession(
  input: { propertyId: string; openingFloatMinor: number },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string; expectedCashMinor: number }>> {
  if (!Number.isInteger(input.openingFloatMinor) || input.openingFloatMinor < 0) {
    return { ok: false, code: "INVALID_FLOAT", message: "openingFloatMinor must be a non-negative integer" };
  }
  const open = await prisma.posSession.findFirst({ where: { propertyId: input.propertyId, status: "open" } });
  if (open) return { ok: false, code: "SESSION_OPEN", message: `Session ${open.id.slice(-6)} is still open — close it first` };
  const session = await prisma.posSession.create({
    data: { propertyId: input.propertyId, status: "open", openingFloatMinor: input.openingFloatMinor, expectedCashMinor: input.openingFloatMinor, openedById: actor.id }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M14",
    action: "pos.session_opened",
    entityType: "pos_session",
    entityId: session.id,
    summary: `POS session opened with float ${(input.openingFloatMinor / 100).toFixed(2)}`,
    propertyId: input.propertyId,
    ip
  });
  await emitDomainEvent("pos.session_opened", { sessionId: session.id, floatMinor: input.openingFloatMinor }, input.propertyId);
  return { ok: true, data: { id: session.id, expectedCashMinor: session.expectedCashMinor } };
}

/// Close a session (§M14): expected = float + Σ cash sales; variance =
/// counted − expected (noted in the close report + audit).
export async function closeSession(
  sessionId: string,
  input: { countedCashMinor: number; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ expectedCashMinor: number; countedCashMinor: number; varianceMinor: number; sales: number; cashSales: number }>> {
  const session = await prisma.posSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", message: "Session not found" };
  if (session.status !== "open") return { ok: false, code: "ALREADY_CLOSED", message: "Session already closed" };
  if (!Number.isInteger(input.countedCashMinor) || input.countedCashMinor < 0) {
    return { ok: false, code: "INVALID_COUNT", message: "countedCashMinor must be a non-negative integer" };
  }
  const agg = await prisma.posSale.aggregate({ where: { sessionId, method: "cash" }, _sum: { totalMinor: true }, _count: true });
  const allSales = await prisma.posSale.count({ where: { sessionId } });
  const expected = session.openingFloatMinor + (agg._sum.totalMinor ?? 0);
  const variance = input.countedCashMinor - expected;
  await prisma.posSession.update({
    where: { id: sessionId },
    data: { status: "closed", closedById: actor.id, closedAt: new Date(), countedCashMinor: input.countedCashMinor, varianceMinor: variance, closeNote: input.note ?? null, expectedCashMinor: expected }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M14",
    action: "pos.session_closed",
    entityType: "pos_session",
    entityId: sessionId,
    summary: `POS session closed — ${allSales} sale(s), expected ${(expected / 100).toFixed(2)}, counted ${(input.countedCashMinor / 100).toFixed(2)}, variance ${(variance / 100).toFixed(2)}${input.note ? ` (${input.note})` : ""}`,
    propertyId: session.propertyId,
    after: { expectedCashMinor: expected, countedCashMinor: input.countedCashMinor, varianceMinor: variance },
    ip
  });
  await emitDomainEvent("pos.session_closed", { sessionId, expectedCashMinor: expected, countedCashMinor: input.countedCashMinor, varianceMinor: variance }, session.propertyId);
  return { ok: true, data: { expectedCashMinor: expected, countedCashMinor: input.countedCashMinor, varianceMinor: variance, sales: allSales, cashSales: agg._count } };
}

export interface SaleLineInput {
  productId: string;
  qtyMilli: number;
}

/// Record a sale (§M14 acceptance): validates products/stock, decrements
/// stock via M15 `sale` movements, settles cash/qr/card against the drawer
/// chart (1100/1200 → 4900) or issues the member's `room_charge` invoice
/// (1300 → 4900), and files the receipt PDF. Lines carry product/price
/// snapshots.
export async function recordSale(
  input: { sessionId: string; method: string; lines: SaleLineInput[]; memberProfileId?: string; ref?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ code: string; saleId: string; totalMinor: number; invoiceCode?: string }>> {
  const session = await prisma.posSession.findUnique({ where: { id: input.sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND", message: "Session not found" };
  if (session.status !== "open") return { ok: false, code: "SESSION_CLOSED", message: "Session is closed — open a new one" };
  if (!["cash", "qr", "card", "room_charge"].includes(input.method)) {
    return { ok: false, code: "INVALID_METHOD", message: "method must be cash | qr | card | room_charge" };
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) return { ok: false, code: "LINES_REQUIRED", message: "At least one sale line is required" };

  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const products = await prisma.posProduct.findMany({ where: { id: { in: productIds }, isActive: true }, include: { stockItem: true } });
  if (products.length !== productIds.length) return { ok: false, code: "PRODUCT_INVALID", message: "One or more products are missing or inactive" };

  let totalMinor = 0;
  const computed = input.lines.map((l) => {
    const product = products.find((p) => p.id === l.productId)!;
    if (!Number.isInteger(l.qtyMilli) || l.qtyMilli <= 0) {
      throw Object.assign(new Error("qtyMilli must be a positive integer"), { code: "INVALID_QTY" });
    }
    const lineMinor = Math.round((l.qtyMilli * product.priceMinor) / 1000);
    totalMinor += lineMinor;
    return { product, qtyMilli: l.qtyMilli, lineMinor };
  });

  let memberProfileId: string | null = null;
  if (input.method === "room_charge") {
    if (!input.memberProfileId) return { ok: false, code: "MEMBER_REQUIRED", message: "room_charge needs the member to charge" };
    const member = await prisma.memberProfile.findUnique({ where: { id: input.memberProfileId } });
    if (!member) return { ok: false, code: "NOT_FOUND", message: "Member not found" };
    memberProfileId = member.id;
  }
  if (input.method !== "room_charge" && input.ref != null && input.ref.trim().length === 0) input.ref = undefined;

  const code = await nextNumber("POSSALE", (n) => `SAL-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);

  // Stock availability check before writing anything.
  for (const line of computed) {
    if (line.product.stockItem && line.product.stockItem.qtyMilli < line.qtyMilli) {
      return { ok: false, code: "INSUFFICIENT_STOCK", message: `Not enough stock for ${line.product.name} (on hand ${(line.product.stockItem.qtyMilli / 1000).toFixed(3)} ${line.product.stockItem.unit})` };
    }
  }

  const sale = await prisma.$transaction(
    async (tx) => {
      const { applyStockSale } = await import("./stock-service");
      const created = await tx.posSale.create({
        data: {
          code,
          sessionId: session.id,
          propertyId: session.propertyId,
          method: input.method,
          totalMinor,
          memberProfileId,
          ref: input.ref ?? null,
          soldById: actor.id,
          items: {
            create: computed.map((c) => ({
              productId: c.product.id,
              name: c.product.name,
              qtyMilli: c.qtyMilli,
              unitPriceMinor: c.product.priceMinor,
              lineMinor: c.lineMinor,
              stockItemId: c.product.stockItemId
            }))
          }
        }
      });
      for (const c of computed) {
        if (c.product.stockItemId) {
          await applyStockSale(tx, c.product.stockItemId, c.qtyMilli, created.id, actor);
        }
      }
      if (input.method === "room_charge") {
        // §M14 "charge to room": one-time line on the member's account —
        // a standalone issued invoice (append-only, no mutation of existing
        // invoices), posted 1300 / 4900 like every invoice issue.
        const invoiceCode = `BLR-POS-${code.slice(-8)}`;
        const invoice = await tx.invoice.create({
          data: {
            code: invoiceCode,
            propertyId: session.propertyId,
            memberProfileId: memberProfileId!,
            status: "issued",
            issuedAt: new Date(),
            periodStart: new Date(),
            periodEnd: new Date(),
            dueDate: new Date(Date.now() + 7 * 86_400_000),
            subtotalMinor: totalMinor,
            totalMinor,
            amountDueMinor: totalMinor,
            createdById: actor.id,
            items: {
              create: computed.map((c) => ({
                name: `${c.product.name} × ${c.qtyMilli / 1000} (POS ${code})`,
                kind: "one_time",
                qty: 1,
                unitMinor: c.lineMinor,
                amountMinor: c.lineMinor
              }))
            }
          }
        });
        await tx.posSale.update({ where: { id: created.id }, data: { invoiceId: invoice.id } });
        await postTransaction(tx, {
          memo: `POS ${code} charged to room (${computed.map((c) => c.product.name).join(", ")})`,
          refType: "invoice",
          refId: invoice.id,
          propertyId: session.propertyId,
          memberId: memberProfileId,
          actorId: actor.id,
          lines: [
            { code: ACC.RENT_RECEIVABLE, debit: totalMinor, credit: 0 },
            { code: ACC.OTHER_REVENUE, debit: 0, credit: totalMinor }
          ]
        });
        return { created, invoiceCode: invoice.code };
      }
      // cash/qr/card settle immediately: DR drawer / CR other revenue
      await postTransaction(tx, {
        memo: `POS ${code} (${input.method})`,
        refType: "pos_sale",
        refId: created.id,
        propertyId: session.propertyId,
        actorId: actor.id,
        lines: [
          { code: DRAIN_ACCOUNT[input.method], debit: totalMinor, credit: 0 },
          { code: ACC.OTHER_REVENUE, debit: 0, credit: totalMinor }
        ]
      });
      return { created, invoiceCode: undefined as string | undefined };
    },
    HEAVY_TX
  );

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M14",
    action: "pos.sale",
    entityType: "pos_sale",
    entityId: sale.created.id,
    summary: `POS sale ${code}: ${(totalMinor / 100).toFixed(2)} via ${input.method}${memberProfileId ? ` charged to member ${memberProfileId.slice(-6)} (invoice ${sale.invoiceCode})` : ""} — ${computed.length} line(s)`,
    propertyId: session.propertyId,
    after: { code, totalMinor, method: input.method, invoiceCode: sale.invoiceCode },
    ip
  });
  await emitDomainEvent("pos.sale", { code, saleId: sale.created.id, totalMinor, method: input.method, invoiceCode: sale.invoiceCode }, session.propertyId);

  // Receipt PDF (§M14 "receipt printing") after commit — never blocks a sale.
  await fileSaleReceipt(sale.created.id).catch(() => undefined);

  return { ok: true, data: { code, saleId: sale.created.id, totalMinor, invoiceCode: sale.invoiceCode } };
}

/// Receipt PDF (M17 registry, entity SALE, docType receipt).
export async function fileSaleReceipt(saleId: string): Promise<void> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { PosReceiptPdf } = await import("./pos-receipt-pdf");
  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: { items: true, property: true, member: { include: { party: true } }, session: true }
  });
  if (!sale) throw new Error("Sale not found");
  const org = await prisma.setting.findUnique({ where: { key: "org.profile" } });
  const orgProfile = org ? (JSON.parse(org.value) as { name?: string; currency?: string }) : {};

  const buffer = await renderToBuffer(
    <PosReceiptPdf
      data={{
        code: sale.code,
        orgName: orgProfile.name ?? "RentManager",
        propertyName: sale.property.name,
        method: sale.method,
        totalMinor: sale.totalMinor,
        memberName: sale.member?.party.name,
        invoiceCode: sale.invoiceId ? "see invoice" : undefined,
        createdAt: sale.createdAt,
        lines: sale.items.map((i) => ({ name: i.name, qtyMilli: i.qtyMilli, unitPriceMinor: i.unitPriceMinor, lineMinor: i.lineMinor }))
      }}
    />
  );
  const existing = await prisma.documentRegistry.findFirst({ where: { entity: "SALE", entityId: saleId, docTypeId: "receipt" } });
  if (existing) return;
  const { randomBytes } = await import("node:crypto");
  const storageKey = randomBytes(16).toString("hex");
  const { storage } = await import("@/lib/storage");
  await storage.put(storageKey, buffer);
  const doc = await prisma.documentRegistry.create({
    data: {
      docTypeId: "receipt",
      entity: "SALE",
      entityId: saleId,
      fileName: `receipt-${sale.code}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      storageKey,
      version: 1,
      propertyId: sale.propertyId,
      notes: "Auto-generated POS receipt"
    }
  });
  await prisma.posSale.update({ where: { id: saleId }, data: { receiptDocId: doc.id } });
}
