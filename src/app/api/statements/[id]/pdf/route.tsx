import { fail } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { fileStatementPdf } from "@/lib/operations/statements-service";
import { statementsScope } from "@/lib/operations/statements-scope";

/// Serve the statement PDF; generates + files v1 on first request.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  void req;
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  const scope = await statementsScope(user);
  if (!scope.allowed) return fail(403, "FORBIDDEN", "Missing permission M24:read");
  const st = await prisma.ownerStatement.findUnique({ where: { id }, select: { code: true, ownerProfileId: true, propertyId: true } });
  if (!st) return fail(404, "NOT_FOUND", "Statement not found");
  if (scope.ownerProfileId ? st.ownerProfileId !== scope.ownerProfileId : !(scope.propertyIds ?? []).includes(st.propertyId)) {
    return fail(403, "FORBIDDEN", "Statement outside your scope");
  }

  let doc = await prisma.documentRegistry.findFirst({
    where: { entity: "STATEMENT", entityId: id, docTypeId: "statement" },
    orderBy: { version: "desc" }
  });
  if (!doc) {
    await fileStatementPdf(id);
    doc = await prisma.documentRegistry.findFirst({
      where: { entity: "STATEMENT", entityId: id, docTypeId: "statement" },
      orderBy: { version: "desc" }
    });
    if (!doc) return fail(500, "PDF_FAILED", "Could not generate the statement PDF");
  }
  const bytes = await storage.get(doc.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="statement-${st.code}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
