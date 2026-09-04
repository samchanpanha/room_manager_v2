/// M25 Tenant Portal — scoped queries shared by the portal API routes and the
/// (portal) server components. Strictly OWN: everything hangs off the caller's
/// memberProfile link (partyId → MemberProfile). No business logic here —
/// mutations go through the existing module services (§M25 "no duplicate
/// business logic").
import { redirect } from "next/navigation";
import { getAuthUser, type AuthUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

export interface PortalMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  kycCompletedAt: Date | null;
  homePropertyId: string | null;
}

export async function getMemberForUser(user: AuthUser): Promise<PortalMember | null> {
  if (!user.partyId) return null;
  const member = await prisma.memberProfile.findUnique({
    where: { partyId: user.partyId },
    include: { party: { select: { name: true, email: true, phone: true } } }
  });
  if (!member) return null;
  return {
    id: member.id,
    name: member.party.name,
    email: member.party.email,
    phone: member.party.phone,
    status: member.status,
    kycCompletedAt: member.kycCompletedAt,
    homePropertyId: member.homePropertyId
  };
}

/// Page guard: an authenticated M25 reader with a member profile, else the
/// login page. Members hold M25:O (OWN) — hasModuleAccess covers the gate and
/// every query below re-scopes to the profile itself.
export async function requireMember(): Promise<{ user: AuthUser; member: PortalMember }> {
  const user = await getAuthUser();
  if (!user || !hasModuleAccess(user, "read", "M25")) redirect("/portal/login");
  const member = await getMemberForUser(user);
  if (!member) redirect("/portal/login?error=not_linked");
  return { user, member };
}

const OPEN_INVOICE = ["issued", "partial_paid", "overdue"] as const;

export async function memberBalanceMinor(memberId: string): Promise<number> {
  const agg = await prisma.invoice.aggregate({
    where: { memberProfileId: memberId, status: { in: [...OPEN_INVOICE] } },
    _sum: { amountDueMinor: true }
  });
  return agg._sum.amountDueMinor ?? 0;
}

export async function memberOpenInvoices(memberId: string) {
  return prisma.invoice.findMany({
    where: { memberProfileId: memberId, status: { in: [...OPEN_INVOICE] } },
    orderBy: { dueDate: "asc" },
    include: { property: { select: { code: true } } }
  });
}

export async function memberInvoice(memberId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      property: { select: { code: true } },
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] }
    }
  });
  return invoice && invoice.memberProfileId === memberId ? invoice : null;
}

export async function memberActiveLease(memberId: string) {
  return prisma.lease.findFirst({
    where: { memberProfileId: memberId, status: { in: ["active", "notice"] } },
    orderBy: { createdAt: "desc" },
    include: {
      room: { include: { floor: { include: { building: { include: { property: true } } } } } }
    }
  });
}

export async function memberDeposit(memberId: string) {
  return prisma.deposit.findFirst({
    where: { memberProfileId: memberId },
    orderBy: { createdAt: "desc" }
  });
}

export async function memberAnnouncements(memberId: string, take = 20) {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: { homePropertyId: true, leases: { where: { status: { in: ["active", "notice"] } }, select: { propertyId: true }, take: 1 } }
  });
  const propertyIds = [...new Set([member?.homePropertyId ?? null, member?.leases[0]?.propertyId ?? null].filter((x): x is string => Boolean(x)))];
  return prisma.announcement.findMany({
    where: { publishedAt: { lte: new Date() }, OR: [{ propertyId: null }, ...(propertyIds.length > 0 ? [{ propertyId: { in: propertyIds } }] : [])] },
    orderBy: { publishedAt: "desc" },
    take
  });
}

export async function memberVacantRooms(memberId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: { homePropertyId: true, leases: { where: { status: "active" }, select: { propertyId: true }, take: 1 } }
  });
  const propertyId = member?.leases[0]?.propertyId ?? member?.homePropertyId ?? null;
  if (!propertyId) return [];
  return prisma.room.findMany({
    where: { status: "vacant", floor: { building: { propertyId } } },
    orderBy: [{ floor: { name: "asc" } }, { number: "asc" }],
    include: { floor: { select: { name: true, building: { select: { name: true } } } } },
    take: 100
  });
}

export async function memberDashboard(memberId: string) {
  const [lease, balanceMinor, deposit, openTickets, openComplaints, announcements, pendingMove] = await Promise.all([
    memberActiveLease(memberId),
    memberBalanceMinor(memberId),
    memberDeposit(memberId),
    prisma.maintenanceTicket.count({ where: { memberProfileId: memberId, status: { in: ["open", "assigned", "in_progress"] } } }),
    prisma.complaint.count({ where: { memberProfileId: memberId, status: { in: ["new", "acknowledged", "in_progress"] } } }),
    memberAnnouncements(memberId, 3),
    prisma.roomMove.findFirst({ where: { memberProfileId: memberId, status: "requested" }, orderBy: { createdAt: "desc" } })
  ]);
  return { lease, balanceMinor, deposit, openTickets, openComplaints, announcements, pendingMove };
}
