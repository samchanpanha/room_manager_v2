import { z } from "zod";
import { clientIp, fail, ok, parseBody } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { recordSale } from "@/lib/operations/pos-service";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  sessionId: z.string().min(1),
  method: z.enum(["cash", "qr", "card", "room_charge"]),
  lines: z.array(z.object({ productId: z.string().min(1), qty: z.coerce.number().positive().max(10_000) })).min(1).max(50),
  memberProfileId: z.string().min(1).optional(),
  stayBookingId: z.string().min(1).optional(),
  ref: z.string().max(120).optional(),
  discountMinor: z.number().int().min(0).max(100_000_000).optional(),
  discountLabel: z.string().max(80).optional()
});

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:read");
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const sales = await prisma.posSale.findMany({
    where: sessionId ? { sessionId } : {},
    include: { items: true, member: { include: { party: true } }, invoice: { select: { stayBooking: { select: { code: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return ok({
    sales: sales.map((s) => ({
      id: s.id,
      code: s.code,
      method: s.method,
      totalMinor: s.totalMinor,
      discountMinor: s.discountMinor,
      discountLabel: s.discountLabel,
      member: s.member ? s.member.party.name : null,
      invoiceId: s.invoiceId,
      tabCode: s.invoice?.stayBooking?.code ?? null,
      receiptDocId: s.receiptDocId,
      createdAt: s.createdAt,
      lines: s.items.map((i) => ({ name: i.name, qtyMilli: i.qtyMilli, lineMinor: i.lineMinor }))
    }))
  });
}

/// §M14 sale: cash/qr/card or charge-to-room; stock decremented (M15).
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.response) return parsed.response;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const session = await prisma.posSession.findUnique({ where: { id: parsed.data.sessionId } });
  if (!session) return fail(404, "NOT_FOUND", "Session not found");
  if (!can(user, "create", "M14", { propertyId: session.propertyId })) return fail(403, "FORBIDDEN", "Missing permission M14:create for this property");
  const result = await recordSale(
    {
      sessionId: parsed.data.sessionId,
      method: parsed.data.method,
      lines: parsed.data.lines.map((l) => ({ productId: l.productId, qtyMilli: Math.round(l.qty * 1000) })),
      memberProfileId: parsed.data.memberProfileId,
      stayBookingId: parsed.data.stayBookingId,
      ref: parsed.data.ref,
      discountMinor: parsed.data.discountMinor,
      discountLabel: parsed.data.discountLabel
    },
    { id: user.id, name: user.name },
    clientIp(req)
  );
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" || result.code === "PRODUCT_INVALID" ? 404 : result.code === "INVALID_QTY" || result.code === "MEMBER_REQUIRED" || result.code === "LINES_REQUIRED" ? 422 : 422;
    return fail(status, result.code, result.message);
  }

  // §M28 printer flow: tell the POS terminal how to print after the sale.
  const { printer } = await getSettings();
  const productIds = parsed.data.lines.map((l) => l.productId);
  const hasBarcoded = productIds.length > 0
    ? await prisma.posProduct.findFirst({ where: { id: { in: productIds }, barcode: { not: null } }, select: { id: true } })
    : null;

  return ok(
    {
      ...result.data,
      print: {
        autoPrintReceipt: printer.autoPrintReceipt ?? false,
        receiptCopies: Math.max(1, Math.min(12, printer.receiptCopies ?? 1)),
        receiptUrl: `/api/pos/sales/${result.data.saleId}/receipt`,
        printBarcodeByDefault: printer.printBarcodeByDefault ?? false,
        labelUrl: hasBarcoded ? `/api/pos/products/label?ids=${productIds.join(",")}&p=1` : undefined
      }
    },
    201
  );
}
