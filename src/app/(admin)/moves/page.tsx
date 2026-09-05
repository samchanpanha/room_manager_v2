import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { can, hasModuleAccess } from "@/lib/rbac/can";
import { formatMinor } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MoveActions } from "./move-actions";
import { Tx } from "@/components/i18n-text";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  requested: "warning",
  approved: "info",
  executed: "success",
  cancelled: "secondary"
};

export default async function RoomMovesPage() {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M16")) {
    return <EmptyState title="No access" hint="Your roles do not include read on Room Moves (M16)." />;
  }
  const grants = user.permissions.filter((p) => p.module === "M16" && p.action === "read");
  const isGlobal = grants.some((g) => g.scope === "GLOBAL");
  const ownMemberId = user.partyId
    ? (await prisma.memberProfile.findUnique({ where: { partyId: user.partyId }, select: { id: true } }))?.id ?? null
    : null;
  const ownerPropertyIds =
    grants.some((g) => g.scope === "OWN") && user.partyId
      ? (await prisma.ownerProfile.findUnique({ where: { partyId: user.partyId }, select: { buildings: { select: { propertyId: true } } } }))
          ?.buildings.map((b) => b.propertyId) ?? []
      : [];

  const moves = await prisma.roomMove.findMany({
    include: {
      member: { include: { party: true } },
      fromLease: true,
      toRoom: true,
      newLease: true,
      adjustmentInvoice: { select: { code: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const visible = moves.filter((m) => {
    if (isGlobal) return true;
    if (ownMemberId && m.memberProfileId === ownMemberId) return true;
    return user.propertyIds.includes(m.fromLease.propertyId) || ownerPropertyIds.includes(m.fromLease.propertyId);
  });

  const canRequestStaff = can(user, "create", "M16");
  const canTransition = can(user, "update", "M16");
  const activeLeases = await prisma.lease.findMany({
    where: { status: "active" },
    include: { member: { include: { party: true } }, room: true },
    orderBy: { code: "asc" }
  });
  const visibleLeases = activeLeases.filter((l) => isGlobal || user.propertyIds.includes(l.propertyId) || l.memberProfileId === ownMemberId);
  const vacantRooms = await prisma.room.findMany({
    where: { status: { in: ["vacant", "reserved"] } },
    include: { floor: { include: { building: { include: { property: true } } } } },
    orderBy: { number: "asc" }
  });
  const visibleRooms = vacantRooms.filter((r) => isGlobal || user.propertyIds.includes(r.floor.building.propertyId));

  return (
    <div>
      <PageHeader
        title="Room Moves"
        description="M16 — request → approve → execute: old lease ends, new lease starts, one adjustment invoice with the exact prorated delta, both room statuses update, deposit follows the member"
      />

      {canRequestStaff || ownMemberId ? (
        <MoveActions
          mode="create"
          leases={visibleLeases.map((l) => ({ id: l.id, label: `${l.code} · ${l.member.party.name} · room ${l.room.number} · ${formatMinor(l.rentAmountMinor)}/mo` }))}
          rooms={visibleRooms.map((r) => ({ id: r.id, label: `${r.number} · ${r.floor.building.property.code} · base ${formatMinor(r.basePriceMinor)}` }))}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Move</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.code}</TableCell>
                  <TableCell>
                    <a href={`/members/${m.memberProfileId}`} className="underline-offset-4 hover:underline">
                      {m.member.party.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.fromLease.code}
                    <span className="text-muted-foreground"> <Tx>→ room </Tx>{m.toRoom.number}</span>
                    {m.newLease ? <span className="block text-muted-foreground"><Tx>new: </Tx>{m.newLease.code}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs">{m.effectiveAt.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[m.status] ?? "secondary"}>
                      {m.status}
                      {m.requestedByRole === "member" && m.status === "requested" ? " · portal" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.netMinor != null ? formatMinor(m.netMinor) : "—"}</TableCell>
                  <TableCell>
                    {m.adjustmentInvoice ? (
                      <a href={`/invoices/${m.adjustmentInvoiceId}`} className="font-mono text-xs underline underline-offset-4">
                        {m.adjustmentInvoice.code}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoveActions
                      mode="row"
                      moveId={m.id}
                      status={m.status}
                      isOwn={ownMemberId === m.memberProfileId}
                      canTransition={canTransition}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground"><Tx>
                    No room moves yet — request one for an active lease (member portal or staff).
                  </Tx></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        <Tx>Execution bills the new lease&apos;s first period as the adjustment invoice: prorated new rent + move fee − unused old-rent credit
        (discount) = exact delta. The deposit row moves with the member — the 2100 liability never changes.</Tx>
      </p>
    </div>
  );
}
