/**
 * Typed backend client used by React Server Components (and server actions) to
 * fetch data from the Spring Boot backend instead of importing Prisma directly.
 *
 * This is the seam that decouples the UI from the database: pages that used to
 * `import { prisma } from "@/lib/db"` call these helpers instead. The session
 * cookie is forwarded so the backend's RBDC sees the same user.
 *
 * Client components should keep calling relative `/api/*` URLs (the Next proxy
 * routes them to the backend for migrated prefixes) — this module is for the
 * server side, where there is no ambient origin/cookie.
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
  // Preserve the client IP for audit parity with the Next handlers.
  const reqHeaders = await headers();
  const fwd = reqHeaders.get("x-forwarded-for");
  if (fwd) h["x-forwarded-for"] = fwd;
  return h;
}

/**
 * Low-level server-side call to the backend. Throws {@link BackendError} on a
 * non-2xx response, mirroring the `{ error, message }` body the backend returns.
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

// ---- Typed module clients (extend as modules are ported) -------------------

export interface MemberSummary {
  id: string;
  status: string;
  blacklisted: boolean;
  homePropertyId: string | null;
  nationality: string | null;
  idNumber: string | null;
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

export interface OwnerSummary {
  id: string;
  status: string;
  companyName: string | null;
  payoutMethods: { id: string; kind: string; accountName: string; isPrimary: boolean }[];
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

export interface PaymentAllocationDto {
  id: string;
  invoiceId: string;
  amountMinor: number;
}

export interface PaymentDetail {
  payment: PaymentSummary;
  allocations: PaymentAllocationDto[];
}

export interface CreatePaymentResult {
  paymentId: string;
  code: string;
  allocatedMinor: number;
  remainderMinor: number;
  deduplicated: boolean;
}

export const api = {
  account: {
    me: () => backendFetch<Record<string, unknown>>("/api/account")
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
    create: (body: unknown) => backendFetch<{ id: string; code: string }>("/api/leases", { json: body }),
    activate: (id: string) =>
      backendFetch<{ status: string; notes: string[] }>(`/api/leases/${id}/activate`, { json: {} }),
    notice: (id: string, endDate?: string) =>
      backendFetch<{ status: string; notes: string[] }>(`/api/leases/${id}/notice`, { json: { endDate } }),
    complete: (id: string) =>
      backendFetch<{ status: string; notes: string[] }>(`/api/leases/${id}/complete`, { json: {} }),
    terminate: (id: string, reason: string) =>
      backendFetch<{ status: string; notes: string[] }>(`/api/leases/${id}/terminate`, { json: { reason } })
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
    create: (body: unknown) => backendFetch<InvoiceDetail>("/api/invoices", { json: body }),
    issue: (id: string) =>
      backendFetch<{ issued: boolean; invoice: InvoiceSummary }>(`/api/invoices/${id}/issue`, { json: {} }),
    void: (id: string, reason: string) =>
      backendFetch<{ voided: boolean }>(`/api/invoices/${id}/void`, { json: { reason } }),
    creditNote: (id: string, amount: number, reason: string) =>
      backendFetch<{ code: string; invoiceStatus: string }>(`/api/invoices/${id}/credit-notes`, {
        json: { amount, reason }
      })
  },
  payments: {
    list: (params?: { status?: string; method?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.method) qs.set("method", params.method);
      const suffix = qs.toString() ? `?${qs}` : "";
      return backendFetch<PaymentSummary[]>(`/api/payments${suffix}`);
    },
    get: (id: string) => backendFetch<PaymentDetail>(`/api/payments/${id}`),
    create: (body: {
      memberProfileId: string;
      method: string;
      amount: number;
      allocations?: { invoiceId: string; amount: number }[];
      idempotencyKey?: string;
      gatewayRef?: string;
    }) => backendFetch<CreatePaymentResult>("/api/payments", { json: body }),
    confirm: (id: string) =>
      backendFetch<{ ignored: boolean; receiptCode: string; paymentStatus: string }>(
        `/api/payments/${id}/confirm`,
        { json: {} }
      ),
    fail: (id: string, reason: string) =>
      backendFetch<{ paymentStatus: string }>(`/api/payments/${id}/fail`, { json: { reason } }),
    refund: (id: string, reason: string) =>
      backendFetch<{ paymentStatus: string; receiptCode: string }>(`/api/payments/${id}/refund`, {
        json: { reason }
      })
  }
};
