/**
 * M14 POS service (§M14 acceptance) — DB-backed tests against a disposable
 * COPY of the seeded database:
 *   DATABASE_URL=file:./test-billing.db npx vitest run tests/pos-service.test.ts
 *
 * §M14 acceptance flow: open session → 3 sales (cash, QR, one charge-to-room)
 * → close with a variance; stock decremented for stock-linked products; the
 * room charge appears as a one-time line on the member's invoice; ledger
 * balances; receipt PDFs filed. Uses the seeded POS products.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storage: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => Buffer.from("%PDF-fake")),
    delete: vi.fn(async () => undefined)
  }
}));

import { prisma } from "@/lib/db";
import { openSession, closeSession, recordSale } from "@/lib/operations/pos-service";
import { purchaseStock } from "@/lib/operations/stock-service";

let actor = { id: "", name: "" };
let propertyId = "";
let colaProductId = "";
let noodlesProductId = "";
let printProductId = ""; // no stock link (service product)
let memberId = "";
let runnable = false;

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  const cola = await prisma.posProduct.findUniqueOrThrow({ where: { name: "Coca-Cola can 330ml" }, include: { stockItem: true } });
  const noodles = await prisma.posProduct.findUniqueOrThrow({ where: { name: "Instant noodles pack" }, include: { stockItem: true } });
  const print = await prisma.posProduct.findUniqueOrThrow({ where: { name: "Print / scan service" } });
  colaProductId = cola.id;
  noodlesProductId = noodles.id;
  printProductId = print.id;
  propertyId = cola.stockItem!.propertyId;
  const member = await prisma.memberProfile.findFirstOrThrow({ where: { party: { email: "sophea.nuon@example.test" } } });
  memberId = member.id;
  // Seeded items start at 0 on-hand (purchases happen via flows) — stock up so
  // sales never fail INSUFFICIENT_STOCK regardless of suite order.
  const rootActor = { id: root.id, name: root.name };
  await purchaseStock(cola.stockItem!.id, { qtyMilli: 10_000, unitCostMinor: 60 }, rootActor, "test");
  await purchaseStock(noodles.stockItem!.id, { qtyMilli: 10_000, unitCostMinor: 150 }, rootActor, "test");
  runnable = true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("M14 POS flow", () => {
  let sessionId = "";
  const saleCodes: string[] = [];

  it("open session (only one open per property; float seeds the drawer)", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await openSession({ propertyId, openingFloatMinor: 5_000 }, actor, "test");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    sessionId = r.data.id;
    expect(r.data.expectedCashMinor).toBe(5_000);
    const dup = await openSession({ propertyId, openingFloatMinor: 0 }, actor, "test");
    expect(dup).toMatchObject({ ok: false, code: "SESSION_OPEN" });
  });

  it("sale 1: cash (2 colas) — drawer method, stock decremented", async (ctx) => {
    if (!runnable) ctx.skip();
    const stockBefore = (await prisma.posProduct.findUniqueOrThrow({ where: { id: colaProductId }, include: { stockItem: true } })).stockItem!.qtyMilli;
    const r = await recordSale({ sessionId, method: "cash", lines: [{ productId: colaProductId, qtyMilli: 2_000 }] }, actor, "test");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.totalMinor).toBe(200); // 2 × 1.00
    expect(r.data.code).toMatch(/^SAL-\d{4}-/);
    saleCodes.push(r.data.code);
    const stockAfter = (await prisma.posProduct.findUniqueOrThrow({ where: { id: colaProductId }, include: { stockItem: true } })).stockItem!.qtyMilli;
    expect(stockAfter).toBe(stockBefore - 2_000);
    const ledger = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "pos_sale", refId: r.data.saleId }, include: { entries: { include: { account: true } } } });
    expect(ledger.entries.find((e) => e.account.code === "1100")?.debit).toBe(200); // cash drawer
    expect(ledger.entries.find((e) => e.account.code === "4900")?.credit).toBe(200);
  });

  it("sale 2: QR (3 noodles) — bank leg, no stock link product also works", async (ctx) => {
    if (!runnable) ctx.skip();
    const noodlesStockBefore = (await prisma.posProduct.findUniqueOrThrow({ where: { id: noodlesProductId }, include: { stockItem: true } })).stockItem!.qtyMilli;
    const r = await recordSale({ sessionId, method: "qr", lines: [{ productId: noodlesProductId, qtyMilli: 3_000 }, { productId: printProductId, qtyMilli: 1_000 }], ref: "QRPAY-TEST" }, actor, "test");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.totalMinor).toBe(475); // 3 × 1.50 + 1 × 0.25
    saleCodes.push(r.data.code);
    const noodlesStockAfter = (await prisma.posProduct.findUniqueOrThrow({ where: { id: noodlesProductId }, include: { stockItem: true } })).stockItem!.qtyMilli;
    expect(noodlesStockAfter).toBe(noodlesStockBefore - 3_000);
    const ledger = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "pos_sale", refId: r.data.saleId } });
    void ledger;
    const bank = await prisma.ledgerEntry.findFirstOrThrow({ where: { transaction: { refType: "pos_sale", refId: r.data.saleId }, account: { code: "1200" } } });
    expect(bank.debit).toBe(475);
  });

  it("sale 3: charge-to-room — member invoice issued with one-time line + 1300 posting", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await recordSale({ sessionId, method: "room_charge", lines: [{ productId: colaProductId, qtyMilli: 1_000 }], memberProfileId: memberId }, actor, "test");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.invoiceCode).toMatch(/^BLR-POS-/);
    saleCodes.push(r.data.code);
    const sale = await prisma.posSale.findUniqueOrThrow({ where: { code: r.data.code }, include: { invoice: { include: { items: true } } } });
    expect(sale.invoice).not.toBeNull();
    expect(sale.invoice!.status).toBe("issued");
    expect(sale.invoice!.totalMinor).toBe(100);
    expect(sale.invoice!.amountDueMinor).toBe(100);
    expect(sale.invoice!.items.every((i) => i.kind === "one_time")).toBe(true);
    expect(sale.invoice!.items[0]!.name).toContain("POS");
    const ledger = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "invoice", refId: sale.invoice!.id }, include: { entries: { include: { account: true } } } });
    expect(ledger.entries.find((e) => e.account.code === "1300")?.debit).toBe(100); // member receivable
    expect(ledger.entries.find((e) => e.account.code === "4900")?.credit).toBe(100);
  });

  it("every sale filed a receipt PDF to M17 (entity SALE)", async (ctx) => {
    if (!runnable) ctx.skip();
    for (const code of saleCodes) {
      const sale = await prisma.posSale.findUniqueOrThrow({ where: { code } });
      expect(sale.receiptDocId).not.toBeNull();
      const doc = await prisma.documentRegistry.findUniqueOrThrow({ where: { id: sale.receiptDocId! } });
      expect(doc.entity).toBe("SALE");
      expect(doc.docTypeId).toBe("receipt");
    }
  });

  it("insufficient stock blocks the sale", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await recordSale({ sessionId, method: "cash", lines: [{ productId: colaProductId, qtyMilli: 1_000_000 }] }, actor, "test");
    expect(r).toMatchObject({ ok: false, code: "INSUFFICIENT_STOCK" });
  });

  it("close session: expected = float + cash sales; variance reported; cash-only methods counted", async (ctx) => {
    if (!runnable) ctx.skip();
    const closed = await closeSession(sessionId, { countedCashMinor: 6_900, note: "note: till short — float coin roll miscounted" }, actor, "test");
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    // cash sales: 200 (sale 1) — expected = 5000 + 200 = 5200; counted 6900 → +1700
    expect(closed.data.expectedCashMinor).toBe(5_200);
    expect(closed.data.varianceMinor).toBe(1_700);
    expect(closed.data.sales).toBe(3);
    const again = await closeSession(sessionId, { countedCashMinor: 0 }, actor, "test");
    expect(again).toMatchObject({ ok: false, code: "ALREADY_CLOSED" });
    const session = await prisma.posSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.status).toBe("closed");
    expect(session.closeNote).toContain("till short");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "pos_session", entityId: sessionId, action: "pos.session_closed" } });
    expect(audit.summary).toContain("variance");
  });

  it("sales after close are rejected", async (ctx) => {
    if (!runnable) ctx.skip();
    const r = await recordSale({ sessionId, method: "cash", lines: [{ productId: colaProductId, qtyMilli: 1_000 }] }, actor, "test");
    expect(r).toMatchObject({ ok: false, code: "SESSION_CLOSED" });
  });
});
