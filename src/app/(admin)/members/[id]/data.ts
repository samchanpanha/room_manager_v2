/// Server-side data loader for the member detail tabs.
import { prisma } from "@/lib/db";
import { isExpired, isExpiringWithin } from "@/lib/members/kyc";

export async function docTypeRequiresExpiryList(): Promise<void> {
  // Kept as a stable export marker for the page module; no runtime work.
}

export async function loadMemberTabData(memberId: string) {
  const [documents, docTypes] = await Promise.all([
    prisma.documentRegistry.findMany({
      where: { entity: "MEMBER", entityId: memberId },
      include: { docType: true, uploadedBy: { select: { name: true } } },
      orderBy: [{ docTypeId: "asc" }, { version: "desc" }]
    }),
    prisma.docType.findMany({ orderBy: { sortOrder: "asc" } })
  ]);

  const now = new Date();
  const expiringCount = documents.filter(
    (d) => !isExpired(d.expiryDate, now) && isExpiringWithin(d.expiryDate, 45, now)
  ).length;

  return {
    documents: documents.map((d) => ({
      id: d.id,
      docTypeId: d.docTypeId,
      docTypeName: d.docType.name,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      version: d.version,
      expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
      notes: d.notes,
      uploadedBy: d.uploadedBy?.name ?? "system",
      createdAt: d.createdAt.toISOString(),
      expired: isExpired(d.expiryDate, now),
      expiringSoon: !isExpired(d.expiryDate, now) && isExpiringWithin(d.expiryDate, 45, now)
    })),
    docTypes: docTypes.map((d) => ({
      id: d.id,
      name: d.name,
      kycRequired: d.kycRequired,
      requiresExpiry: d.requiresExpiry
    })),
    documentIds: documents.map((d) => d.id),
    expiringCount
  };
}
