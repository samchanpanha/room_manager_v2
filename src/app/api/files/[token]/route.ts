import { fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { verifyDownloadToken } from "@/lib/storage/signing";

/// Signed-URL file server (M17). No session required — the token is the
/// credential: HMAC-signed, bound to a document, expired tokens are rejected.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyDownloadToken(token);
  if (!payload) return fail(403, "BAD_SIGNATURE", "Invalid or expired signed URL");

  const doc = await prisma.documentRegistry.findUnique({ where: { id: payload.docId } });
  if (!doc) return fail(404, "NOT_FOUND", "Document not found");

  try {
    const data = await storage.get(doc.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${doc.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return fail(404, "OBJECT_MISSING", "Stored object is missing");
  }
}
