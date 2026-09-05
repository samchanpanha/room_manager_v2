/// M18 Inspections service: draft → complete (+ PDF auto-file to M17),
/// findings → M19 ticket, move-out findings → M10 deposit deduction proposal
/// → approval (cross-links, matrix row 13). Permission checks live in the
/// routes; this module enforces business rules and state machines.
import * as React from "react"; // classic JSX runtime (tsx/vitest) needs React in scope
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/events";
import { getSettings } from "@/lib/settings";
import { nextNumber } from "@/lib/numbering";
import {
  canInspectionTransition,
  findingsFromItems,
  isFindingSeverity,
  isItemResult,
  parseTemplateSections,
  scoreItems,
  type CapturedItem,
  type FindingSeverity
} from "./inspections-machine";
import type { ActorCtx } from "@/lib/payments/service";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export async function getInspectionTemplateForRoom(roomType: string): Promise<{ id: string; sections: unknown } | null> {
  const exact = await prisma.inspectionTemplate.findFirst({ where: { roomType, isActive: true }, orderBy: { createdAt: "asc" } });
  const fallback = exact ?? (await prisma.inspectionTemplate.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  return fallback ? { id: fallback.id, sections: fallback.sections } : null;
}

/// Open a draft inspection for a lease (defaults to the lease's room and the
/// room type's active checklist template).
export async function createInspection(
  input: { type: string; leaseId: string; roomId?: string; templateId?: string; scheduledAt?: Date; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string; code: string }>> {
  if (!["move_in", "move_out", "periodic"].includes(input.type)) {
    return { ok: false, code: "INVALID_TYPE", message: "type must be move_in | move_out | periodic" };
  }
  const lease = await prisma.lease.findUnique({ where: { id: input.leaseId }, include: { room: true } });
  if (!lease) return { ok: false, code: "NOT_FOUND", message: "Lease not found" };
  const roomId = input.roomId ?? lease.roomId;
  if (!roomId) return { ok: false, code: "ROOM_REQUIRED", message: "Inspection needs a room" };

  let templateId = input.templateId ?? null;
  if (!templateId) {
    const picked = await getInspectionTemplateForRoom(lease.room.type);
    templateId = picked?.id ?? null;
  }

  const code = await nextNumber("INSP", (n) => `INSP-${new Date().getUTCFullYear()}-${String(n).padStart(4, "0")}`);
  const inspection = await prisma.inspection.create({
    data: {
      code,
      type: input.type,
      status: "draft",
      leaseId: lease.id,
      roomId,
      propertyId: lease.propertyId,
      templateId,
      scheduledAt: input.scheduledAt ?? null,
      summaryNote: input.note ?? null
    }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M18",
    action: "inspection.created",
    entityType: "inspection",
    entityId: inspection.id,
    summary: `${input.type} inspection ${code} opened for ${lease.code} (room ${lease.room.number})`,
    propertyId: lease.propertyId,
    ip
  });
  await emitDomainEvent("inspection.created", { inspectionId: inspection.id, code, type: input.type, leaseCode: lease.code }, lease.propertyId);
  return { ok: true, data: { id: inspection.id, code } };
}

function parseItems(raw: unknown): CapturedItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: CapturedItem[] = [];
  for (const r of raw) {
    const rec = r as Record<string, unknown>;
    const section = typeof rec.section === "string" ? rec.section : "";
    const item = typeof rec.item === "string" ? rec.item : "";
    const result = typeof rec.result === "string" ? rec.result : "";
    if (!item || !isItemResult(result)) return null;
    const severity = typeof rec.severity === "string" && isFindingSeverity(rec.severity) ? rec.severity : undefined;
    out.push({
      section,
      item,
      result,
      severity: severity as FindingSeverity | undefined,
      note: typeof rec.note === "string" ? rec.note.slice(0, 500) : undefined,
      photoDocId: typeof rec.photoDocId === "string" ? rec.photoDocId : undefined
    });
  }
  return out;
}

/// Complete a draft inspection: persist the captured checklist (immutable),
/// score it, create findings for failures and — for move_out — link the lease
/// (the §15 v1.1 hard gate reads this link). PDF files after commit.
export async function completeInspection(
  inspectionId: string,
  input: { items: unknown; summaryNote?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ id: string; code: string; overallScore: number; findings: number }>> {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId }, include: { lease: { include: { member: { include: { party: true } } } }, room: true, property: true } });
  if (!inspection) return { ok: false, code: "NOT_FOUND", message: "Inspection not found" };
  if (!canInspectionTransition(inspection.status, "completed")) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Cannot complete a ${inspection.status} inspection` };
  }
  const items = parseItems(input.items);
  if (!items) {
    return { ok: false, code: "ITEMS_INVALID", message: "items must be a non-empty array of {section, item, result: pass|fail|na}" };
  }
  const scored = scoreItems(items);
  const drafts = findingsFromItems(items);

  let templateSections: unknown = null;
  if (inspection.templateId) {
    const t = await prisma.inspectionTemplate.findUnique({ where: { id: inspection.templateId } });
    templateSections = t?.sections ?? null;
  }

  const created = await prisma.inspection.update({
    where: { id: inspection.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      items: JSON.stringify({ sections: templateSections ? parseTemplateSections(templateSections) : [], captured: items }),
      overallScore: scored.overallScore,
      summaryNote: input.summaryNote ?? inspection.summaryNote,
      findings: {
        create: drafts.map((d) => ({
          itemLabel: d.itemLabel,
          severity: d.severity,
          note: d.note,
          photoDocId: d.photoDocId ?? null
        }))
      }
    },
    include: { findings: true }
  });

  // §15 v1.1 hard gate hook: a completed move_out inspection links the lease.
  if (inspection.type === "move_out") {
    await prisma.lease.update({ where: { id: inspection.leaseId }, data: { moveOutInspectionId: inspection.id } });
  }

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M18",
    action: "inspection.completed",
    entityType: "inspection",
    entityId: inspection.id,
    summary: `${inspection.type} inspection ${inspection.code} completed — score ${scored.overallScore}/100, ${created.findings.length} finding(s) (${inspection.lease.code}, room ${inspection.room.number})`,
    propertyId: inspection.propertyId,
    after: { score: scored.overallScore, findings: created.findings.length },
    ip
  });
  await emitDomainEvent(
    "inspection.completed",
    { inspectionId: inspection.id, code: inspection.code, type: inspection.type, score: scored.overallScore, findings: created.findings.length, leaseCode: inspection.lease.code },
    inspection.propertyId
  );

  // PDF report auto-saved to M17 (after commit; never blocks completion).
  await fileInspectionPdf(inspection.id).catch(() => undefined);

  return { ok: true, data: { id: inspection.id, code: inspection.code, overallScore: scored.overallScore, findings: created.findings.length } };
}

/// Render + file the report PDF (M17 registry, entity INSPECTION).
export async function fileInspectionPdf(inspectionId: string): Promise<void> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { InspectionPdf } = await import("./inspection-pdf");
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      property: true,
      room: true,
      lease: { include: { member: { include: { party: true } } } },
      template: true,
      findings: true
    }
  });
  if (!inspection) throw new Error("Inspection not found");
  const { org } = await getSettings();

  const parsed = (() => {
    try {
      const v = JSON.parse(String(inspection.items ?? "{}")) as { captured?: CapturedItem[] };
      return Array.isArray(v.captured) ? v.captured : [];
    } catch {
      return [];
    }
  })();
  const sectionsMap = new Map<string, Array<{ item: string; result: string; severity?: string; note?: string }>>();
  for (const it of parsed) {
    const list = sectionsMap.get(it.section || "Checklist") ?? [];
    list.push({ item: it.item, result: it.result, severity: it.result === "fail" ? (it.severity ?? "minor") : undefined, note: it.note });
    sectionsMap.set(it.section || "Checklist", list);
  }

  const { storage } = await import("@/lib/storage");
  const buffer = await renderToBuffer(
    <InspectionPdf
      data={{
        code: inspection.code,
        type: inspection.type,
        status: inspection.status,
        orgName: org.name ?? "RentManager",
        propertyName: inspection.property.name,
        roomLabel: inspection.room.number,
        memberName: inspection.lease.member.party.name,
        leaseCode: inspection.lease.code,
        scheduledAt: inspection.scheduledAt,
        completedAt: inspection.completedAt,
        overallScore: inspection.overallScore,
        summaryNote: inspection.summaryNote,
        sections: [...sectionsMap.entries()].map(([title, items]) => ({ title, items })),
        findings: inspection.findings.map((f) => ({ itemLabel: f.itemLabel, severity: f.severity, note: f.note }))
      }}
    />
  );

  const existing = await prisma.documentRegistry.findFirst({
    where: { entity: "INSPECTION", entityId: inspectionId, docTypeId: "inspection_report" },
    orderBy: { version: "desc" }
  });
  if (existing) return; // reports are written once
  const { randomBytes } = await import("node:crypto");
  const storageKey = randomBytes(16).toString("hex");
  await storage.put(storageKey, buffer);
  const doc = await prisma.documentRegistry.create({
    data: {
      docTypeId: "inspection_report",
      entity: "INSPECTION",
      entityId: inspectionId,
      fileName: `inspection-${inspection.code}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: buffer.length,
      storageKey,
      version: 1,
      propertyId: inspection.propertyId,
      notes: "Auto-generated inspection report PDF"
    }
  });
  await prisma.inspection.update({ where: { id: inspectionId }, data: { reportDocId: doc.id } });
}

/// Finding → M19: open a maintenance ticket from a finding (cross-link).
export async function openFindingTicket(
  findingId: string,
  input: { category?: string; priority?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ ticketCode: string }>> {
  const finding = await prisma.inspectionFinding.findUnique({ where: { id: findingId }, include: { inspection: { include: { lease: true, room: true } } } });
  if (!finding) return { ok: false, code: "NOT_FOUND", message: "Finding not found" };
  if (finding.ticketId) return { ok: false, code: "TICKET_EXISTS", message: "This finding already has a maintenance ticket" };
  const { createTicket } = await import("./maintenance-service");
  const ticket = await createTicket(
    {
      propertyId: finding.inspection.propertyId,
      roomId: finding.inspection.roomId,
      leaseId: finding.inspection.leaseId,
      category: input.category ?? "other",
      priority: input.priority ?? (finding.severity === "critical" ? "urgent" : finding.severity === "major" ? "high" : "medium"),
      title: `Inspection finding: ${finding.itemLabel}`,
      description: `${finding.inspection.code} (${finding.inspection.type}) room ${finding.inspection.room.number}: ${finding.note}`,
      source: "staff"
    },
    actor,
    ip
  );
  if (!ticket.ok) return ticket;
  await prisma.inspectionFinding.update({ where: { id: findingId }, data: { ticketId: ticket.data.id } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M18",
    action: "finding.ticket_opened",
    entityType: "inspection_finding",
    entityId: findingId,
    summary: `Finding "${finding.itemLabel}" → maintenance ticket ${ticket.data.code}`,
    propertyId: finding.inspection.propertyId,
    ip
  });
  return { ok: true, data: { ticketCode: ticket.data.code } };
}

/// Finding → M10: propose a deposit deduction from a move-out finding.
export async function proposeFindingDeduction(
  findingId: string,
  input: { amountMinor: number; reason?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ deductionMinor: number }>> {
  const finding = await prisma.inspectionFinding.findUnique({ where: { id: findingId }, include: { inspection: true } });
  if (!finding) return { ok: false, code: "NOT_FOUND", message: "Finding not found" };
  if (finding.inspection.type !== "move_out") {
    return { ok: false, code: "MOVE_OUT_ONLY", message: "Only move-out findings can propose deposit deductions" };
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Deduction must be a positive integer (minor units)" };
  }
  if (finding.deductionStatus === "approved") return { ok: false, code: "ALREADY_APPROVED", message: "Deduction already approved in M10" };
  await prisma.inspectionFinding.update({
    where: { id: findingId },
    data: { deductionMinor: input.amountMinor, deductionStatus: "proposed" }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M18",
    action: "finding.deduction_proposed",
    entityType: "inspection_finding",
    entityId: findingId,
    summary: `Deduction proposal ${(input.amountMinor / 100).toFixed(2)} (${input.reason ?? "damage"}) from finding "${finding.itemLabel}" (${finding.inspection.code})`,
    propertyId: finding.inspection.propertyId,
    after: { amountMinor: input.amountMinor, reason: input.reason ?? "damage" },
    ip
  });
  return { ok: true, data: { deductionMinor: input.amountMinor } };
}

/// M10 approval: executes the actual deposit deduction (M10:update enforced
/// in the route) and marks the finding approved with the deposit tx link.
export async function approveFindingDeduction(
  findingId: string,
  input: { reason?: string; note?: string },
  actor: ActorCtx,
  ip?: string | null
): Promise<Result<{ remainingMinor: number }>> {
  const finding = await prisma.inspectionFinding.findUnique({ where: { id: findingId }, include: { inspection: { include: { lease: true } } } });
  if (!finding) return { ok: false, code: "NOT_FOUND", message: "Finding not found" };
  if (finding.deductionMinor == null || finding.deductionStatus !== "proposed") {
    return { ok: false, code: "NO_PROPOSAL", message: "Propose the deduction first" };
  }
  const deposit = await prisma.deposit.findUnique({ where: { leaseId: finding.inspection.leaseId } });
  if (!deposit) return { ok: false, code: "NO_DEPOSIT", message: "No deposit held for this lease" };
  const evidenceDocId = finding.photoDocId ?? finding.inspection.reportDocId;
  if (!evidenceDocId) return { ok: false, code: "EVIDENCE_REQUIRED", message: "Finding has no photo or report document to use as evidence" };
  const { deductDeposit } = await import("@/lib/deposits/service");
  const result = await deductDeposit(
    deposit.id,
    {
      amountMinor: finding.deductionMinor,
      reason: input.reason ?? "damage",
      evidenceDocId,
      note: input.note ?? `Approved from inspection finding "${finding.itemLabel}" (${finding.inspection.code})`
    },
    actor,
    ip
  );
  if (!result.ok) return result;
  const tx = await prisma.depositTransaction.findFirst({ where: { depositId: deposit.id, type: "deduction" }, orderBy: { createdAt: "desc" } });
  await prisma.inspectionFinding.update({
    where: { id: findingId },
    data: { deductionStatus: "approved", deductionTxId: tx?.id ?? null }
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M18",
    action: "finding.deduction_approved",
    entityType: "inspection_finding",
    entityId: findingId,
    summary: `Deduction ${(finding.deductionMinor / 100).toFixed(2)} approved in M10 from finding "${finding.itemLabel}" — deposit remaining ${(result.remainingMinor / 100).toFixed(2)}`,
    propertyId: finding.inspection.propertyId,
    ip
  });
  return { ok: true, data: { remainingMinor: result.remainingMinor } };
}

/// Reject a deduction proposal (M10:update or M18:update holders — route).
export async function dismissFindingDeduction(findingId: string, reason: string, actor: ActorCtx, ip?: string | null): Promise<Result<{ status: string }>> {
  const finding = await prisma.inspectionFinding.findUnique({ where: { id: findingId }, include: { inspection: true } });
  if (!finding) return { ok: false, code: "NOT_FOUND", message: "Finding not found" };
  if (finding.deductionStatus === "approved") return { ok: false, code: "ALREADY_APPROVED", message: "Approved deductions cannot be dismissed" };
  await prisma.inspectionFinding.update({ where: { id: findingId }, data: { deductionStatus: "dismissed" } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    module: "M18",
    action: "finding.deduction_dismissed",
    entityType: "inspection_finding",
    entityId: findingId,
    summary: `Deduction proposal dismissed: ${reason}`,
    propertyId: finding.inspection.propertyId,
    ip
  });
  return { ok: true, data: { status: "dismissed" } };
}
