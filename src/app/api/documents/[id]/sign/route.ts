import { clientIp, fail, ok } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { signDownloadToken, SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signing";

/// Issue a short-TTL signed download URL after RBDC + property scope check
/// (M17 acceptance: staff of another property cannot get a URL).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const doc = await prisma.documentRegistry.findUnique({ where: { id } });
  if (!doc) return fail(404, "NOT_FOUND", "Document not found");

  let resource: { propertyId?: string | null; ownerUserId?: string | null } = {};
  if (doc.entity === "OWNER" && !doc.propertyId) {
    const owner = await prisma.ownerProfile.findUnique({
      where: { id: doc.entityId },
      include: { party: { include: { users: { take: 1 } } } }
    });
    resource = { ownerUserId: owner?.party.users[0]?.id ?? null };
  } else if (doc.propertyId) {
    resource = { propertyId: doc.propertyId };
  }

  const g = await authorize("read", "M17", resource);
  if (g.response) return g.response;

  const token = signDownloadToken(doc.id);
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M17",
    action: "read",
    entityType: "document_signed_url",
    entityId: doc.id,
    summary: `Issued signed URL for "${doc.fileName}" (expires ${expiresAt.toISOString().slice(11, 19)}Z)`,
    propertyId: doc.propertyId,
    ip: clientIp(req)
  });
  return ok({ url: `/api/files/${token}`, expiresAt: expiresAt.toISOString() });
}
