import { randomBytes } from "node:crypto";
import { clientIp, fail, ok } from "@/lib/api";
import { getAuthUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hasModuleAccess } from "@/lib/rbac/can";
import { storage } from "@/lib/storage";
import { signDownloadToken, SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signing";
import { validateUploadFile } from "@/lib/documents";

const PHOTO_TYPE = "service_photo";
const MAX_FILE_NAME = 160;

/// M12 catalog photo — one image per ServiceCatalog row (versioned, append-only).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M12")) return fail(403, "FORBIDDEN", "Missing permission M12:update");

  const svc = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!svc) return fail(404, "NOT_FOUND", "Service not found");

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
      entity: "SERVICE_CATALOG",
      entityId: svc.id,
      fileName: (file.name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, MAX_FILE_NAME) || "service-photo"),
      mimeType: file.type,
      sizeBytes: buffer.length,
      storageKey,
      version: svc.imageDocId ? 2 : 1,
      uploadedById: user.id,
      notes: "service photo"
    }
  });

  await prisma.serviceCatalog.update({ where: { id: svc.id }, data: { imageDocId: doc.id } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M12",
    action: "service_catalog.image.uploaded",
    entityType: "service_catalog",
    entityId: svc.id,
    summary: `Uploaded photo "${doc.fileName}" (${(buffer.length / 1024).toFixed(0)} KB) for "${svc.name}"`,
    ip: clientIp(req)
  });

  return ok({ docId: doc.id, sizeBytes: buffer.length });
}

/// M12 read — short-TTL signed URL for the service's current photo.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "read", "M12")) return fail(403, "FORBIDDEN", "Missing permission M12:read");

  const svc = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!svc) return fail(404, "NOT_FOUND", "Service not found");
  if (!svc.imageDocId) return fail(404, "NO_PHOTO", "This service has no photo yet");

  const token = signDownloadToken(svc.imageDocId);
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000);
  return ok({ url: `/api/files/${token}`, expiresAt: expiresAt.toISOString() });
}

/// M12 update — detach the photo pointer (registry row stays; storage is append-only).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return fail(401, "UNAUTHENTICATED", "Sign in required");
  if (!hasModuleAccess(user, "update", "M12")) return fail(403, "FORBIDDEN", "Missing permission M12:update");

  const svc = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!svc) return fail(404, "NOT_FOUND", "Service not found");

  await prisma.serviceCatalog.update({ where: { id: svc.id }, data: { imageDocId: null } });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    module: "M12",
    action: "service_catalog.image.removed",
    entityType: "service_catalog",
    entityId: svc.id,
    summary: `Removed photo of "${svc.name}"`,
    ip: clientIp(_req)
  });

  return ok({ removed: true });
}