import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMinor } from "@/lib/money";
import { TicketActions } from "./ticket-actions";
import { TICKET_SLA_HOURS } from "@/lib/operations/maintenance-machine";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  open: "warning",
  assigned: "info",
  in_progress: "info",
  resolved: "success",
  verified: "success",
  closed: "secondary",
  cancelled: "secondary"
};

export default async function MaintenancePage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M19")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Maintenance (M19)." />;
  }
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const grants = user.permissions.filter((p) => p.module === "M19" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const ownerPropertyIds =
    grants.some((g) => g.scope === "OWN") && user.partyId
      ? (await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { buildings: { select: { propertyId: true } } } }))
          ?.buildings.map((b) => b.propertyId) ?? []
      : [];

  const tickets = await prisma.maintenanceTicket.findMany({
    include: { room: true, member: { include: { party: true } }, costs: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = tickets.filter((t) => {
    if (isGlobal || user.propertyIds.includes(t.propertyId) || ownerPropertyIds.includes(t.propertyId)) return true;
    return ownMemberId != null && t.memberProfileId === ownMemberId;
  });

  const activeLeases = await prisma.lease.findMany({
    where: { status: "active" },
    include: { member: { include: { party: true } }, room: true },
    orderBy: { code: "asc" }
  });
  const visibleLeases = activeLeases.filter((l) => isGlobal || user.propertyIds.includes(l.propertyId) || l.memberProfileId === ownMemberId);
  const rooms = await prisma.room.findMany({ include: { floor: { include: { building: { include: { property: true } } } } }, orderBy: { number: "asc" } });
  const visibleRooms = rooms.filter((r) => isGlobal || user.propertyIds.includes(r.floor.building.propertyId));

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="M19 — repair workflow: open → assigned → in_progress → resolved → verified/closed, with SLA targets by priority (urgent 4h · high 24h · medium 72h · low 168h) and labor/material costs routed to expense or owner P&L"
      />

      <TicketActions
        mode="create"
        leases={visibleLeases.map((l) => ({ id: l.id, label: `${l.code} · ${l.member.party.name} · room ${l.room.number}` }))}
        rooms={visibleRooms.map((r) => ({ id: r.id, label: `${r.number} · ${r.floor.building.property.code}` }))}
        canCreateGlobal={can(user, "create", "M19")}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Room / reporter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => {
                const breached = t.slaBreachedAt != null;
                const openStates = ["open", "assigned", "in_progress"];
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{t.code}</span>
                      <span className="block max-w-64 truncate text-xs">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.category} · {t.priority}
                        {t.source !== "staff" ? ` · via ${t.source}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.room?.number ?? "—"}
                      <span className="block text-muted-foreground">{t.member ? t.member.party.name : `staff (${t.reportedById?.slice(-4) ?? "—"})`}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>{t.status}</Badge>
                      {t.assignedToId ? <span className="block text-xs text-muted-foreground">tech {t.assignedToId.slice(-4)}</span> : null}
                      {t.vendorName ? <span className="block text-xs text-muted-foreground">vendor {t.vendorName}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {breached ? (
                        <Badge variant="destructive">breached</Badge>
                      ) : openStates.includes(t.status) ? (
                        <span className="text-muted-foreground">due {t.slaDueAt.toISOString().slice(5, 16).replace("T", " ")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.costs.length > 0 ? formatMinor(t.costs.reduce((s, c) => s + c.amountMinor, 0)) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <TicketActions
                        mode="row"
                        ticket={{ id: t.id, code: t.code, status: t.status, roomNumber: t.room?.number ?? "" }}
                        canUpdate={can(user, "update", "M19")}
                        slaHint={TICKET_SLA_HOURS}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No tickets yet — members raise them from the portal, staff can log one on their behalf.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Escalation notifications ride M21 (Phase 19); breaches are flagged and audited by the daily SLA sweep
        (<span className="font-mono">POST /api/jobs/sla-sweep</span>). Material costs can reference M15 stock items (Phase 14 wires consumption).
      </p>
    </div>
  );
}
