/// M29 Purchase Orders service — a buying plan against stock items.
/// Creating/placing a PO is bookkeeping only; **receiving** posts one
/// `purchase` StockMovement per line (via the shared M15 movement engine) so
/// on-hand and moving-average cost only ever change through the audit trail.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { applyMovement } from "./stock-service";
import { isLowStock } from "./stock-math";
import type { ActorCtx } from "@/lib/payments/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const HEAVY_TX = { timeout: 20000, maxWait: 10000 };

export type PoStatus = "draft" | "placed" | "received" | "void";

export interface PoLineInput {
  stockItemId: string;
  qtyMilli: number; // milli units (e.g. 50_000 = 50 × 1000-milli units)
  unitCostMinor: number; // currency per whole unit
}

export interface CreatePoInput {
  propertyId: string;
  supplierId?: string;
  supplierName?: string;
  note?: string;
  lines: PoLineInput[];
}

/// Ordered-value of one line in minor (qty(milli) × cost(milli) / 1e6).
export function poLineTotalMinor(qtyMilli: number, unitCostMilli: number): number {
  return Math.round((qtyMilli * unitCostMilli) / 1_000_000);
}

function withTotals<T extends { lines: Array<{ qtyMilli: number; unitCostMilli: number; receivedMilli: number }> }>(po: T) {
  const totalMinor = po.lines.reduce((s, l) => s + poLineTotalMinor(l.qtyMilli, l.unitCostMilli), 0);
  const receivedMinor = po.lines.reduce((s, l) => s + poLineTotalMinor(l.receivedMilli, l.unitCostMilli), 0);
  return { ...po, totalMinor, receivedMinor } as T & { totalMinor: number; receivedMinor: number };
}

export async function purchaseOrderById(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      property: true,
      lines: { include: { stockItem: true }, orderBy: { createdAt: "asc" } }
    }
  });
  return po ? withTotals(po) : null;
}

async function stockItemsOf(propertyId: string, ids: string[]) {
  return prisma.stockItem.findMany({ where: { id: { in: ids }, propertyId, isActive: true } });
}

export async function createPurchaseOrder(
  input: CreatePoInput,
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string; code: string }>> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { ok: false, code: "LINES_REQUIRED", message: "At least one line is required" };
  }
  for (const l of input.lines) {
    if (!Number.isInteger(l.qtyMilli) || l.qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "Each qty must be a positive integer" };
    if (!Number.isInteger(l.unitCostMinor) || l.unitCostMinor < 0) return { ok: false, code: "INVALID_COST", message: "Unit cost must be a non-negative integer" };
  }
  const stockItemIds = input.lines.map((l) => l.stockItemId);
  if (new Set(stockItemIds).size !== stockItemIds.length) {
    return { ok: false, code: "DUPLICATE_ITEM", message: "A stock item can appear in at most one line per purchase order" };
  }
  const ids = [...new Set(stockItemIds)];
  const items = await stockItemsOf(input.propertyId, ids);
  if (items.length !== ids.length) return { ok: false, code: "ITEM_MISMATCH", message: "One or more stock items are missing, inactive, or belong to another property" };

  let supplierName = input.supplierName?.trim() ?? "";
  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) return { ok: false, code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" };
    supplierName = supplier.name;
  }

  const code = await nextNumber("PO", (n) => `PO-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);

  const result = await prisma.$transaction(
    async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          code,
          propertyId: input.propertyId,
          supplierId: input.supplierId ?? null,
          supplierName,
          status: "draft",
          note: input.note?.trim() || null,
          createdById: actor.id
        }
      });
      let totalMinor = 0;
      for (const l of input.lines) {
        const unitCostMilli = l.unitCostMinor * 1000;
        totalMinor += poLineTotalMinor(l.qtyMilli, unitCostMilli);
        await tx.purchaseOrderLine.create({
          data: {
            purchaseOrderId: po.id,
            stockItemId: l.stockItemId,
            qtyMilli: l.qtyMilli,
            unitCostMilli,
            receivedMilli: 0
          }
        });
      }
      return { id: po.id, totalMinor };
    },
    HEAVY_TX
  );

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M29",
    action: "po.created",
    entityType: "purchase_order",
    entityId: code,
    summary: `Purchase order ${code} created: ${input.lines.length} line(s), supplier ${supplierName || "—"}, ordered ${(result.totalMinor / 100).toFixed(2)}`,
    propertyId: input.propertyId,
    after: { code, lines: input.lines.length, totalMinor: result.totalMinor, status: "draft" },
    ip
  });
  await emitDomainEvent("po.created", { code, lines: input.lines.length, totalMinor: result.totalMinor }, input.propertyId);
  return { ok: true, data: { id: result.id, code } };
}

export async function placePurchaseOrder(id: string, actor: ActorCtx, ip?: string | null): Promise<Result<{ id: string; code: string }>> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return { ok: false, code: "NOT_FOUND", message: "Purchase order not found" };
  if (po.status !== "draft") return { ok: false, code: "BAD_STATE", message: `Only draft orders can be placed (current: ${po.status})` };

  const placed = await prisma.purchaseOrder.update({ where: { id }, data: { status: "placed", placedAt: new Date() } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M29",
    action: "po.placed",
    entityType: "purchase_order",
    entityId: placed.code,
    summary: `Purchase order ${placed.code} placed`,
    propertyId: placed.propertyId,
    before: { status: "draft" },
    after: { status: "placed" },
    ip
  });
  await emitDomainEvent("po.placed", { code: placed.code }, placed.propertyId);
  return { ok: true, data: { id: placed.id, code: placed.code } };
}

export async function receivePurchaseOrder(
  id: string,
  received: Array<{ lineId: string; qtyMilli: number }>,
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string; code: string; status: PoStatus; movements: number; receivedMinor: number }>> {
  if (!Array.isArray(received) || received.length === 0) return { ok: false, code: "LINES_REQUIRED", message: "Received lines are required" };
  for (const r of received) {
    if (!Number.isInteger(r.qtyMilli) || r.qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "Received qty must be a positive integer" };
  }
  const lineIds = received.map((r) => r.lineId);
  if (new Set(lineIds).size !== lineIds.length) {
    return { ok: false, code: "DUPLICATE_LINE", message: "Each line can be received at most once per request" };
  }
  const po = await purchaseOrderById(id);
  if (!po) return { ok: false, code: "NOT_FOUND", message: "Purchase order not found" };
  if (po.status === "received") return { ok: false, code: "ALREADY_RECEIVED", message: "This purchase order has already been received" };
  if (po.status === "void") return { ok: false, code: "BAD_STATE", message: "Void purchase orders cannot be received" };

  const linesById = new Map(po.lines.map((l) => [l.id, l]));
  if (received.some((r) => !linesById.has(r.lineId))) return { ok: false, code: "LINE_MISMATCH", message: "One or more received lines don't belong to this purchase order" };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let receivedMinor = 0;
        let movements = 0;
        for (const r of received) {
          const line = linesById.get(r.lineId)!;
          const remaining = line.qtyMilli - line.receivedMilli;
          if (r.qtyMilli > remaining) {
            throw Object.assign(new Error(`Over-receipt on "${line.stockItem.name}": ${r.qtyMilli / 1000} received vs ${remaining / 1000} remaining`), { code: "OVER_RECEIPT" });
          }
          const applied = await applyMovement(
            tx,
            line.stockItemId,
            "purchase",
            r.qtyMilli,
            line.unitCostMilli,
            actor,
            { purchaseOrderId: po.id, note: `PO ${po.code}` }
          );
          void applied;
          movements += 1;
          receivedMinor += poLineTotalMinor(r.qtyMilli, line.unitCostMilli);
          await tx.purchaseOrderLine.update({
            where: { id: line.id },
            data: { receivedMilli: line.receivedMilli + r.qtyMilli }
          });
        }
        const allReceived = po.lines.every((l) => {
          const updated = received.find((r) => r.lineId === l.id);
          return l.receivedMilli + (updated?.qtyMilli ?? 0) >= l.qtyMilli;
        });
        const status: PoStatus = allReceived ? "received" : "placed";
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status,
            receivedAt: allReceived ? new Date() : po.receivedAt
          }
        });
        return { receivedMinor, movements, status };
      },
      HEAVY_TX
    );

    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M29",
      action: "po.received",
      entityType: "purchase_order",
      entityId: po.code,
      summary: `Purchase order ${po.code}: received ${received.length} line(s) (${result.movements} movement(s), ${(result.receivedMinor / 100).toFixed(2)}), status ${result.status}`,
      propertyId: po.propertyId,
      after: { received: received.length, receivedMinor: result.receivedMinor, status: result.status },
      ip
    });
    await emitDomainEvent("po.received", { code: po.code, receivedMinor: result.receivedMinor, status: result.status }, po.propertyId);
    for (const r of received) {
      const line = linesById.get(r.lineId)!;
      await emitDomainEvent("stock.purchased", { stockItemId: line.stockItemId, qtyMilli: r.qtyMilli, unitCostMinor: line.unitCostMilli / 1000 }, po.propertyId);
      const after = await prisma.stockItem.findUniqueOrThrow({ where: { id: line.stockItemId } });
      if (isLowStock(after.qtyMilli, after.minQtyMilli)) {
        await emitDomainEvent("stock.low", { stockItemId: after.id, name: after.name, qtyMilli: after.qtyMilli, minQtyMilli: after.minQtyMilli }, po.propertyId);
      }
    }
    return { ok: true, data: { id: po.id, code: po.code, status: result.status, movements: result.movements, receivedMinor: result.receivedMinor } };
  } catch (e) {
    return receiveError(e);
  }
}

/// Map known movement-engine failures (over-receipt, missing item) back to a
/// clean Result so the API returns 4xx — unexpected errors still propagate.
function receiveError(e: unknown): Result<never> {
  const err = e as { code?: string; message?: string };
  if (err.code === "OVER_RECEIPT" || err.code === "NOT_FOUND" || err.code === "INSUFFICIENT_STOCK") {
    return { ok: false, code: err.code, message: err.message ?? "Receiving stock failed" };
  }
  throw e;
}

export async function voidPurchaseOrder(id: string, actor: ActorCtx, ip?: string | null): Promise<Result<{ id: string; code: string }>> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
  if (!po) return { ok: false, code: "NOT_FOUND", message: "Purchase order not found" };
  if (po.status === "void") return { ok: false, code: "BAD_STATE", message: "Already void" };
  if (po.status === "received") return { ok: false, code: "BAD_STATE", message: "Received purchase orders cannot be voided" };
  if (po.lines.some((l) => l.receivedMilli > 0)) return { ok: false, code: "PARTIAL_RECEIPT", message: "Orders with partial receipts cannot be voided" };

  const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "void" } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M29",
    action: "po.void",
    entityType: "purchase_order",
    entityId: updated.code,
    summary: `Purchase order ${updated.code} voided`,
    propertyId: updated.propertyId,
    before: { status: po.status },
    after: { status: "void" },
    ip
  });
  await emitDomainEvent("po.void", { code: updated.code }, updated.propertyId);
  return { ok: true, data: { id: updated.id, code: updated.code } };
}

export async function listPurchaseOrders(propertyId: string | null, status?: string) {
  const rows = await prisma.purchaseOrder.findMany({
    where: { ...(propertyId ? { propertyId } : {}), ...(status && status !== "all" ? { status } : {}) },
    include: {
      supplier: true,
      lines: { include: { stockItem: true } },
      _count: { select: { lines: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return rows.map(withTotals);
}