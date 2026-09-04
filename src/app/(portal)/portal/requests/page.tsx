import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/portal";
import { RequestsClient, type ComplaintRow, type RoomOption, type TicketRow } from "./requests-client";

/// §M25 requests hub — server-scoped rows for the client tabs.
export default async function PortalRequestsPage() {
  const { member } = await requireMember();

  const [lease, tickets, complaints, vacantRooms] = await Promise.all([
    prisma.lease.findFirst({ where: { memberProfileId: member.id, status: { in: ["active", "notice"] } }, orderBy: { createdAt: "desc" }, select: { id: true, status: true } }),
    prisma.maintenanceTicket.findMany({
      where: { memberProfileId: member.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, code: true, title: true, status: true, slaDueAt: true }
    }),
    prisma.complaint.findMany({
      where: { memberProfileId: member.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, code: true, subject: true, status: true }
    }),
    member.id
      ? prisma.room.findMany({
          where: { status: "vacant", floor: { building: { propertyId: member.homePropertyId ?? undefined } } },
          orderBy: [{ floor: { name: "asc" } }, { number: "asc" }],
          select: { id: true, number: true, floor: { select: { name: true, building: { select: { name: true } } } } },
          take: 100
        })
      : Promise.resolve([])
  ]);

  const ticketRows: TicketRow[] = tickets.map((t) => ({ ...t, slaDueAt: t.slaDueAt?.toISOString() ?? null }));
  const complaintRows: ComplaintRow[] = complaints.map((c) => ({ id: c.id, code: c.code, subject: c.subject, status: c.status }));
  const roomOptions: RoomOption[] = vacantRooms.map((r) => ({ id: r.id, label: `${r.number} · ${r.floor.name} · ${r.floor.building.name}` }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Requests</h1>
      <RequestsClient
        memberId={member.id}
        leaseId={lease?.id ?? null}
        leaseStatus={lease?.status ?? null}
        tickets={ticketRows}
        complaints={complaintRows}
        rooms={roomOptions}
      />
    </div>
  );
}
