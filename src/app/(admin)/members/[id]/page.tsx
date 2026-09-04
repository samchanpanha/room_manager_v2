import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { MemberPayQrCard } from "./pay-qr-card";
import { docTypeRequiresExpiryList, loadMemberTabData } from "./data";
import { MemberTabs } from "./member-tabs";
import { kycChecklist } from "@/lib/members/kyc";
import { formatDate, timeAgo } from "@/lib/utils";
import { formatMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) notFound();

  const member = await prisma.memberProfile.findUnique({
    where: { id },
    include: {
      party: true,
      homeProperty: true,
      emergencyContacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      roomMoves: {
        orderBy: { effectiveAt: "asc" },
        include: { toRoom: true, newLease: true, adjustmentInvoice: true }
      }
    }
  });
  if (!member) notFound();

  const scope = member.homePropertyId ? { propertyId: member.homePropertyId } : undefined;
  if (!can(user, "read", "M02", scope)) {
    return <EmptyState title="No access to this member" hint="Members are scoped by property for PROPERTY-scoped roles." />;
  }
  // M13: show the scan-to-pay QR to the member themself or to users who can create QR payments in scope.
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const invoiceCandidate = ownMemberId === member.id || can(user, "create", "M13", scope);

  const data = await loadMemberTabData(id);
  const requiredTypes = await prisma.docType.findMany({ where: { kycRequired: true } });
  const checklist = kycChecklist(
    requiredTypes.map((r) => r.id),
    data.documents.map((d) => ({ docTypeId: d.docTypeId, expiryDate: d.expiryDate ? new Date(d.expiryDate) : null }))
  );

  const activity = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: { in: ["member", "member_status", "member_blacklist", "emergency_contact", "document"] }, entityId: { in: [id, ...data.documentIds] } },
        { entityType: "member_document", entityId: { in: data.documentIds } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 15
  });

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/members" className="underline underline-offset-4 hover:text-foreground">
          Members
        </Link>{" "}
        / <span className="text-foreground">{member.party.name}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {member.party.name}
            {member.blacklisted ? <Badge variant="destructive">blacklisted</Badge> : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {member.party.email ?? "no email"} · {member.party.phone ?? "no phone"} ·{" "}
            {member.homeProperty ? `home: ${member.homeProperty.code}` : "no property"} · onboarded {formatDate(member.createdAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={member.status === "active" ? "success" : member.status === "verified" ? "info" : "outline"}>
              {member.status}
            </Badge>
            {member.kycCompletedAt ? (
              <Badge variant="success">KYC complete</Badge>
            ) : (
              <Badge variant="warning">
                KYC pending{checklist.missing.length > 0 ? `: ${checklist.missing.join(", ")}` : ""}
              </Badge>
            )}
            {data.expiringCount > 0 ? <Badge variant="warning">{data.expiringCount} doc(s) expiring ≤45d</Badge> : null}
            <Link
              href={`/members/${member.id}/statement`}
              className="text-xs underline underline-offset-4 hover:text-foreground"
            >
              Ledger statement →
            </Link>
          </div>
        </div>
      </div>

      <MemberTabs
        member={{
          id: member.id,
          name: member.party.name,
          phone: member.party.phone,
          nationality: member.nationality,
          idNumber: member.idNumber,
          occupation: member.occupation,
          monthlyIncomeMinor: member.monthlyIncomeMinor,
          notes: member.notes,
          status: member.status,
          blacklisted: member.blacklisted,
          blacklistReason: member.blacklistReason,
          nextStatuses: nextStatusesFor(member.status, member.blacklisted)
        }}
        contacts={member.emergencyContacts.map((c) => ({
          id: c.id,
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          email: c.email,
          isPrimary: c.isPrimary
        }))}
        documents={data.documents}
        docTypes={data.docTypes}
        flags={{
          canUpdate: can(user, "update", "M02", scope),
          canReadDocs: can(user, "read", "M17", scope),
          canUploadDocs: can(user, "create", "M17", scope),
          canDeleteDocs: can(user, "delete", "M17", scope)
        }}
        activity={
          <ul className="space-y-2.5">
            {activity.length === 0 ? <li className="text-sm text-muted-foreground">No activity recorded yet.</li> : null}
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p>{a.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actorName} · {a.module}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        }
      />

      {(() => {
        const mv = member.roomMoves;
        if (mv.length === 0) return null;
        return (
          <Card className="mt-6">
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Room move history ({mv.length})</h2>
              <ol className="space-y-3">
                {mv.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{m.effectiveAt.toISOString().slice(0, 10)}</span>
                    <div>
                      <p>
                        <Badge variant={m.status === "executed" ? "success" : m.status === "cancelled" ? "secondary" : "warning"}>{m.status}</Badge>{" "}
                        moved to room <span className="font-medium">{m.toRoom.number}</span>
                        {m.newLease ? (
                          <>
                            {" "}
                            — lease <span className="font-mono text-xs">{m.newLease.code}</span>
                          </>
                        ) : null}
                        {m.adjustmentInvoice ? (
                          <>
                            {" "}
                            · adjustment <Link href={`/invoices/${m.adjustmentInvoiceId}`} className="font-mono text-xs underline underline-offset-4">{m.adjustmentInvoice.code}</Link>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.code} · requested by {m.requestedByRole} · proration delta {formatMinor(m.netMinor ?? 0)}
                        {m.inspectionsNote ? ` · inspections: ${m.inspectionsNote}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })()}

      {invoiceCandidate ? <MemberPayQrCard memberId={member.id} /> : null}

      <Card className="mt-6">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Lifecycle: prospect → verified needs a complete KYC checklist; verified → active requires an active lease (Phase 5);
          blacklist blocks every transition. Room capacity is enforced at lease time.
        </CardContent>
      </Card>
    </div>
  );
}

function nextStatusesFor(status: string, blacklisted: boolean): string[] {
  void docTypeRequiresExpiryList; // tree-shake guard (types come via data module)
  if (blacklisted) return [];
  const transitions: Record<string, string[]> = {
    prospect: ["verified"],
    verified: ["active"],
    active: ["notice"],
    notice: ["moved_out"],
    moved_out: []
  };
  return transitions[status] ?? [];
}
