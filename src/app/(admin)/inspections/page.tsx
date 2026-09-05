import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { InspectionActions } from "./inspection-actions";
import { formatMinor } from "@/lib/money";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  draft: "warning",
  completed: "success",
  cancelled: "secondary"
};

export default async function InspectionsPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M18")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Inspections (M18)." />;
  }
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const grants = user.permissions.filter((p) => p.module === "M18" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const ownerPropertyIds =
    grants.some((g) => g.scope === "OWN") && user.partyId
      ? (await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { buildings: { select: { propertyId: true } } } }))
          ?.buildings.map((b) => b.propertyId) ?? []
      : [];

  const inspections = await prisma.inspection.findMany({
    include: { lease: { include: { member: { include: { party: true } } } }, room: true, findings: { include: { ticket: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = inspections.filter((i) => {
    if (isGlobal || user.propertyIds.includes(i.propertyId) || ownerPropertyIds.includes(i.propertyId)) return true;
    return ownMemberId != null && i.lease.memberProfileId === ownMemberId;
  });

  const canCreate = can(user, "create", "M18");
  const canUpdate = can(user, "update", "M18");
  const activeLeases = await prisma.lease.findMany({
    where: { status: { in: ["active", "notice"] } },
    include: { member: { include: { party: true } }, room: true },
    orderBy: { code: "asc" }
  });
  const visibleLeases = activeLeases.filter((l) => isGlobal || user.propertyIds.includes(l.propertyId) || l.memberProfileId === ownMemberId);

  return (
    <div>
      <PageHeader
        title="Inspections"
        description="M18 — structured room condition checks (move-in / move-out / periodic). Completed move-out inspections are the hard gate for ending a lease; findings open maintenance tickets and propose deposit deductions"
      />

      {canCreate && visibleLeases.length > 0 ? (
        <InspectionActions
          mode="create"
          leases={visibleLeases.map((l) => ({ id: l.id, label: `${l.code} · ${l.member.party.name} · room ${l.room.number}` }))}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inspection</TableHead>
                <TableHead>Lease / room</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Report</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{i.code}</span>
                    <span className="block text-xs text-muted-foreground">{i.type.replace("_", "-")}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.lease.code}
                    <span className="text-muted-foreground"> · {i.room.number}</span>
                    <span className="block text-muted-foreground">{i.lease.member.party.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[i.status] ?? "secondary"}>{i.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.overallScore != null ? `${i.overallScore}/100` : "—"}</TableCell>
                  <TableCell>
                    {i.findings.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-1">
                        {i.findings.map((f) => (
                          <div key={f.id} className="text-xs">
                            <Badge variant={f.severity === "critical" ? "destructive" : f.severity === "major" ? "warning" : "secondary"}>{f.severity}</Badge>{" "}
                            {f.itemLabel}
                            {f.ticket ? <span className="text-muted-foreground"> → {f.ticket.code}</span> : null}
                            {f.deductionStatus ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · deduction {f.deductionMinor != null ? formatMinor(f.deductionMinor) : ""} {f.deductionStatus}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.reportDocId ? (
                      <Badge variant="info">PDF filed</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <InspectionActions
                      mode="row"
                      inspection={{ id: i.id, code: i.code, status: i.status, type: i.type, leaseCode: i.lease.code, roomNumber: i.room.number }}
                      findings={i.findings.map((f) => ({
                        id: f.id,
                        itemLabel: f.itemLabel,
                        severity: f.severity,
                        note: f.note,
                        ticketCode: f.ticket?.code ?? null,
                        deductionMinor: f.deductionMinor,
                        deductionStatus: f.deductionStatus,
                        photoDocId: f.photoDocId
                      }))}
                      canUpdate={canUpdate}
                      canApproveDeduction={can(user, "update", "M10")}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No inspections yet — open one for an active lease (move-in, move-out or periodic).
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Completing a move-out inspection links the lease (hard gate for lease end, §15 v1.1) and auto-files the PDF report to the document
        registry (M17). Failed items become findings: open a maintenance ticket (M19) or propose a deposit deduction approved in M10.</Tx>
      </p>
    </div>
  );
}
