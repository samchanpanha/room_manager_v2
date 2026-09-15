/// Structured error logging — every wrapped API route emits a single-line JSON
/// record so `docker compose logs rentmanager` is greppable by context, kind,
/// or message when diagnosing a 500 (unhandled exceptions otherwise surface as
/// opaque empty responses in the production build). Records are also shipped
/// to Rootprint via the OTLP log transport when configured (see logger.ts).
import { logger } from "./logger";

export function logError(ctx: string, e: unknown, meta?: Record<string, unknown>): void {
  const err = e instanceof Error ? e : new Error(String(e));
  const stack = (err.stack ?? "").split("\n").slice(0, 5).join(" | ");
  logger.error({ ctx, kind: err.name || "Error", stack, ...(meta ? { meta } : {}) }, err.message || String(e));
}

export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}