/**
 * M29 Purchase Orders service (§M29 acceptance) — DB-backed tests against a
 * disposable COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/po-service.test.ts
 *
 * Flow: create a draft → reject duplicate lines → place → receive (posts M15
 * purchase movements and flips status) → over-receipt returns a clean error
 * (not a thrown 500) → duplicate receive lines rejected → void semantics.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createPurchaseOrder,
  placePurchaseOrder,
  receivePurchaseOrder,
  voidPurchaseOrder,
  purchaseOrderById,
  listPurchaseOrders
} from "@/lib/operations/po-service";

let actor = { id: "", name: "" };
let itemId = "";
let propertyId = "";
let runnable = false;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  const cola = await prisma.posProduct.findUniqueOrThrow({ where: { name: "Coca-Cola can 330ml" }, include: { stockItem: true } });
  itemId = cola.stockItem!.id;
  propertyId = cola.stockItem!.propertyId;
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M29 Purchase Orders", () => {
  it("create a draft with a PO-YYYY-NNNN code and correct totals", async (ctx) => {
    if (!runnable) return ctx.skip();
    const r = await createPurchaseOrder(
      { propertyId, supplierName: "Test Wholesale", note: "first order", lines: [{ stockItemId: itemId, qtyMilli: 10_000, unitCostMinor: 60 }] },
      actor,
      "test"
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.code).toMatch(/^PO-\d{4}-\d{4}$/);
    const po = await purchaseOrderById(r.data.id);
    expect(po?.status).toBe("draft");
    expect(po?.supplierName).toBe("Test Wholesale");
    expect(po?.totalMinor).toBe(600); // 10 units × 60 minor
    expect(po?.lines[0]?.qtyMilli).toBe(10_000);
  });

  it("rejects duplicate stock item lines (unique [PO, item] would otherwise 500)", async (ctx) => {
    if (!runnable) return ctx.skip();
    const r = await createPurchaseOrder(
      { propertyId, lines: [{ stockItemId: itemId, qtyMilli: 1_000, unitCostMinor: 60 }, { stockItemId: itemId, qtyMilli: 2_000, unitCostMinor: 60 }] },
      actor,
      "test"
    );
    expect(r).toMatchObject({ ok: false, code: "DUPLICATE_ITEM" });
  });

  it("rejects invalid lines and missing items", async (ctx) => {
    if (!runnable) return ctx.skip();
    const qty = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: itemId, qtyMilli: 0, unitCostMinor: 60 }] }, actor, "test");
    expect(qty).toMatchObject({ ok: false, code: "INVALID_QTY" });
    const missing = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: "does-not-exist", qtyMilli: 1_000, unitCostMinor: 60 }] }, actor, "test");
    expect(missing).toMatchObject({ ok: false, code: "ITEM_MISMATCH" });
  });

  it("place → receive posts a purchase movement, bumps on-hand and flips status", async (ctx) => {
    if (!runnable) return ctx.skip();
    const created = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: itemId, qtyMilli: 5_000, unitCostMinor: 60 }] }, actor, "test");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const orderedId = created.data.id;

    const placed = await placePurchaseOrder(orderedId, actor, "test");
    expect(placed.ok).toBe(true);
    const draft = await placePurchaseOrder(orderedId, actor, "test");
    expect(draft).toMatchObject({ ok: false, code: "BAD_STATE" }); // already placed

    const before = (await prisma.stockItem.findUniqueOrThrow({ where: { id: itemId } })).qtyMilli;
    const lineId = (await purchaseOrderById(orderedId))!.lines[0]!.id;
    const received = await receivePurchaseOrder(orderedId, [{ lineId, qtyMilli: 5_000 }], actor, "test");
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    expect(received.data.status).toBe("received");
    expect(received.data.movements).toBe(1);
    expect(received.data.receivedMinor).toBe(300); // 5 units × 60 minor

    const after = (await prisma.stockItem.findUniqueOrThrow({ where: { id: itemId } })).qtyMilli;
    expect(after).toBe(before + 5_000);
    const mv = await prisma.stockMovement.findFirstOrThrow({ where: { purchaseOrderId: orderedId } });
    expect(mv.type).toBe("purchase");
    expect(mv.qtyMilli).toBe(5_000);
    expect(mv.unitCostMilli).toBe(60_000); // 60 minor × 1000

    const again = await receivePurchaseOrder(orderedId, [{ lineId, qtyMilli: 1 }], actor, "test");
    expect(again).toMatchObject({ ok: false, code: "ALREADY_RECEIVED" });
  });

  it("partial receipt keeps the order placed until every line arrives", async (ctx) => {
    if (!runnable) return ctx.skip();
    const detergent = await prisma.stockItem.findFirstOrThrow({ where: { propertyId, name: { contains: "Laundry" } } });
    const multi = await createPurchaseOrder(
      { propertyId, lines: [{ stockItemId: itemId, qtyMilli: 4_000, unitCostMinor: 60 }, { stockItemId: detergent.id, qtyMilli: 2_000, unitCostMinor: 450 }] },
      actor,
      "test"
    );
    expect(multi.ok).toBe(true);
    if (!multi.ok) return;
    await placePurchaseOrder(multi.data.id, actor, "test");
    const po = await purchaseOrderById(multi.data.id);
    const first = po!.lines.find((l) => l.stockItemId === itemId)!;
    const partial = await receivePurchaseOrder(multi.data.id, [{ lineId: first.id, qtyMilli: 4_000 }], actor, "test");
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.data.status).toBe("placed"); // other line not yet received
    expect(partial.data.movements).toBe(1);
  });

  it("over-receipt returns OVER_RECEIPT instead of throwing", async (ctx) => {
    if (!runnable) return ctx.skip();
    const created = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: itemId, qtyMilli: 5_000, unitCostMinor: 60 }] }, actor, "test");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await placePurchaseOrder(created.data.id, actor, "test");
    const lineId = (await purchaseOrderById(created.data.id))!.lines[0]!.id;
    const r = await receivePurchaseOrder(created.data.id, [{ lineId, qtyMilli: 6_000 }], actor, "test");
    expect(r).toMatchObject({ ok: false, code: "OVER_RECEIPT" });
    const po = await purchaseOrderById(created.data.id);
    expect(po?.status).toBe("placed"); // transaction rolled back — no movement posted
    expect(po?.lines[0]?.receivedMilli).toBe(0);
    expect(await prisma.stockMovement.count({ where: { purchaseOrderId: created.data.id } })).toBe(0);
  });

  it("rejects receiving the same line twice in one request", async (ctx) => {
    if (!runnable) return ctx.skip();
    const created = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: itemId, qtyMilli: 10_000, unitCostMinor: 60 }] }, actor, "test");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await placePurchaseOrder(created.data.id, actor, "test");
    const lineId = (await purchaseOrderById(created.data.id))!.lines[0]!.id;
    const r = await receivePurchaseOrder(created.data.id, [{ lineId, qtyMilli: 4_000 }, { lineId, qtyMilli: 4_000 }], actor, "test");
    expect(r).toMatchObject({ ok: false, code: "DUPLICATE_LINE" });
  });

  it("voids draft/placed orders but never received ones", async (ctx) => {
    if (!runnable) return ctx.skip();
    const draft = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: itemId, qtyMilli: 1_000, unitCostMinor: 60 }] }, actor, "test");
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const v1 = await voidPurchaseOrder(draft.data.id, actor, "test");
    expect(v1.ok).toBe(true);
    expect((await purchaseOrderById(draft.data.id))?.status).toBe("void");
    expect((await listPurchaseOrders(propertyId, "void")).some((p) => p.id === draft.data.id)).toBe(true);

    const received = await createPurchaseOrder({ propertyId, lines: [{ stockItemId: itemId, qtyMilli: 1_000, unitCostMinor: 60 }] }, actor, "test");
    expect(received.ok).toBe(true);
    if (!received.ok) return;
    await placePurchaseOrder(received.data.id, actor, "test");
    await receivePurchaseOrder(received.data.id, [{ lineId: (await purchaseOrderById(received.data.id))!.lines[0]!.id, qtyMilli: 1_000 }], actor, "test");
    const v2 = await voidPurchaseOrder(received.data.id, actor, "test");
    expect(v2).toMatchObject({ ok: false, code: "BAD_STATE" });
  });
});