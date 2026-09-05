/// M15 Stock service — every on-hand change is a StockMovement row (§M15
/// "movements only, no direct qty edits"): purchase (moving-average in),
/// sale (POS), consumption, maintenance_use (cost → ticket), adjustment
/// (incl. stocktake variance) and transfer between items.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { nextNumber } from "@/lib/numbering";
import { isLowStock, movingAverage, stocktakeVariance, valuationMilli } from "./stock-math";
import type { ActorCtx } from "@/lib/payments/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const HEAVY_TX = { timeout: 20000, maxWait: 10000 };

export interface ItemInput {
  name: string;
  category: string;
  categoryId?: string;
  unit: string;
  packUnit?: string | null;
  packSize?: number | null;
  minQtyMilli?: number;
  supplierId?: string;
  propertyId: string;
}

/// "1 carton = 12 bottle": packUnit is the buy unit, packSize how many base
/// units it holds. A pack is only valid when both sides are set, packSize ≥ 2
/// and the pack unit differs from the item's base unit.
function validatePack(input: { unit: string; packUnit?: string | null; packSize?: number | null }): string | null {
  const packUnit = input.packUnit?.trim();
  const hasUnit = Boolean(packUnit);
  const hasSize = input.packSize != null && input.packSize > 0;
  if (!hasUnit && !hasSize) return null;
  if (!hasUnit || !hasSize) return "Both pack unit and pack size are required together";
  if (input.packSize! < 2) return "Pack size must be at least 2";
  if (packUnit!.toLowerCase() === input.unit.trim().toLowerCase()) return "Pack unit and base unit must differ";
  return null;
}

/// Resolve the legacy string snapshot ("Parent/Child") for a category id.
/// Falls back to the caller-supplied string (or "other") when unknown.
async function resolveCategorySnapshot(categoryId: string | undefined | null, fallback: string | null | undefined): Promise<string> {
  if (categoryId) {
    const cat = await prisma.stockCategory.findUnique({ where: { id: categoryId } });
    if (cat) {
      const parent = cat.parentId ? await prisma.stockCategory.findUnique({ where: { id: cat.parentId } }) : null;
      return parent ? `${parent.name}/${cat.name}` : cat.name;
    }
  }
  return fallback?.trim() || "other";
}

export async function createStockItem(input: ItemInput, actor: ActorCtx, ip?: string | null): Promise<Result<{ id: string }>> {
  if (input.name.trim().length < 2) return { ok: false, code: "NAME_REQUIRED", message: "Item name (2+ chars) is required" };
  if (input.unit.trim().length < 1) return { ok: false, code: "UNIT_REQUIRED", message: "Unit is required (pcs, kg, l, box…)" };
  const packErr = validatePack(input);
  if (packErr) return { ok: false, code: "INVALID_PACK", message: packErr };
  if (input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) return { ok: false, code: "NOT_FOUND", message: "Supplier not found" };
  }
  if (input.categoryId) {
    const cat = await prisma.stockCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) return { ok: false, code: "NOT_FOUND", message: "Category not found" };
    if (cat.propertyId !== null && cat.propertyId !== input.propertyId) {
      return { ok: false, code: "SCOPE_MISMATCH", message: "Category belongs to a different property" };
    }
  }
  const dup = await prisma.stockItem.findUnique({ where: { name_propertyId: { name: input.name.trim(), propertyId: input.propertyId } } });
  if (dup) return { ok: false, code: "DUPLICATE", message: `Item "${input.name.trim()}" already exists on this property` };
  const category = await resolveCategorySnapshot(input.categoryId, input.category);
  const item = await prisma.stockItem.create({
    data: {
      name: input.name.trim(),
      category,
      categoryId: input.categoryId ?? null,
      unit: input.unit.trim(),
      packUnit: input.packUnit?.trim() || null,
      packSize: input.packSize ?? null,
      minQtyMilli: input.minQtyMilli ?? 0,
      supplierId: input.supplierId ?? null,
      propertyId: input.propertyId
    }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M15",
    action: "stock_item.created",
    entityType: "stock_item",
    entityId: item.id,
    summary: `Stock item "${item.name}" created (${item.category}, per ${item.unit})`,
    propertyId: item.propertyId,
    ip
  });
  return { ok: true, data: { id: item.id } };
}

export interface ItemPatch {
  name?: string;
  categoryId?: string | null;
  unit?: string;
  packUnit?: string | null;
  packSize?: number | null;
  minQtyMilli?: number;
  supplierId?: string | null;
  isActive?: boolean;
}

/// Update item metadata (never qty/avg cost — those only change via
/// movements). Category string snapshot is re-derived when categoryId changes.
export async function updateStockItem(id: string, patch: ItemPatch, actor: ActorCtx, ip?: string | null): Promise<Result<{ id: string }>> {
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Stock item not found" };
  if (patch.name !== undefined && (patch.name.trim().length < 2 || patch.name.trim().length > 120)) {
    return { ok: false, code: "NAME_REQUIRED", message: "Item name (2–120 chars) is required" };
  }
  if (patch.unit !== undefined && patch.unit.trim().length < 1) {
    return { ok: false, code: "UNIT_REQUIRED", message: "Unit is required" };
  }
  const packErr = validatePack({
    unit: patch.unit?.trim() ?? item.unit,
    packUnit: patch.packUnit !== undefined ? patch.packUnit?.trim() || null : item.packUnit,
    packSize: patch.packSize !== undefined ? patch.packSize : item.packSize
  });
  if (packErr) return { ok: false, code: "INVALID_PACK", message: packErr };
  if (patch.name !== undefined && patch.name.trim() !== item.name) {
    const dup = await prisma.stockItem.findUnique({ where: { name_propertyId: { name: patch.name.trim(), propertyId: item.propertyId } } });
    if (dup) return { ok: false, code: "DUPLICATE", message: `Item "${patch.name.trim()}" already exists on this property` };
  }

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.unit !== undefined) data.unit = patch.unit.trim();
  if (patch.packUnit !== undefined) data.packUnit = patch.packUnit?.trim() || null;
  if (patch.packSize !== undefined) data.packSize = patch.packSize ?? null;
  if (patch.minQtyMilli !== undefined) data.minQtyMilli = Math.max(0, Math.round(patch.minQtyMilli));
  if (patch.supplierId !== undefined) data.supplierId = patch.supplierId || null;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  if (patch.categoryId !== undefined) {
    const next = patch.categoryId ?? null;
    if (next !== null) {
      const cat = await prisma.stockCategory.findUnique({ where: { id: next } });
      if (!cat) return { ok: false, code: "NOT_FOUND", message: "Category not found" };
      if (cat.propertyId !== null && cat.propertyId !== item.propertyId) {
        return { ok: false, code: "SCOPE_MISMATCH", message: "Category belongs to a different property" };
      }
    }
    data.categoryId = next;
    data.category = await resolveCategorySnapshot(next, "other");
  }

  const updated = await prisma.stockItem.update({ where: { id }, data });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M15",
    action: "stock_item.updated",
    entityType: "stock_item",
    entityId: updated.id,
    summary: `Stock item "${updated.name}" updated${data.category ? ` — category ${data.category}` : ""}`,
    propertyId: item.propertyId,
    ip
  });
  return { ok: true, data: { id: updated.id } };
}

interface MovementOpts {
  ticketId?: string;
  saleId?: string;
  stocktakeId?: string;
  purchaseOrderId?: string;
  targetItemId?: string;
  note?: string;
}

/// Core movement applier (must run inside a transaction): validates stock,
/// applies the signed delta, updates the moving average and writes the row.
/// Exported for M29 Purchase Orders so PO receipts reuse the same engine.
export async function applyMovement(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  stockItemId: string,
  type: string,
  qtyMilli: number,
  unitCostMilli: number | undefined,
  actor: ActorCtx,
  opts: MovementOpts = {}
): Promise<{ qtyAfterMilli: number; avgCostAfterMilli: number; valueMilli: number }> {
  const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) throw Object.assign(new Error("Stock item not found"), { code: "NOT_FOUND" });
  if (type !== "purchase" && type !== "adjustment" && qtyMilli < 0 && item.qtyMilli + qtyMilli < 0) {
    throw Object.assign(new Error(`Insufficient stock: on hand ${(item.qtyMilli / 1000).toFixed(3)} ${item.unit}`), { code: "INSUFFICIENT_STOCK" });
  }
  let avgCostAfterMilli = item.avgCostMilli;
  let valueMilli: number;
  if (type === "purchase" && qtyMilli > 0 && unitCostMilli != null) {
    const ma = movingAverage(item.qtyMilli, item.avgCostMilli, qtyMilli, unitCostMilli);
    avgCostAfterMilli = ma.avgCostAfterMilli;
    valueMilli = ma.valueDeltaMilli;
  } else {
    // sales/consumptions carry stock out at the current moving average;
    // adjustments/transfer legs value the delta at the current average
    // (valueMilli is minor×1000 per §schema — qty(milli)×cost(milli) is milli²)
    valueMilli = Math.round((qtyMilli * item.avgCostMilli) / 1000);
    if (item.qtyMilli + qtyMilli <= 0) {
      avgCostAfterMilli = item.avgCostMilli; // keep last known cost for re-purchases
      if (item.qtyMilli + qtyMilli === 0) avgCostAfterMilli = item.avgCostMilli;
    }
  }
  const qtyAfterMilli = item.qtyMilli + qtyMilli;
  await tx.stockItem.update({ where: { id: item.id }, data: { qtyMilli: qtyAfterMilli, avgCostMilli: avgCostAfterMilli } });
  await tx.stockMovement.create({
    data: {
      stockItemId: item.id,
      type,
      qtyMilli,
      qtyAfterMilli,
      avgCostAfterMilli,
      valueMilli,
      unitCostMilli: unitCostMilli ?? null,
      saleId: opts.saleId ?? null,
      ticketId: opts.ticketId ?? null,
      stocktakeId: opts.stocktakeId ?? null,
      purchaseOrderId: opts.purchaseOrderId ?? null,
      targetItemId: opts.targetItemId ?? null,
      note: opts.note ?? null,
      createdById: actor.id
    }
  });
  return { qtyAfterMilli, avgCostAfterMilli, valueMilli };
}

/// POS sale leg (tx helper used by pos-service): decrement stock at the
/// current moving average as a `sale` movement tied to the POS sale row.
export async function applyStockSale(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  stockItemId: string,
  qtyMilli: number,
  saleId: string,
  actor: ActorCtx
): Promise<{ qtyAfterMilli: number; avgCostAfterMilli: number }> {
  const applied = await applyMovement(tx, stockItemId, "sale", -qtyMilli, undefined, actor, { saleId });
  return { qtyAfterMilli: applied.qtyAfterMilli, avgCostAfterMilli: applied.avgCostAfterMilli };
}

/// Purchase stock (§M15): +qty at unit cost, moving-average absorbed.
/// With `inPacks` the qty is in the item's pack unit ("1 carton = 12 bottle"):
/// on-hand grows by qty × packSize and the per-pack cost is divided by
/// packSize before entering the average.
export async function purchaseStock(
  stockItemId: string,
  input: { qtyMilli: number; unitCostMinor: number; note?: string; inPacks?: boolean },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ qtyAfterMilli: number; avgCostMilli: number }>> {
  const item = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Stock item not found" };
  if (!Number.isInteger(input.qtyMilli) || input.qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "qtyMilli must be a positive integer" };
  if (!Number.isInteger(input.unitCostMinor) || input.unitCostMinor <= 0) return { ok: false, code: "INVALID_COST", message: "unitCostMinor must be a positive integer" };

  let qtyMilli = input.qtyMilli;
  let unitCostMilli = input.unitCostMinor * 1000;
  if (input.inPacks) {
    if (!item.packUnit || !item.packSize) {
      return { ok: false, code: "INVALID_PACK", message: `"${item.name}" has no pack unit defined` };
    }
    qtyMilli = input.qtyMilli * item.packSize;
    unitCostMilli = Math.round((input.unitCostMinor * 1000) / item.packSize);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const r = await applyMovement(tx, stockItemId, "purchase", qtyMilli, unitCostMilli, actor, { note: input.note });
      return r;
    },
    HEAVY_TX
  );
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M15",
    action: "stock.purchased",
    entityType: "stock_item",
    entityId: stockItemId,
    summary: `Purchased ${input.inPacks ? `${input.qtyMilli / 1000} ${item.packUnit} (${qtyMilli / 1000} ${item.unit})` : `${input.qtyMilli / 1000} ${item.unit}`} of "${item.name}" @ ${input.inPacks ? `${(input.unitCostMinor / 100).toFixed(2)}/${item.packUnit}` : (input.unitCostMinor / 100).toFixed(2)} — on hand ${result.qtyAfterMilli / 1000}, avg cost ${(result.avgCostAfterMilli / 100_000).toFixed(4)}`,
    propertyId: item.propertyId,
    ip
  });
  await emitDomainEvent("stock.purchased", { stockItemId, qtyMilli, unitCostMinor: Math.round(unitCostMilli / 1000), inPacks: Boolean(input.inPacks) }, item.propertyId);
  if (isLowStock(result.qtyAfterMilli, item.minQtyMilli)) {
    await emitDomainEvent("stock.low", { stockItemId, name: item.name, qtyMilli: result.qtyAfterMilli, minQtyMilli: item.minQtyMilli }, item.propertyId);
  }
  return { ok: true, data: { qtyAfterMilli: result.qtyAfterMilli, avgCostMilli: result.avgCostAfterMilli } };
}

/// Manual consumption (§M15 movement types; maintenance use has its own fn).
export async function consumeStock(
  stockItemId: string,
  input: { qtyMilli: number; note: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ qtyAfterMilli: number }>> {
  const item = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Stock item not found" };
  if (!Number.isInteger(input.qtyMilli) || input.qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "qtyMilli must be a positive integer" };
  if (input.note.trim().length < 3) return { ok: false, code: "NOTE_REQUIRED", message: "A reason (3+ chars) is required" };
  try {
    const result = await prisma.$transaction(
      async (tx) => applyMovement(tx, stockItemId, "consumption", -input.qtyMilli, undefined, actor, { note: input.note.trim() }),
      HEAVY_TX
    );
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M15",
      action: "stock.consumed",
      entityType: "stock_item",
      entityId: stockItemId,
      summary: `Consumed ${input.qtyMilli / 1000} ${item.unit} of "${item.name}": ${input.note.trim()} — on hand ${result.qtyAfterMilli / 1000}`,
      propertyId: item.propertyId,
      ip
    });
    await checkLowStockEmit(stockItemId, item.propertyId);
    return { ok: true, data: { qtyAfterMilli: result.qtyAfterMilli } };
  } catch (e) {
    return movementError(e);
  }
}

/// Maintenance consumes a part (§M15): movement `maintenance_use` + a
/// `material` MaintenanceCost line on the ticket valued at moving average
/// (cost flows to ticket/M20 — matrix row 14 "stock movement integrity").
export async function consumeForTicket(
  ticketId: string,
  input: { stockItemId: string; qtyMilli: number; label?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ qtyAfterMilli: number; costMinor: number; ticketCode: string }>> {
  const ticket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, code: "NOT_FOUND", message: "Ticket not found" };
  const item = await prisma.stockItem.findUnique({ where: { id: input.stockItemId } });
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Stock item not found" };
  if (!Number.isInteger(input.qtyMilli) || input.qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "qtyMilli must be a positive integer" };
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const applied = await applyMovement(tx, input.stockItemId, "maintenance_use", -input.qtyMilli, undefined, actor, { ticketId });
        await tx.maintenanceCost.create({
          data: {
            ticketId,
            kind: "material",
            label: input.label?.trim() || `${item.name} × ${input.qtyMilli / 1000} ${item.unit} (TK ${ticket.code})`,
            amountMinor: Math.round((input.qtyMilli * item.avgCostMilli) / 1_000_000),
            stockItemId: item.id,
            chargeTo: "expense",
            createdById: actor.id
          }
        });
        return applied;
      },
      HEAVY_TX
    );
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M15",
      action: "stock.maintenance_used",
      entityType: "stock_item",
      entityId: item.id,
      summary: `Ticket ${ticket.code} consumed ${input.qtyMilli / 1000} ${item.unit} of "${item.name}" @ moving avg — ticket cost line added, on hand ${result.qtyAfterMilli / 1000}`,
      propertyId: item.propertyId,
      ip
    });
    await emitDomainEvent("stock.maintenance_used", { stockItemId: item.id, ticketId, qtyMilli: input.qtyMilli }, item.propertyId);
    await checkLowStockEmit(item.id, item.propertyId);
    return { ok: true, data: { qtyAfterMilli: result.qtyAfterMilli, costMinor: Math.round((input.qtyMilli * item.avgCostMilli) / 1_000_000), ticketCode: ticket.code } };
  } catch (e) {
    return movementError(e);
  }
}

/// Transfer between two stock items (e.g. storeroom → kiosk): out at source
/// average, in at the same unit cost (target's average absorbs it).
export async function transferStock(
  input: { fromItemId: string; toItemId: string; qtyMilli: number; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ fromQtyAfterMilli: number; toQtyAfterMilli: number }>> {
  if (input.fromItemId === input.toItemId) return { ok: false, code: "SAME_ITEM", message: "Transfer needs two different stock items" };
  const from = await prisma.stockItem.findUnique({ where: { id: input.fromItemId } });
  const to = await prisma.stockItem.findUnique({ where: { id: input.toItemId } });
  if (!from || !to) return { ok: false, code: "NOT_FOUND", message: "Stock item not found" };
  if (from.propertyId !== to.propertyId) return { ok: false, code: "OTHER_PROPERTY", message: "Transfers stay within one property" };
  if (!Number.isInteger(input.qtyMilli) || input.qtyMilli <= 0) return { ok: false, code: "INVALID_QTY", message: "qtyMilli must be a positive integer" };
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const out = await applyMovement(tx, input.fromItemId, "transfer", -input.qtyMilli, undefined, actor, { targetItemId: input.toItemId, note: input.note });
        const inAvg = out.avgCostAfterMilli > 0 ? out.avgCostAfterMilli : from.avgCostMilli;
        const inc = await applyMovement(tx, input.toItemId, "transfer", input.qtyMilli, inAvg, actor, { targetItemId: input.fromItemId, note: input.note });
        return { fromQtyAfterMilli: out.qtyAfterMilli, toQtyAfterMilli: inc.qtyAfterMilli };
      },
      HEAVY_TX
    );
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M15",
      action: "stock.transferred",
      entityType: "stock_item",
      entityId: input.fromItemId,
      summary: `Transferred ${input.qtyMilli / 1000} ${from.unit} "${from.name}" → "${to.name}"`,
      propertyId: from.propertyId,
      ip
    });
    return { ok: true, data: result };
  } catch (e) {
    return movementError(e);
  }
}

async function checkLowStockEmit(stockItemId: string, propertyId: string): Promise<void> {
  const item = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
  if (item && isLowStock(item.qtyMilli, item.minQtyMilli)) {
    await emitDomainEvent("stock.low", { stockItemId, name: item.name, qtyMilli: item.qtyMilli, minQtyMilli: item.minQtyMilli }, propertyId);
  }
}

function movementError(e: unknown): Result<never> {
  const err = e as { code?: string; message?: string };
  if (err.code === "INSUFFICIENT_STOCK") return { ok: false, code: "INSUFFICIENT_STOCK", message: err.message ?? "Insufficient stock" };
  if (err.code === "NOT_FOUND") return { ok: false, code: "NOT_FOUND", message: "Stock item not found" };
  throw e;
}

/// Stocktake (§M15): counted quantities per item → variance posts `adjustment`
/// movements and the valuation delta is reported.
export async function runStocktake(
  input: { propertyId: string; note?: string; counted: Array<{ stockItemId: string; countedMilli: number }> },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ code: string; adjustments: number; valueDeltaMilli: number; lines: Array<{ name: string; expectedMilli: number; countedMilli: number; varianceMilli: number }> }>> {
  if (!Array.isArray(input.counted) || input.counted.length === 0) return { ok: false, code: "LINES_REQUIRED", message: "Counted lines are required" };
  const ids = input.counted.map((c) => c.stockItemId);
  const items = await prisma.stockItem.findMany({ where: { id: { in: ids }, propertyId: input.propertyId } });
  if (items.length !== new Set(ids).size) return { ok: false, code: "ITEM_MISMATCH", message: "One or more items are missing or belong to another property" };
  for (const c of input.counted) {
    if (!Number.isInteger(c.countedMilli) || c.countedMilli < 0) return { ok: false, code: "INVALID_COUNT", message: "countedMilli must be a non-negative integer" };
  }

  const code = await nextNumber("STOCKTAKE", (n) => `STK-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);
  const result = await prisma.$transaction(
    async (tx) => {
      const stocktake = await tx.stocktake.create({
        data: { code, propertyId: input.propertyId, status: "completed", note: input.note ?? null, createdById: actor.id }
      });
      let valueDeltaMilli = 0;
      const lines: Array<{ name: string; expectedMilli: number; countedMilli: number; varianceMilli: number }> = [];
      for (const c of input.counted) {
        const item = items.find((i) => i.id === c.stockItemId)!;
        const variance = stocktakeVariance(item.qtyMilli, c.countedMilli);
        await tx.stocktakeLine.create({
          data: { stocktakeId: stocktake.id, stockItemId: item.id, expectedMilli: item.qtyMilli, countedMilli: c.countedMilli, varianceMilli: variance }
        });
        lines.push({ name: item.name, expectedMilli: item.qtyMilli, countedMilli: c.countedMilli, varianceMilli: variance });
        if (variance !== 0) {
          const applied = await applyMovement(tx, item.id, "adjustment", variance, undefined, actor, { stocktakeId: stocktake.id, note: `Stocktake ${code}` });
          valueDeltaMilli += applied.valueMilli;
        }
      }
      await tx.stocktake.update({ where: { id: stocktake.id }, data: { valueDeltaMilli } });
      return { code, adjustments: lines.filter((l) => l.varianceMilli !== 0).length, valueDeltaMilli, lines };
    },
    HEAVY_TX
  );
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M15",
    action: "stock.stocktake",
    entityType: "stocktake",
    entityId: code,
    summary: `Stocktake ${code}: ${input.counted.length} line(s), ${result.adjustments} adjustment(s), valuation delta ${(result.valueDeltaMilli / 100_000).toFixed(2)}`,
    propertyId: input.propertyId,
    after: { code, adjustments: result.adjustments, valueDeltaMilli: result.valueDeltaMilli },
    ip
  });
  await emitDomainEvent("stock.stocktake", { code, adjustments: result.adjustments, valueDeltaMilli: result.valueDeltaMilli }, input.propertyId);
  return { ok: true, data: result };
}

/// Valuation report (§M15 acceptance): per-item on-hand × moving average.
export async function valuationReport(propertyId: string) {
  const items = await prisma.stockItem.findMany({ where: { propertyId, isActive: true }, orderBy: { name: "asc" } });
  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    categoryId: i.categoryId,
    unit: i.unit,
    packUnit: i.packUnit,
    packSize: i.packSize,
    qtyMilli: i.qtyMilli,
    avgCostMilli: i.avgCostMilli,
    valueMinor: Math.round(valuationMilli(i.qtyMilli, i.avgCostMilli) / 1000),
    low: isLowStock(i.qtyMilli, i.minQtyMilli),
    minQtyMilli: i.minQtyMilli
  }));
  return {
    items: rows,
    totalValueMinor: rows.reduce((s, r) => s + r.valueMinor, 0),
    lowStockCount: rows.filter((r) => r.low).length
  };
}
