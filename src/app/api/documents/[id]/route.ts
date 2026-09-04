import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { storage } from "@/lib/storage";

/// Delete a mis-uploaded document (documents are not financial records;
/// financial artifacts are never deletable — INTENT.md §9.3).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const doc = await prisma.documentRegistry.findUnique({ where: { id } });
  if (!doc) return fail(404, "NOT_FOUND", "Document not found");

  const g = await authorize("delete", "M17", doc.propertyId ? { propertyId: doc.propertyId } : undefined);
  if (g.response) return g.response;

  await prisma.documentRegistry.delete({ where: { id } });
  await storage.remove(doc.storageKey);
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M17",
    action: "delete",
    entityType: "document",
    entityId: id,
    summary: `Deleted document "${doc.fileName}" (${doc.docTypeId} v${doc.version})`,
    propertyId: doc.propertyId,
    before: { fileName: doc.fileName, docTypeId: doc.docTypeId, version: doc.version },
    ip: clientIp(req)
  });
  return ok({ deleted: true });
}
