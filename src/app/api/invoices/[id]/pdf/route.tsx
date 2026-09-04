import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { canSeeInvoice } from "@/lib/billing/visibility";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { fileInvoicePdf } from "@/lib/billing/service";

/// Serve the invoice PDF; generates + files v1 on first request.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  void req;
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M07")) return fail(403, "FORBIDDEN", "Missing permission M07:read");
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return fail(404, "NOT_FOUND", "Invoice not found");
  if (!(await canSeeInvoice(user, invoice))) return fail(403, "FORBIDDEN", "Invoice outside your visible scope");

  let doc = await prisma.documentRegistry.findFirst({
    where: { entity: "INVOICE", entityId: id, docTypeId: "invoice" },
    orderBy: { version: "desc" }
  });
  if (!doc) {
    await fileInvoicePdf(id);
    doc = await prisma.documentRegistry.findFirst({
      where: { entity: "INVOICE", entityId: id, docTypeId: "invoice" },
      orderBy: { version: "desc" }
    });
    if (!doc) return fail(500, "PDF_FAILED", "Could not generate the invoice PDF");
  }
  const bytes = await storage.get(doc.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="invoice-${invoice.code}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
