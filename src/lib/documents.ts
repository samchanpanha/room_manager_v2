/// Document service (M17 core) — upload metadata + private object storage.
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { storage, isAllowedMime, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const DOC_ENTITIES = ["MEMBER", "LEASE", "ROOM", "OWNER", "CONTRACT", "INVOICE", "PAYMENT", "INSPECTION", "SALE", "EXPENSE", "STATEMENT"] as const;
export type DocEntity = (typeof DOC_ENTITIES)[number];

export function isDocEntity(v: string): v is DocEntity {
  return (DOC_ENTITIES as readonly string[]).includes(v);
}

export interface UploadInput {
  file: File;
  docTypeId: string;
  entity: DocEntity;
  entityId: string;
  expiryDate?: Date | null;
  notes?: string | null;
  propertyId?: string | null;
  uploadedById?: string | null;
}

export function validateUploadFile(file: File): { ok: true } | { ok: false; message: string } {
  if (file.size === 0) return { ok: false, message: "File is empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit` };
  if (!isAllowedMime(file.type)) return { ok: false, message: `Type ${file.type || "unknown"} not allowed (PDF, PNG, JPEG, WEBP only)` };
  return { ok: true };
}

/// Persist the object and create a registry row (version = nth upload of the
/// same logical document). Returns the created row.
export async function uploadDocument(input: UploadInput) {
  const type = await prisma.docType.findUnique({ where: { id: input.docTypeId } });
  if (!type) throw new Error("Unknown document type");

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const storageKey = randomBytes(16).toString("hex");
  await storage.put(storageKey, buffer);

  const priorCount = await prisma.documentRegistry.count({
    where: { entity: input.entity, entityId: input.entityId, docTypeId: input.docTypeId }
  });

  const safeName = input.file.name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 160) || "document";
  const doc = await prisma.documentRegistry.create({
    data: {
      docTypeId: input.docTypeId,
      entity: input.entity,
      entityId: input.entityId,
      fileName: safeName,
      mimeType: input.file.type,
      sizeBytes: buffer.length,
      storageKey,
      version: priorCount + 1,
      expiryDate: input.expiryDate ?? null,
      notes: input.notes ?? null,
      propertyId: input.propertyId ?? null,
      uploadedById: input.uploadedById ?? null
    },
    include: { docType: true }
  });
  return doc;
}

/// Sync the member's kycCompletedAt after a KYC-relevant upload.
export async function refreshKycCompletion(memberId: string): Promise<boolean> {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    include: { party: true }
  });
  if (!member || member.kycCompletedAt) return false;
  const required = await prisma.docType.findMany({ where: { kycRequired: true } });
  const docs = await prisma.documentRegistry.findMany({
    where: { entity: "MEMBER", entityId: memberId },
    select: { docTypeId: true, expiryDate: true }
  });
  const { kycChecklist } = await import("@/lib/members/kyc");
  const result = kycChecklist(required.map((r) => r.id), docs);
  if (result.complete) {
    await prisma.memberProfile.update({ where: { id: memberId }, data: { kycCompletedAt: new Date() } });
    return true;
  }
  return false;
}
