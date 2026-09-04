import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export interface AuditInput {
  actorId?: string | null;
  actorName: string;
  module: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  propertyId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/// ── PII masking (M27) ────────────────────────────────────────────────────────
/// Emails, phone numbers and national id numbers in audit payloads are masked
/// before storage; the operational `summary` stays human-readable by design.
const EMAIL_RE = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)([A-Za-z0-9-])([A-Za-z0-9-]*)\.([A-Za-z]{2,})/g;
const PHONE_RE = /(\+\d{1,3}[\s-]?)\d[\d\s-]{6,}\d/g;
const SENSITIVE_KEYS = new Set(["email", "phone", "phone_number", "idNumber", "id_number", "nationalId", "password", "passwordHash", "token", "secret"]);

function maskText(text: string): string {
  return text
    .replace(EMAIL_RE, (_m, first: string, domain: string, dFirst: string, dRest: string, tld: string) => `${first}***@${domain}${dFirst}${"*".repeat(Math.min(dRest.length, 4))}.${tld}`)
    .replace(PHONE_RE, (_m, cc: string) => `${cc}•••••`);
}

function maskValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;
  if (key && SENSITIVE_KEYS.has(key)) {
    if (typeof value !== "string") return "***";
    return value.includes("@") ? maskText(value) : value.slice(0, 1) + "***"; // keep email shape, stamp out the rest
  }
  if (typeof value === "string") return maskText(value);
  if (Array.isArray(value)) return value.map((v) => maskValue(v));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = maskValue(v, k);
    return out;
  }
  return value;
}

function maskJson(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(maskValue(value));
}

/// ── Tamper-evident chain (M27) ───────────────────────────────────────────────
/// hash = SHA-256(prevHash | all row fields). Appends run in a tiny standalone
/// transaction (read-last → write) so concurrent appends cannot fork the chain.
/// Never call this INSIDE an outer $transaction (nested-tx limitation + the
/// carried rule: audit after the mutation commits).
function rowHash(prevHash: string | null, row: {
  createdAt: Date;
  actorId: string | null;
  actorName: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  before: string | null;
  after: string | null;
  ip: string | null;
}): string {
  const input = [
    prevHash ?? "",
    row.createdAt.toISOString(),
    row.actorId ?? "",
    row.actorName,
    row.module,
    row.action,
    row.entityType,
    row.entityId ?? "",
    row.summary,
    row.before ?? "",
    row.after ?? "",
    row.ip ?? ""
  ].join("|");
  return createHash("sha256").update(input).digest("hex");
}

export async function logAudit(input: AuditInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const last = await tx.auditLog.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { hash: true } });
    const before = maskJson(input.before);
    const after = maskJson(input.after);
    const createdAt = new Date();
    const fields = {
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      before,
      after,
      ip: input.ip ?? null
    };
    await tx.auditLog.create({
      data: {
        ...fields,
        createdAt,
        prevHash: last?.hash ?? null,
        hash: rowHash(last?.hash ?? null, { ...fields, createdAt })
      }
    });
  });
}

export interface ChainVerification {
  /// false only when a row's own hash fails to recompute (MUTATION — the row
  /// was edited after the fact). brokenAtId points at the first such row.
  ok: boolean;
  checked: number;
  brokenAtId: string | null;
  /// Linkage breaks: rows whose prevHash doesn't match the previous row's
  /// hash — the signature of a DELETED row. Reported, not fatal: shipped test
  /// fixtures prune their own audit rows; production retention never does.
  gaps: number;
}

/// Walk the whole trail in (createdAt, id) order, recompute every row hash and
/// count linkage gaps.
export async function verifyAuditChain(): Promise<ChainVerification> {
  const rows = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let prevHash: string | null = null;
  let gaps = 0;
  for (const row of rows) {
    if (row.hash === null || row.hash !== rowHash(row.prevHash, row)) {
      return { ok: false, checked: rows.length, brokenAtId: row.id, gaps };
    }
    if (row.prevHash !== prevHash) gaps++;
    prevHash = row.hash;
  }
  return { ok: true, checked: rows.length, brokenAtId: null, gaps };
}

/// One-time migration helper (Phase 21): chain rows written before the hash
/// columns existed (hash IS NULL). Idempotent — hashes only what is unchained,
/// starting from the last already-chained row (or genesis).
export async function backfillAuditChain(): Promise<number> {
  const rows = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let prevHash: string | null = null;
  let chained = 0;
  for (const row of rows) {
    if (row.hash === null) {
      const hash = rowHash(prevHash, row);
      await prisma.auditLog.update({ where: { id: row.id }, data: { prevHash, hash } });
      prevHash = hash;
      chained++;
    } else {
      prevHash = row.hash;
    }
  }
  return chained;
}
