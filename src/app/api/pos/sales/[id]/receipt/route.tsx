import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { buildSaleReceiptBytes, fileSaleReceipt } from "@/lib/operations/pos-service";

/// Serve a POS receipt PDF. `copies` (1–12) renders N slips in one document
/// so a thermal printer prints the requested number of receipts per sale —
/// honours the M28 printer settings wired at sale time.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!can(user, "read", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:read");

  const sale = await prisma.posSale.findUnique({ where: { id } });
  if (!sale) return fail(404, "NOT_FOUND", "Sale not found");
  if (!can(user, "read", "M14", { propertyId: sale.propertyId })) return fail(403, "FORBIDDEN", "Sale outside your visible scope");

  const url = new URL(req.url);
  const copies = Math.max(1, Math.min(12, Number(url.searchParams.get("copies") ?? 1) || 1));

  if (copies > 1) {
    const buffer = await buildSaleReceiptBytes(id, copies);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="receipt-${sale.code}.pdf"`,
        "Cache-Control": "private, no-store"
      }
    });
  }

  let doc = await prisma.documentRegistry.findFirst({
    where: { entity: "SALE", entityId: id, docTypeId: "receipt" },
    orderBy: { version: "desc" }
  });
  if (!doc) {
    await fileSaleReceipt(id);
    doc = await prisma.documentRegistry.findFirst({
      where: { entity: "SALE", entityId: id, docTypeId: "receipt" },
      orderBy: { version: "desc" }
    });
    if (!doc) return fail(500, "PDF_FAILED", "Could not generate the receipt PDF");
  }
  const bytes = await storage.get(doc.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="receipt-${sale.code}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}