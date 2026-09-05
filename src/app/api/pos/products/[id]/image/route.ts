import { randomBytes } from "node:crypto";
import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";
import { storage } from "@/lib/storage";
import { signDownloadToken, SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signing";
import { validateUploadFile } from "@/lib/documents";

const PHOTO_TYPE = "product_photo";
const MAX_FILE_NAME = 160;

/// M14 POS product photo — upload a PNG/JPEG/WebP blob to object storage and
/// point PosProduct.imageDocId at the new DocumentRegistry row (append-only).
async function loadProduct(id: string) {
  return prisma.posProduct.findUnique({ where: { id } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:update");

  const product = await loadProduct(id);
  if (!product) return fail(404, "NOT_FOUND", "Product not found");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "FILE_REQUIRED", "'file' field (multipart) is required");
  const check = validateUploadFile(file);
  if (!check.ok) return fail(422, "INVALID_FILE", check.message);

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = randomBytes(16).toString("hex");
  await storage.put(storageKey, buffer);

  const doc = await prisma.documentRegistry.create({
    data: {
      docTypeId: PHOTO_TYPE,
      entity: "POS_PRODUCT",
      entityId: product.id,
      fileName: (file.name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, MAX_FILE_NAME) || "product-photo"),
      mimeType: file.type,
      sizeBytes: buffer.length,
      storageKey,
      version: product.imageDocId ? 2 : 1,
      uploadedById: user.id,
      notes: "product photo"
    }
  });

  await prisma.posProduct.update({ where: { id: product.id }, data: { imageDocId: doc.id } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M14",
    action: "pos_product.image.uploaded",
    entityType: "pos_product",
    entityId: product.id,
    summary: `Uploaded photo "${doc.fileName}" (${(buffer.length / 1024).toFixed(0)} KB) for "${product.name}"`,
    ip: clientIp(req)
  });

  return ok({ docId: doc.id, sizeBytes: buffer.length });
}

/// M14 read — short-TTL signed URL for the product's current photo.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:read");

  const product = await loadProduct(id);
  if (!product) return fail(404, "NOT_FOUND", "Product not found");
  if (!product.imageDocId) return fail(404, "NO_PHOTO", "This product has no photo yet");

  const token = signDownloadToken(product.imageDocId);
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
  return ok({ url: `/api/files/${token}`, expiresAt: expiresAt.toISOString() });
}

/// M14 update — detach the photo pointer (registry row stays; storage is append-only).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M14")) return fail(403, "FORBIDDEN", "Missing permission M14:update");

  const product = await loadProduct(id);
  if (!product) return fail(404, "NOT_FOUND", "Product not found");

  await prisma.posProduct.update({ where: { id: product.id }, data: { imageDocId: null } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M14",
    action: "pos_product.image.removed",
    entityType: "pos_product",
    entityId: product.id,
    summary: `Removed photo of "${product.name}"`,
    ip: clientIp(_req)
  });

  return ok({ removed: true });
}