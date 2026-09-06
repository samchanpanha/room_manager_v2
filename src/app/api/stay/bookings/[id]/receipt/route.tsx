import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess, can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { buildStayReceiptBytes, fileStayReceipt } from "@/lib/operations/stay-receipt";

/// Serve a stay checkout receipt PDF. `copies` (1–12) renders N slips in one
/// document so a thermal printer prints the requested number of receipts per
/// checkout — honours the M28 printer settings wired at checkout time.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M32")) return fail(403, "FORBIDDEN", "Missing permission M32:read");

  const booking = await prisma.stayBooking.findUnique({ where: { id }, select: { propertyId: true, code: true } });
  if (!booking) return fail(404, "NOT_FOUND", "Booking not found");
  if (!can(user, "read", "M32", { propertyId: booking.propertyId })) return fail(403, "FORBIDDEN", "Booking outside your visible scope");

  const url = new URL(req.url);
  const copies = Math.max(1, Math.min(12, Number(url.searchParams.get("copies") ?? 1) || 1));

  if (copies > 1) {
    const buffer = await buildStayReceiptBytes(id, copies);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="receipt-${booking.code}.pdf"`,
        "Cache-Control": "private, no-store"
      }
    });
  }

  let doc = await prisma.documentRegistry.findFirst({
    where: { entity: "STAY_BOOKING", entityId: id, docTypeId: "receipt" },
    orderBy: { version: "desc" }
  });
  if (!doc) {
    await fileStayReceipt(id);
    doc = await prisma.documentRegistry.findFirst({
      where: { entity: "STAY_BOOKING", entityId: id, docTypeId: "receipt" },
      orderBy: { version: "desc" }
    });
    if (!doc) return fail(500, "PDF_FAILED", "Could not generate the receipt PDF");
  }
  const bytes = await storage.get(doc.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="receipt-${booking.code}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
