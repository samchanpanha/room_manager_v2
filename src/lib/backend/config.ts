/**
 * Frontend/backend split — routing configuration.
 *
 * During the strangler-fig migration, some `/api/*` prefixes are served by the
 * new Spring Boot backend and the rest by the legacy Next.js route handlers.
 * This file is the single source of truth for that switch, consumed by:
 *   - `next.config.ts` rewrites (browser + server-side proxying), and
 *   - `src/lib/backend/client.ts` (server components calling the backend).
 *
 * Flip a module over by adding its API prefix to `MIGRATED_PREFIXES`. Remove it
 * to roll back instantly. When the list contains every prefix, delete the Next
 * handlers under `src/app/api/**`.
 */

/** Absolute origin of the Spring Boot backend (server-side only). */
export const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "";

/** Whether the split backend is wired at all. */
export const BACKEND_ENABLED = BACKEND_ORIGIN.length > 0;

/**
 * API path prefixes (under `/api`) already served by the Spring backend.
 * Order matters only for readability; matching is longest-prefix agnostic.
 *
 * Phase 1 vertical slice: auth, account, members, and the properties/rooms tree.
 */
export const MIGRATED_PREFIXES: string[] = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/account",
  "/api/members",
  "/api/owners",
  "/api/leases",
  "/api/invoices",
  "/api/properties",
  "/api/buildings",
  "/api/floors",
  "/api/rooms",
  "/api/health"
];

export function isMigrated(pathname: string): boolean {
  return MIGRATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
