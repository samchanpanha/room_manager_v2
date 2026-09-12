import { utils, write } from "xlsx";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/// Format integer minor units (cents) to standard decimal currency string/number
function minorToMajor(minor: number | null | undefined): number {
  if (minor === null || minor === undefined) return 0;
  return Number((minor / 100).toFixed(2));
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().split("T")[0]!;
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().replace("T", " ").substring(0, 19);
}

/// Create an XLSX binary Buffer from worksheet or multiple sheets
export function createWorkbookBuffer(sheets: Record<string, unknown[]>): Buffer {
  const wb = utils.book_new();

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const ws = utils.json_to_sheet(rows.length > 0 ? rows : [{}]);

    // Auto-fit column widths
    if (rows.length > 0) {
      const keys = Object.keys(rows[0] || {});
      const colWidths = keys.map((k) => {
        const maxContentLen = Math.max(
          k.length,
          ...rows.map((r) => String((r as Record<string, unknown>)[k] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxContentLen + 2, 10), 40) };
      });
      ws["!cols"] = colWidths;
    }

    // Limit sheet name to 31 chars (Excel maximum)
    const validSheetName = sheetName.substring(0, 31).replace(/[\\/?*[\]]/g, "_");
    utils.book_append_sheet(wb, ws, validSheetName);
  }

  const buffer = write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  return buffer;
}

// ──────────────────────────────── Entity Exporters ────────────────────────────────

export async function exportMembersData(options: { tenantId?: string; propertyIds?: string[] } = {}) {
  const where: Prisma.MemberProfileWhereInput = {};
  if (options.tenantId) {
    where.party = { tenantId: options.tenantId };
  }
  if (options.propertyIds && options.propertyIds.length > 0) {
    where.OR = [
      { homePropertyId: { in: options.propertyIds } },
      { leases: { some: { propertyId: { in: options.propertyIds } } } }
    ];
  }

  const members = await prisma.memberProfile.findMany({
    where,
    include: {
      party: true,
      homeProperty: true,
      leases: {
        where: { status: "active" },
        include: { room: true, property: true }
      },
      invoices: {
        where: { status: { in: ["issued", "partial_paid", "overdue"] } }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return members.map((m) => {
    const activeLease = m.leases[0];
    const totalDueMinor = m.invoices.reduce((sum, inv) => sum + inv.amountDueMinor, 0);

    return {
      "Member ID": m.id,
      "Full Name": m.party.name,
      Email: m.party.email ?? "",
      Phone: m.party.phone ?? "",
      Status: m.status.toUpperCase(),
      "Home Property": m.homeProperty?.name ?? activeLease?.property.name ?? "",
      "Current Room": activeLease?.room.number ?? "None",
      "Active Lease Code": activeLease?.code ?? "None",
      "Open Dues ($)": minorToMajor(totalDueMinor),
      "Monthly Income ($)": minorToMajor(m.monthlyIncomeMinor),
      Occupation: m.occupation ?? "",
      Nationality: m.nationality ?? "",
      "ID Number": m.idNumber ?? "",
      "KYC Verified": m.kycCompletedAt ? "Yes" : "No",
      "Blacklisted": m.blacklisted ? `Yes (${m.blacklistReason ?? ""})` : "No",
      "Created At": formatDate(m.createdAt)
    };
  });
}

export async function exportLeasesData(options: { tenantId?: string; propertyIds?: string[] } = {}) {
  const where: Prisma.LeaseWhereInput = {};
  if (options.propertyIds && options.propertyIds.length > 0) {
    where.propertyId = { in: options.propertyIds };
  } else if (options.tenantId) {
    where.property = { tenantId: options.tenantId };
  }

  const leases = await prisma.lease.findMany({
    where,
    include: {
      member: { include: { party: true } },
      room: { include: { floor: { include: { building: true } } } },
      property: true
    },
    orderBy: { createdAt: "desc" }
  });

  return leases.map((l) => ({
    "Lease Code": l.code,
    "Tenant Name": l.member.party.name,
    "Tenant Email": l.member.party.email ?? "",
    "Tenant Phone": l.member.party.phone ?? "",
    Property: l.property.name,
    Building: l.room.floor.building.name,
    Floor: l.room.floor.name,
    Room: l.room.number,
    Status: l.status.toUpperCase(),
    "Monthly Rent ($)": minorToMajor(l.rentAmountMinor),
    "Deposit Total ($)": minorToMajor(l.depositTotalMinor),
    "Start Date": formatDate(l.startDate),
    "End Date": l.endDate ? formatDate(l.endDate) : "Open-ended",
    "Billing Cycle Day": l.billingCycleDay,
    "Proration Basis": l.prorationBasis,
    "Notice Days": l.noticeDays,
    "Auto Renew": l.autoRenew ? "Yes" : "No",
    "Created Date": formatDate(l.createdAt)
  }));
}

export async function exportInvoicesData(options: {
  tenantId?: string;
  propertyIds?: string[];
  from?: Date;
  to?: Date;
  status?: string;
} = {}) {
  const where: Prisma.InvoiceWhereInput = {};
  if (options.propertyIds && options.propertyIds.length > 0) {
    where.propertyId = { in: options.propertyIds };
  } else if (options.tenantId) {
    where.property = { tenantId: options.tenantId };
  }
  if (options.status) {
    where.status = options.status;
  }
  if (options.from || options.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      member: { include: { party: true } },
      property: true,
      lease: { include: { room: true } },
      items: true
    },
    orderBy: { createdAt: "desc" }
  });

  return invoices.map((inv) => ({
    "Invoice Code": inv.code,
    "Tenant Name": inv.member.party.name,
    Property: inv.property.name,
    "Room / Unit": inv.lease?.room.number ?? "General",
    Status: inv.status.toUpperCase(),
    "Billing Period Start": formatDate(inv.periodStart),
    "Billing Period End": formatDate(inv.periodEnd),
    "Issue Date": formatDate(inv.issuedAt),
    "Due Date": formatDate(inv.dueDate),
    "Subtotal ($)": minorToMajor(inv.subtotalMinor),
    "Discount ($)": minorToMajor(inv.discountMinor),
    "Tax ($)": minorToMajor(inv.taxMinor),
    "Total ($)": minorToMajor(inv.totalMinor),
    "Amount Paid ($)": minorToMajor(inv.amountPaidMinor),
    "Amount Credited ($)": minorToMajor(inv.amountCreditedMinor),
    "Amount Due ($)": minorToMajor(inv.amountDueMinor),
    "Item Count": inv.items.length,
    "Is Deposit Invoice": inv.isDeposit ? "Yes" : "No",
    "Created At": formatDateTime(inv.createdAt)
  }));
}

export async function exportPaymentsData(options: {
  tenantId?: string;
  propertyIds?: string[];
  from?: Date;
  to?: Date;
} = {}) {
  const where: Prisma.PaymentWhereInput = {};
  if (options.propertyIds && options.propertyIds.length > 0) {
    where.propertyId = { in: options.propertyIds };
  }
  if (options.tenantId) {
    where.member = { party: { tenantId: options.tenantId } };
  }
  if (options.from || options.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      member: { include: { party: true } },
      allocations: {
        include: {
          invoice: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return payments.map((p) => {
    const allocatedMinor = p.allocations.reduce((sum, a) => sum + a.amountMinor, 0);
    const invoicesList = p.allocations.map((a) => `${a.invoice.code} ($${(a.amountMinor / 100).toFixed(2)})`).join(", ");

    return {
      "Payment Code": p.code,
      "Tenant Name": p.member.party.name,
      "Payment Method": p.method.toUpperCase(),
      Status: p.status.toUpperCase(),
      "Total Amount ($)": minorToMajor(p.amountMinor),
      "Allocated ($)": minorToMajor(allocatedMinor),
      "Unallocated Credit ($)": minorToMajor(p.remainingMinor),
      "Refunded ($)": minorToMajor(p.refundedMinor),
      "Allocated Invoices": invoicesList || "None",
      "Gateway Ref": p.gatewayRef ?? "",
      "Payment Date": formatDateTime(p.createdAt)
    };
  });
}

export async function exportRoomsData(options: { tenantId?: string; propertyIds?: string[] } = {}) {
  const where: Prisma.RoomWhereInput = {};
  if (options.propertyIds && options.propertyIds.length > 0) {
    where.floor = { building: { propertyId: { in: options.propertyIds } } };
  } else if (options.tenantId) {
    where.floor = { building: { property: { tenantId: options.tenantId } } };
  }

  const rooms = await prisma.room.findMany({
    where,
    include: {
      floor: {
        include: {
          building: {
            include: {
              property: true
            }
          }
        }
      },
      leases: {
        where: { status: "active" },
        include: { member: { include: { party: true } } }
      }
    },
    orderBy: [
      { floor: { building: { property: { name: "asc" } } } },
      { floor: { building: { name: "asc" } } },
      { floor: { level: "asc" } },
      { number: "asc" }
    ]
  });

  return rooms.map((r) => {
    const activeLease = r.leases[0];
    return {
      Property: r.floor.building.property.name,
      Building: r.floor.building.name,
      Floor: r.floor.name,
      "Floor Level": r.floor.level,
      "Room Number": r.number,
      "Room Type": r.type,
      "Base Monthly Rent ($)": minorToMajor(r.basePriceMinor),
      Capacity: r.capacity,
      "Occupancy Status": r.status.toUpperCase(),
      "Current Tenant": activeLease?.member.party.name ?? "None",
      "Active Lease": activeLease?.code ?? "None",
      "Lease End Date": activeLease?.endDate ? formatDate(activeLease.endDate) : activeLease ? "Open-ended" : "N/A",
      Notes: r.notes ?? ""
    };
  });
}

export async function exportFullWorkspaceWorkbook(tenantId: string, propertyIds: string[] = []): Promise<Buffer> {
  const [members, leases, invoices, payments, rooms] = await Promise.all([
    exportMembersData({ tenantId, propertyIds }),
    exportLeasesData({ tenantId, propertyIds }),
    exportInvoicesData({ tenantId, propertyIds }),
    exportPaymentsData({ tenantId, propertyIds }),
    exportRoomsData({ tenantId, propertyIds })
  ]);

  // Overview summary sheet
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  const summary = [
    { Field: "Organization Workspace", Value: tenant?.name ?? "Default Organization" },
    { Field: "Workspace Slug", Value: tenant?.slug ?? "default" },
    { Field: "Export Timestamp", Value: new Date().toISOString() },
    { Field: "Total Rooms / Units", Value: rooms.length },
    { Field: "Total Members / Tenants", Value: members.length },
    { Field: "Active Leases", Value: leases.filter((l) => l.Status === "ACTIVE").length },
    { Field: "Total Invoices Recorded", Value: invoices.length },
    { Field: "Total Payments Received", Value: payments.length }
  ];

  return createWorkbookBuffer({
    Overview: summary,
    "Rooms & Units": rooms,
    "Members & Tenants": members,
    Leases: leases,
    Invoices: invoices,
    Payments: payments
  });
}
