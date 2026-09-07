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
    list: () => backendFetch<PropertySummary[]>("/api/properties"),
    get: (id: string) => backendFetch<PropertySummary>(`/api/properties/${id}`),
    create: (body: unknown) => backendFetch<PropertySummary>("/api/properties", { json: body })
  }
};
