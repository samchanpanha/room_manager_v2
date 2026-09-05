import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ComplaintActions } from "./complaint-actions";
import { COMPLAINT_SLA_HOURS } from "@/lib/operations/maintenance-machine";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  new: "warning",
  acknowledged: "info",
  in_progress: "info",
  resolved: "success",
  closed: "secondary"
};

export default async function ComplaintsPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M22")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Complaints (M22)." />;
  }
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const grants = user.permissions.filter((p) => p.module === "M22" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");

  const complaints = await prisma.complaint.findMany({
    include: { member: { include: { party: true } }, comments: { orderBy: { createdAt: "asc" } }, ticket: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = complaints.filter((c) => {
    if (isGlobal || user.propertyIds.includes(c.propertyId)) return true;
    return ownMemberId != null && c.memberProfileId === ownMemberId;
  });

  const members = await prisma.memberProfile.findMany({ include: { party: true }, orderBy: { id: "asc" } });
  const visibleMembers = members.filter((m) => isGlobal || (m.homePropertyId && user.propertyIds.includes(m.homePropertyId)) || m.id === ownMemberId);

  return (
    <div>
      <PageHeader
        title="Complaints"
        description="M22 — grievance handling: new → acknowledged → in_progress → resolved → closed; the member confirms resolution and rates. SLA by priority (high 24h · medium 72h · low 168h); one-click conversion to a maintenance ticket"
      />

      <ComplaintActions
        mode="create"
        members={visibleMembers.map((m) => ({ id: m.id, label: `${m.party.name}${isGlobal ? "" : " (you)"}` }))}
        canCreateGlobal={can(user, "create", "M22")}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Thread</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const canAct = can(user, "update", "M22", { propertyId: c.propertyId });
                const canClose = ownMemberId === c.memberProfileId && c.status === "resolved";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{c.code}</span>
                      <span className="block max-w-64 truncate text-xs">{c.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.category} · {c.priority} · via {c.source}
                        {c.slaBreachedAt ? " · SLA BREACHED" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{c.member.party.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
                      {c.ticket ? <span className="block text-xs text-muted-foreground">→ {c.ticket.code}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.comments.length} comment{c.comments.length === 1 ? "" : "s"}
                      {c.resolutionNote ? <span className="block max-w-56 truncate">✓ {c.resolutionNote}</span> : null}
                    </TableCell>
                    <TableCell>{c.rating ? <Badge variant="success">{c.rating}/5</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right">
                      <ComplaintActions
                        mode="row"
                        complaint={{ id: c.id, code: c.code, status: c.status, hasTicket: !!c.ticket }}
                        canAct={canAct}
                        canClose={canClose}
                        slaHint={COMPLAINT_SLA_HOURS}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No complaints yet — members file from the portal; staff can log one on their behalf.
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Closing is the member&apos;s call: resolved complaints show a rating dialog for that member (1–5, required). Conversion to a ticket keeps
        the cross-link visible on both surfaces (matrix row 13).</Tx>
      </p>
    </div>
  );
}
