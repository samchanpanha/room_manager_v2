/**
 * Typed backend client used by React Server Components (and server actions) to
 * fetch data from the Spring Boot backend instead of importing Prisma directly.
 *
 * This is the seam that decouples the UI from the database: pages call these helpers instead.
 * The session cookie is forwarded so the backend's RBDC sees the same user.
 */
import { cookies, headers } from "next/headers";
import { BACKEND_ENABLED, BACKEND_ORIGIN } from "./config";

export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "BackendError";
  }
}

async function serverForwardHeaders(): Promise<Record<string, string>> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const h: Record<string, string> = { "content-type": "application/json" };
  if (cookieHeader) h.cookie = cookieHeader;
  const reqHeaders = await headers();
  const fwd = reqHeaders.get("x-forwarded-for");
  if (fwd) h["x-forwarded-for"] = fwd;
  return h;
}

/**
 * Low-level server-side call to the backend gateway (http://localhost:8080).
 */
export async function backendFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  if (!BACKEND_ENABLED) {
    throw new BackendError(500, "BACKEND_DISABLED", "BACKEND_ORIGIN is not configured");
  }
  const { json, ...rest } = init;
  const res = await fetch(`${BACKEND_ORIGIN}${path}`, {
    ...rest,
    method: rest.method ?? (json !== undefined ? "POST" : "GET"),
    headers: { ...(await serverForwardHeaders()), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store"
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = (data && data.error) || "ERROR";
    const message = (data && data.message) || res.statusText;
    throw new BackendError(res.status, code, message);
  }
  return data as T;
}

// ---- Typed module interfaces ----

export interface MemberPartyView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface MemberRoomView {
  number: string | null;
}

export interface MemberLeaseRow {
  id: string;
  code: string;
  status: string;
  room: MemberRoomView | null;
}

export interface MemberSummary {
  id: string;
  partyId: string;
  status: string;
  homePropertyId: string | null;
  propertyCode: string | null;
  party: MemberPartyView;
  leases: MemberLeaseRow[];
}

export interface PropertySummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: string;
}

export interface PropertyRow extends PropertySummary {
  buildingCount: number;
  roomsTotal: number;
  roomsOccupied: number;
}

export interface OwnerPayoutMethod {
  id: string;
  kind: string;
  bankName?: string | null;
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
}

export interface OwnerSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  companyName: string | null;
  notes: string | null;
  payoutMethods: OwnerPayoutMethod[];
}

export interface LeaseSummary {
  id: string;
  code: string;
  status: string;
  memberProfileId: string;
  roomId: string;
  bedId: string | null;
  propertyId: string;
  rentAmountMinor: number;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
}

export interface InvoiceSummary {
  id: string;
  code: string;
  propertyId: string;
  leaseId: string | null;
  memberProfileId: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  dueDate: string | null;
  totalMinor: number;
  amountPaidMinor: number;
  amountCreditedMinor: number;
  amountDueMinor: number;
  dunningStage: number;
  isDeposit: boolean;
}

export interface InvoiceItemDto {
  id: string;
  kind: string;
  name: string;
  qty: number;
  unitMinor: number;
  amountMinor: number;
}

export interface InvoiceDetail {
  invoice: InvoiceSummary;
  items: InvoiceItemDto[];
}

export interface PaymentSummary {
  id: string;
  code: string;
  memberProfileId: string;
  propertyId: string | null;
  method: string;
  status: string;
  amountMinor: number;
  remainingMinor: number;
  refundedMinor: number;
  receiptCode: string | null;
  receivedAt: string;
  confirmedAt: string | null;
}

export interface DepositSummary {
  id: string;
  leaseId: string;
  memberProfileId: string;
  propertyId: string | null;
  status: string;
  requiredMinor: number;
  collectedMinor: number;
  deductedMinor: number;
  refundedMinor: number;
  remainingMinor: number;
  invoiceId: string | null;
}

export interface LedgerAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface MaintenanceTicketSummary {
  id: string;
  code: string;
  propertyId: string;
  roomId: string | null;
  memberProfileId: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  slaDueAt: string;
}

export interface PosSessionSummary {
  id: string;
  code: string;
  propertyId: string;
  openingCashMinor: number;
  expectedCashMinor: number;
  actualCashMinor: number;
  cashDiffMinor: number;
  status: string;
}

export interface StockItemSummary {
  id: string;
  name: string;
  category: string;
  unit: string;
  qtyMilli: number;
  avgCostMilli: number;
  minQtyMilli: number;
  propertyId: string;
}

export interface OccupancyReport {
  propertyId: string;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  maintenanceRooms: number;
  occupancyRate: number;
}

export interface RevenueReport {
  propertyId: string;
  totalInvoicedMinor: number;
  totalCollectedMinor: number;
  totalOutstandingMinor: number;
}

export const api = {
  account: {
    me: () => backendFetch<Record<string, unknown>>("/api/account")
  },
  users: {
    list: () => backendFetch<Record<string, unknown>[]>("/api/users"),
    create: (body: unknown) => backendFetch<{ id: string }>("/api/users", { json: body })
  },
  roles: {
    list: () => backendFetch<Record<string, unknown>[]>("/api/roles"),
    create: (body: unknown) => backendFetch<{ id: string }>("/api/roles", { json: body })
  },
  organizations: {
    list: () => backendFetch<Record<string, unknown>[]>("/api/organizations"),
    create: (body: unknown) => backendFetch<{ id: string }>("/api/organizations", { json: body })
  },
  members: {
    list: (params?: { status?: string; propertyId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.propertyId) qs.set("propertyId", params.propertyId);
      const suffix = qs.toString() ? `?${qs}` : "";
      return backendFetch<MemberSummary[]>(`/api/members${suffix}`);
    },
    get: (id: string) => backendFetch<Record<string, unknown>>(`/api/members/${id}`),
    create: (body: unknown) => backendFetch<{ id: string }>("/api/members", { json: body })
  },
  properties: {
    list: () => backendFetch<PropertyRow[]>("/api/properties"),
    get: (id: string) => backendFetch<PropertySummary>(`/api/properties/${id}`),
    create: (body: unknown) => backendFetch<PropertySummary>("/api/properties", { json: body })
  },
  buildings: {
    list: (propertyId: string) => backendFetch<Record<string, unknown>[]>(`/api/buildings?propertyId=${propertyId}`),
    create: (body: unknown) => backendFetch<Record<string, unknown>>("/api/buildings", { json: body })
  },
  floors: {
    list: (buildingId: string) => backendFetch<Record<string, unknown>[]>(`/api/floors?buildingId=${buildingId}`),
    create: (body: unknown) => backendFetch<Record<string, unknown>>("/api/floors", { json: body })
  },
  rooms: {
    list: (propertyId: string) => backendFetch<Record<string, unknown>[]>(`/api/rooms?propertyId=${propertyId}`),
    create: (body: unknown) => backendFetch<Record<string, unknown>>("/api/rooms", { json: body })
  },
  meters: {
    list: (propertyId: string) => backendFetch<Record<string, unknown>[]>(`/api/meters?propertyId=${propertyId}`),
    create: (body: unknown) => backendFetch<Record<string, unknown>>("/api/meters", { json: body })
  },
  owners: {
    list: () => backendFetch<OwnerSummary[]>("/api/owners"),
    get: (id: string) => backendFetch<Record<string, unknown>>(`/api/owners/${id}`),
    create: (body: unknown) => backendFetch<{ id: string }>("/api/owners", { json: body })
  },
  leases: {
    list: (params?: { status?: string }) => {
      const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
      return backendFetch<LeaseSummary[]>(`/api/leases${qs}`);
    },
    get: (id: string) => backendFetch<Record<string, unknown>>(`/api/leases/${id}`),
    create: (body: unknown) => backendFetch<{ id: string; code: string }>("/api/leases", { json: body })
  },
  invoices: {
    list: (params?: { status?: string; propertyId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.propertyId) qs.set("propertyId", params.propertyId);
      const suffix = qs.toString() ? `?${qs}` : "";
      return backendFetch<InvoiceSummary[]>(`/api/invoices${suffix}`);
    },
    get: (id: string) => backendFetch<InvoiceDetail>(`/api/invoices/${id}`),
    create: (body: unknown) => backendFetch<InvoiceDetail>("/api/invoices", { json: body })
  },
  payments: {
    list: (params?: { status?: string; method?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.method) qs.set("method", params.method);
      const suffix = qs.toString() ? `?${qs}` : "";
      return backendFetch<PaymentSummary[]>(`/api/payments${suffix}`);
    },
    create: (body: unknown) => backendFetch<Record<string, unknown>>("/api/payments", { json: body })
  },
  deposits: {
    list: (params?: { status?: string }) => {
      const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
      return backendFetch<DepositSummary[]>(`/api/deposits${qs}`);
    }
  },
  ledger: {
    accounts: () => backendFetch<LedgerAccountDto[]>("/api/ledger/accounts"),
    trialBalance: () => backendFetch<Record<string, unknown>>("/api/ledger/trial-balance")
  },
  maintenance: {
    list: (propertyId: string) => backendFetch<MaintenanceTicketSummary[]>(`/api/tickets?propertyId=${propertyId}`),
    create: (body: unknown) => backendFetch<MaintenanceTicketSummary>("/api/tickets", { json: body })
  },
  expenses: {
    list: (propertyId: string) => backendFetch<Record<string, unknown>[]>(`/api/expenses?propertyId=${propertyId}`),
    create: (body: unknown) => backendFetch<Record<string, unknown>>("/api/expenses", { json: body })
  },
  attendance: {
    list: (params?: { propertyId?: string; staffUserId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.propertyId) qs.set("propertyId", params.propertyId);
      if (params?.staffUserId) qs.set("staffUserId", params.staffUserId);
      const suffix = qs.toString() ? `?${qs}` : "";
      return backendFetch<Record<string, unknown>[]>(`/api/attendance${suffix}`);
    },
    clockIn: (body: unknown) => backendFetch<Record<string, unknown>>("/api/attendance/clock-in", { json: body }),
    clockOut: (body: unknown) => backendFetch<Record<string, unknown>>("/api/attendance/clock-out", { json: body })
  },
  pos: {
    openSession: (body: unknown) => backendFetch<PosSessionSummary>("/api/pos/sessions", { json: body }),
    closeSession: (id: string, body: unknown) => backendFetch<PosSessionSummary>(`/api/pos/sessions/${id}/close`, { json: body }),
    getActiveSession: (propertyId: string) => backendFetch<PosSessionSummary>(`/api/pos/sessions/active?propertyId=${propertyId}`),
    createSale: (body: unknown) => backendFetch<Record<string, unknown>>("/api/pos/sales", { json: body })
  },
  stock: {
    list: (propertyId: string) => backendFetch<StockItemSummary[]>(`/api/stock?propertyId=${propertyId}`),
    create: (body: unknown) => backendFetch<StockItemSummary>("/api/stock", { json: body }),
    adjust: (id: string, body: unknown) => backendFetch<StockItemSummary>(`/api/stock/${id}/adjust`, { json: body })
  },
  reports: {
    occupancy: (propertyId: string) => backendFetch<OccupancyReport>(`/api/reports/occupancy?propertyId=${propertyId}`),
    revenue: (propertyId: string) => backendFetch<RevenueReport>(`/api/reports/revenue?propertyId=${propertyId}`),
    profitLoss: (propertyId: string) => backendFetch<Record<string, unknown>>(`/api/reports/profit-loss?propertyId=${propertyId}`),
    arrears: (propertyId: string) => backendFetch<Record<string, unknown>[]>(`/api/reports/arrears?propertyId=${propertyId}`)
  },
  notifications: {
    send: (body: unknown) => backendFetch<Record<string, unknown>>("/api/notifications", { json: body }),
    list: (recipient: string) => backendFetch<Record<string, unknown>[]>(`/api/notifications?recipient=${recipient}`)
  }
};
