/**
 * Frontend/backend split — routing configuration.
 *
 * During the strangler-fig migration, all `/api/*` prefixes are served by the
 * Spring Boot backend gateway.
 * This file is the single source of truth for that switch, consumed by:
 *   - `next.config.ts` rewrites (browser + server-side proxying), and
 *   - `src/lib/backend/client.ts` (server components calling the backend).
 */

/** Absolute origin of the Spring Boot backend (server-side only). */
export const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8080";

/** Whether the split backend is wired at all. */
export const BACKEND_ENABLED = true;

/**
 * API path prefixes (under `/api`) served by the Spring backend gateway.
 *
 * NOTE: pure file-serving prefixes are intentionally NOT here — exports (XLSX),
 * document registry (upload/list/sign) and signed file downloads are generated
 * and served by the in-app (Next.js + Prisma + object storage) handlers, not
 * the gateway. Same for the M18 inspections lifecycle (/api/inspections and
 * /api/findings): the full item-capture → findings → ticket/deduction flow and
 * the move-out lease gate run in-app; the Spring ops-service stub only knows a
 * `?score=`/`?note=` complete and cannot express it. Prefixes that carry BOTH
 * backend data and in-app file subroutes (e.g. /api/invoices/:id/pdf) keep
 * their data on the gateway while the file subroutes are intercepted by
 * beforeFiles rewrites — see next.config.ts.
 */
export const MIGRATED_PREFIXES: string[] = [
  "/api/auth",
  "/api/account",
  "/api/users",
  "/api/members",
  "/api/owners",
  "/api/roles",
  "/api/organizations",
  "/api/contacts",
  "/api/audit",
  "/api/audit-logs",
  "/api/settings",
  "/api/properties",
  "/api/rooms",
  "/api/meters",
  "/api/services",
  "/api/stays",
  "/api/stay",
  "/api/buildings",
  "/api/floors",
  "/api/tariffs",
  "/api/leases",
  "/api/invoices",
  "/api/payments",
  "/api/ledger",
  "/api/deposits",
  "/api/qr",
  "/api/qrpay",
  "/api/lease-services",
  "/api/rent-engine",
  "/api/jobs",
  "/api/room-moves",
  "/api/tickets",
  "/api/maintenance",
  "/api/complaints",
  "/api/expenses",
  "/api/attendance",
  "/api/statements",
  "/api/owner-contracts",
  "/api/payout-methods",
  "/api/pos",
  "/api/stock",
  "/api/po",
  "/api/telegram",
  "/api/notifications",
  "/api/portal",
  "/api/webhooks",
  "/api/reports",
  "/api/dashboard",
  "/api/health"
];

export function isMigrated(pathname: string): boolean {
  return MIGRATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
