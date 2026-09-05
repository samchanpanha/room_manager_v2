import { randomBytes } from "node:crypto";
import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { storage } from "@/lib/storage";
import { signDownloadToken, SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signing";
import { validateUploadFile } from "@/lib/documents";

const PHOTO_TYPE = "stock_photo";
const MAX_FILE_NAME = 160;

/// M15 product photo — upload a PNG/JPEG/WebP blob to object storage and point
/// StockItem.imageDocId at the new DocumentRegistry row (versioned, append-only).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:update");

  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return fail(404, "NOT_FOUND", "Stock item not found");
  if (!can(user, "update", "M15", { propertyId: item.propertyId })) return fail(403, "FORBIDDEN", "Stock item is outside your property scope");

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
      entity: "STOCK_ITEM",
      entityId: item.id,
      fileName: (file.name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, MAX_FILE_NAME) || "product-photo"),
      mimeType: file.type,
      sizeBytes: buffer.length,
      storageKey,
      version: item.imageDocId ? 2 : 1,
      propertyId: item.propertyId,
      uploadedById: user.id,
      notes: "product photo"
    }
  });

  await prisma.stockItem.update({ where: { id: item.id }, data: { imageDocId: doc.id } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M15",
    action: "stock_item.image.uploaded",
    entityType: "stock_item",
    entityId: item.id,
    summary: `Uploaded photo "${doc.fileName}" (${(buffer.length / 1024).toFixed(0)} KB) for "${item.name}"`,
    propertyId: item.propertyId,
    ip: clientIp(req)
  });

  return ok({ docId: doc.id, sizeBytes: buffer.length });
}

/// M15 read — issue a short-TTL signed URL for the item's current photo.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:read");

  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return fail(404, "NOT_FOUND", "Stock item not found");
  if (!can(user, "read", "M15", { propertyId: item.propertyId })) return fail(403, "FORBIDDEN", "Stock item is outside your property scope");
  if (!item.imageDocId) return fail(404, "NO_PHOTO", "This item has no photo yet");

  const token = signDownloadToken(item.imageDocId);
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
  return ok({ url: `/api/files/${token}`, expiresAt: expiresAt.toISOString() });
}

/// M15 update — detach the photo pointer (registry row stays; storage is
/// append-only). Uploading again simply replaces the pointer with a new row.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M15")) return fail(403, "FORBIDDEN", "Missing permission M15:update");

  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) return fail(404, "NOT_FOUND", "Stock item not found");
  if (!can(user, "update", "M15", { propertyId: item.propertyId })) return fail(403, "FORBIDDEN", "Stock item is outside your property scope");

  await prisma.stockItem.update({ where: { id: item.id }, data: { imageDocId: null } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M15",
    action: "stock_item.image.removed",
    entityType: "stock_item",
    entityId: item.id,
    summary: `Removed photo of "${item.name}"`,
    propertyId: item.propertyId,
    ip: clientIp(_req)
  });

  return ok({ removed: true });
}