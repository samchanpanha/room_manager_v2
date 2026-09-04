import { fail, ok, clientIp } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { DOC_ENTITIES, isDocEntity, refreshKycCompletion, uploadDocument, validateUploadFile } from "@/lib/documents";
import { isExpiringWithin } from "@/lib/members/kyc";

const metaSchema = z.object({
  docTypeId: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().max(300).optional()
});

/// Multipart upload (M17). Permission = M17:create + property scope of the owning record.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "INVALID_FORM", "Expected multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "FILE_REQUIRED", "A file is required");
  const metaParsed = metaSchema.safeParse({
    docTypeId: form.get("docTypeId"),
    entity: form.get("entity"),
    entityId: form.get("entityId"),
    expiryDate: form.get("expiryDate") || undefined,
    notes: form.get("notes") || undefined
  });
  if (!metaParsed.success) {
    const first = metaParsed.error.issues[0];
    return fail(400, "VALIDATION_ERROR", `${first.path.join(".")}: ${first.message}`);
  }
  const meta = metaParsed.data;
  if (!isDocEntity(meta.entity)) return fail(400, "INVALID_ENTITY", `entity must be one of ${DOC_ENTITIES.join(", ")}`);

  // Resolve scope resources from the owning record.
  let scopeResource: { propertyId?: string | null; ownerUserId?: string | null } = {};
  let propertyId: string | null = null;
  let auditName: string;

  if (meta.entity === "MEMBER") {
    const member = await prisma.memberProfile.findUnique({ where: { id: meta.entityId }, include: { party: { include: { users: { take: 1 } } } } });
    if (!member) return fail(404, "NOT_FOUND", "Member not found");
    propertyId = member.homePropertyId;
    // §M25: the member's own portal user is the OWN-scope owner of their docs.
    scopeResource = { propertyId, ownerUserId: member.party.users[0]?.id ?? null };
    auditName = member.party.name;
  } else if (meta.entity === "EXPENSE") {
    // §M20 receipt attachment — scoped to the expense's property.
    const expense = await prisma.expense.findUnique({ where: { id: meta.entityId }, select: { propertyId: true, code: true } });
    if (!expense) return fail(404, "NOT_FOUND", "Expense not found");
    propertyId = expense.propertyId;
    scopeResource = { propertyId };
    auditName = expense.code;
  } else if (meta.entity === "OWNER") {
    const owner = await prisma.ownerProfile.findUnique({ where: { id: meta.entityId }, include: { party: { include: { users: { take: 1 }, } } } });
    if (!owner) return fail(404, "NOT_FOUND", "Owner not found");
    scopeResource = { ownerUserId: owner.party.users[0]?.id ?? null };
    auditName = owner.party.name;
  } else {
    return fail(400, "UNSUPPORTED_ENTITY", "Only MEMBER and OWNER documents are supported until Phase 5+");
  }

  const g = await authorize("create", "M17", scopeResource);
  if (g.response) return g.response;

  const fileCheck = validateUploadFile(file);
  if (!fileCheck.ok) return fail(400, "INVALID_FILE", fileCheck.message);

  try {
    const doc = await uploadDocument({
      file,
      docTypeId: meta.docTypeId,
      entity: meta.entity,
      entityId: meta.entityId,
      expiryDate: meta.expiryDate ? new Date(meta.expiryDate) : null,
      notes: meta.notes ?? null,
      propertyId,
      uploadedById: g.user.id
    });

    const kycCompleted = meta.entity === "MEMBER" ? await refreshKycCompletion(meta.entityId) : false;

    // §M20: an EXPENSE upload attaches itself as the expense's receipt (if not already linked).
    if (meta.entity === "EXPENSE") {
      await prisma.expense.updateMany({ where: { id: meta.entityId, receiptDocId: null }, data: { receiptDocId: doc.id } });
    }

    await logAudit({
      actorId: g.user.id,
      actorName: g.user.name,
      module: "M17",
      action: "create",
      entityType: "document",
      entityId: doc.id,
      summary: `Uploaded ${doc.docType.name} (v${doc.version}) for ${meta.entity.toLowerCase()} ${auditName}${doc.expiryDate ? `, expires ${doc.expiryDate.toISOString().slice(0, 10)}` : ""}${kycCompleted ? " — KYC checklist now complete" : ""}`,
      propertyId,
      after: { docTypeId: doc.docTypeId, version: doc.version, sizeBytes: doc.sizeBytes },
      ip: clientIp(req)
    });
    await emitDomainEvent(
      "document.uploaded",
      { documentId: doc.id, docTypeId: doc.docTypeId, entity: meta.entity, entityId: meta.entityId, version: doc.version },
      propertyId
    );
    if (doc.expiryDate && isExpiringWithin(doc.expiryDate, 45)) {
      await emitDomainEvent(
        "document.expiry_upcoming",
        {
          documentId: doc.id,
          entity: meta.entity,
          entityId: meta.entityId,
          name: auditName,
          docType: doc.docType.name,
          expiresAt: doc.expiryDate.toISOString(),
          reminder: isExpiringWithin(doc.expiryDate, 7) ? "7-day" : "30-day"
        },
        propertyId
      );
    }
    return ok({ id: doc.id, version: doc.version, kycCompleted }, 201);
  } catch (e) {
    return fail(400, "UPLOAD_FAILED", e instanceof Error ? e.message : "Upload failed");
  }
}

/// List documents for an entity (M17:read + scope).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  const entityId = url.searchParams.get("entityId");
  if (!entity || !entityId) return fail(400, "PARAMS_REQUIRED", "entity and entityId are required");
  if (!isDocEntity(entity)) return fail(400, "INVALID_ENTITY", "Unknown entity");

  const g = await authorize("read", "M17");
  if (g.response) return g.response;

  let resource: { propertyId?: string | null; ownerUserId?: string | null } = {};
  if (entity === "MEMBER") {
    const member = await prisma.memberProfile.findUnique({ where: { id: entityId }, include: { party: { include: { users: { take: 1 } } } } });
    if (!member) return fail(404, "NOT_FOUND", "Member not found");
    resource = { propertyId: member.homePropertyId, ownerUserId: member.party.users[0]?.id ?? null };
  } else if (entity === "OWNER") {
    const owner = await prisma.ownerProfile.findUnique({
      where: { id: entityId },
      include: { party: { include: { users: { take: 1 } } } }
    });
    if (!owner) return fail(404, "NOT_FOUND", "Owner not found");
    resource = { ownerUserId: owner.party.users[0]?.id ?? null };
  }
  const { can } = await import("@/lib/rbac/can");
  if (!can(g.user, "read", "M17", resource)) {
    return fail(403, "FORBIDDEN", "Missing permission M17:read for this scope");
  }

  const docs = await prisma.documentRegistry.findMany({
    where: { entity, entityId },
    include: { docType: true, uploadedBy: { select: { name: true } } },
    orderBy: [{ docTypeId: "asc" }, { version: "desc" }]
  });
  return ok({ docs });
}
