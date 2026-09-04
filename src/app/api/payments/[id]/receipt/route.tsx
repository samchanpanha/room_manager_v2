import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { fileReceiptPdf } from "@/lib/payments/service";
import { visiblePaymentScope, paymentInScope } from "@/lib/payments/visibility";

/// Serve the receipt PDF; generates + files v1 on first request.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  void req;
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M09")) return fail(403, "FORBIDDEN", "Missing permission M09:read");

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return fail(404, "NOT_FOUND", "Payment not found");
  const scope = await visiblePaymentScope(user, user.permissions);
  if (!paymentInScope(payment, scope)) return fail(403, "FORBIDDEN", "Payment outside your visible scope");

  let doc = await prisma.documentRegistry.findFirst({
    where: { entity: "PAYMENT", entityId: id, docTypeId: "receipt" },
    orderBy: { version: "desc" }
  });
  if (!doc) {
    await fileReceiptPdf(id);
    doc = await prisma.documentRegistry.findFirst({
      where: { entity: "PAYMENT", entityId: id, docTypeId: "receipt" },
      orderBy: { version: "desc" }
    });
    if (!doc) return fail(500, "PDF_FAILED", "Could not generate the receipt PDF");
  }
  const bytes = await storage.get(doc.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="receipt-${payment.receiptCode ?? payment.code}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
