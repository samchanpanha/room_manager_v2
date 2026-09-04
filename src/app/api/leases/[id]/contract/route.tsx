import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { randomBytes } from "node:crypto";
import { clientIp, fail } from "@/lib/api";
import { authorize } from "@/lib/rbac/guard";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { LeaseContractPdf } from "@/lib/leases/contract-pdf";
import { storage } from "@/lib/storage";

/// GET /api/leases/:id/contract — generate (and first-time auto-file) the
/// lease contract PDF (M05 acceptance). Re-GET streams fresh bytes; `?refile=1`
/// files a new version into the document registry.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const refile = url.searchParams.get("refile") === "1";

  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: { include: { property: true } } } }, beds: true } },
      services: true
    }
  });
  if (!lease) return fail(404, "NOT_FOUND", "Lease not found");

  const g = await authorize("read", "M05", { propertyId: lease.propertyId });
  if (g.response) return g.response;

  const org = await prisma.setting.findUnique({ where: { key: "org.profile" } });
  const currency = org ? ((JSON.parse(org.value) as { currency?: string }).currency ?? "USD") : "USD";

  const data = {
    code: lease.code,
    status: lease.status,
    memberName: lease.member.party.name,
    memberEmail: lease.member.party.email,
    memberPhone: lease.member.party.phone,
    memberIdNumber: lease.member.idNumber,
    roomLabel: `${lease.room.floor.building.property.name} / ${lease.room.floor.building.name} / ${lease.room.floor.name} / Room ${lease.room.number}`,
    bedLabel: lease.bedId ? (lease.room.beds.find((b) => b.id === lease.bedId)?.label ?? "Bed") : null,
    startDate: lease.startDate.toISOString().slice(0, 10),
    endDate: lease.endDate ? lease.endDate.toISOString().slice(0, 10) : null,
    rentMinor: lease.rentAmountMinor,
    currency,
    billingCycleDay: lease.billingCycleDay,
    prorationBasis: lease.prorationBasis,
    depositMinor: lease.depositTotalMinor,
    depositInstallments: lease.depositInstallments,
    noticeDays: lease.noticeDays,
    autoRenew: lease.autoRenew,
    escalationPercent: lease.escalationPercent,
    services: lease.services.map((s) => ({ name: s.name, amountMinor: s.amountMinor, pricingModel: s.pricingModel })),
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + "Z"
  };

  const buffer = await renderToBuffer(<LeaseContractPdf data={data} />);

  // Auto-file the first (or forced) version into the M17 registry.
  const existing = await prisma.documentRegistry.findFirst({
    where: { entity: "LEASE", entityId: lease.id, docTypeId: "lease_contract" },
    orderBy: { version: "desc" }
  });
  if (!existing || refile) {
    const storageKey = randomBytes(16).toString("hex");
    await storage.put(storageKey, buffer);
    await prisma.documentRegistry.create({
      data: {
        docTypeId: "lease_contract",
        entity: "LEASE",
        entityId: lease.id,
        fileName: `lease-${lease.code}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
        storageKey,
        version: existing ? existing.version + 1 : 1,
        propertyId: lease.propertyId,
        uploadedById: g.user.id,
        notes: "Auto-generated contract PDF"
      }
    });
  }

  await logAudit({
    actorId: g.user.id,
    actorName: g.user.name,
    module: "M05",
    action: "read",
    entityType: "lease_contract_pdf",
    entityId: lease.id,
    summary: `Generated contract PDF for lease ${lease.code} (${(buffer.length / 1024).toFixed(1)} KB${!existing ? ", filed v1 to documents" : refile ? ", filed new version" : ""})`,
    propertyId: lease.propertyId,
    ip: clientIp(req)
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="lease-${lease.code}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
