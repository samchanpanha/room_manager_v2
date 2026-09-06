/**
 * Phase 21 (M27 Security + M28 Settings) — service-level tests against a
 * disposable COPY of the seeded database (PostgreSQL rentmanager_test):
 *   npm run test:pg:migrate && npm run test:pg:seed
 *   DATABASE_URL=postgresql://rentmanager:rentmanager@localhost:5432/rentmanager_test npx vitest run tests/security-settings.test.ts
 *
 * Covers: RFC-6238 TOTP vectors (±1 window), sealed login challenges, AES-256-GCM
 * secret sealing + masking, the mandatory-enrollment permission gate, audit PII
 * masking, audit hash-chain verification (mutation detection + linkage gaps),
 * settings groups (defaults/audit/feature flags/secret rotation with env
 * fallback), opening-balance ledger posting, the backup snapshot job, the
 * retention purge, the in-memory rate limiter, and S3 presigned-URL shape.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { prisma } from "@/lib/db";
import { base32Decode, base32Encode, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { createChallenge, verifyChallenge } from "@/lib/auth/challenge";
import { maskSecret, open as unseal, seal } from "@/lib/crypto/sealed";
import { backfillAuditChain, logAudit, verifyAuditChain } from "@/lib/audit";
import { can, hasModuleAccess, type EffectivePermission, type Subject } from "@/lib/rbac/can";
import {
  DEFAULT_FEATURE_FLAGS,
  getFeatureFlags,
  getProviderSecret,
  getSettings,
  getTemplateOverride,
  isModuleEnabled,
  setProviderSecret,
  updateSettings
} from "@/lib/settings";
import { allocateInvoiceNumber, applyLateFees, generateInvoices, runDunning } from "@/lib/billing/service";
import { reverseTransaction } from "@/lib/ledger/service";
import { postTransaction } from "@/lib/ledger/service";
import { backupDatabase, KEEP_BACKUPS } from "@/lib/backup";
import { runRetentionPurge } from "@/lib/retention";
import { rateLimit } from "@/lib/ratelimit";
import { S3Storage, s3ConfigFromEnv } from "@/lib/storage/s3";

let actor = { id: "fixture", name: "Phase 21 fixture" };

function subjectWith(permissions: EffectivePermission[], extra?: Partial<Subject>): Subject {
  return { id: "u_sec", propertyIds: [], permissions, ...extra };
}

beforeAll(async () => {
  const root = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
  actor = { id: root.id, name: root.name };
  // ensure the seeded audit trail is fully chained on this copy (idempotent)
  await backfillAuditChain();
});

afterAll(async () => {
  // restore env-fallback state for later suites (telegram mock routing reads
  // the token and must see the dev- default, not a sealed DB value)
  await prisma.setting.deleteMany({ where: { key: "m28.providers" } });
  await prisma.setting.deleteMany({ where: { key: "m28.features" } });
  await prisma.$disconnect();
});

describe("M27 TOTP (RFC-6238)", () => {
  it("matches RFC vectors and tolerates ±1 step clock skew", () => {
    // RFC 6238 appendix B, SHA-1 seed — 6-digit truncation of HOTP(counter=1)
    const b32 = base32Encode(Buffer.from("12345678901234567890", "ascii"));
    expect(b32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(verifyTotp(b32, "287082", { atMs: 59_000 })).toBe(true); // T=59s → counter 1
    expect(verifyTotp(b32, "287082", { atMs: 59_000 - 30_000 })).toBe(true); // window -1
    expect(verifyTotp(b32, "287082", { atMs: 59_000 + 30_000 })).toBe(true); // window +1
    expect(verifyTotp(b32, "287082", { atMs: 59_000 + 61_000 })).toBe(false); // beyond window
    expect(verifyTotp(b32, "028708", { atMs: 59_000 })).toBe(false); // wrong code
    expect(verifyTotp(b32, "28708", { atMs: 59_000 })).toBe(false); // malformed
  });

  it("base32 round-trips generated secrets; otpauth URI carries issuer+account", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret).length).toBe(20);
    const uri = otpauthUri(secret, "root@demo.test");
    expect(uri).toContain("otpauth://totp/RentManager%3Aroot%40demo.test");
    expect(uri).toContain("secret=");
    expect(uri).toContain("issuer=RentManager");
  });

  it("login challenges are user-bound and expire", () => {
    const token = createChallenge("user_a");
    expect(verifyChallenge(token, "user_a")).toBe(true);
    expect(verifyChallenge(token, "user_b")).toBe(false);
    expect(verifyChallenge("garbage.token", "user_a")).toBe(false);
    const expired = createChallenge("user_a", -1);
    expect(verifyChallenge(expired, "user_a")).toBe(false);
  });
});

describe("M27 sealed secrets (AES-256-GCM)", () => {
  it("round-trips, fails tampered ciphertext, masks reads", () => {
    const sealed = seal("12:AAreal-bot-token-9876");
    expect(unseal(sealed)).toBe("12:AAreal-bot-token-9876");
    const parts = sealed.split(".");
    const tampered = `v1.${parts[1]}.${parts[2]}.${Buffer.from("evil").toString("base64url")}`;
    expect(unseal(tampered)).toBeNull();
    const mask = maskSecret(sealed);
    expect(mask).toEqual({ configured: true, last4: "9876" });
    expect(maskSecret(null)).toEqual({ configured: false, last4: null });
  });
});

describe("M27 mandatory 2FA enrollment gate (§15 v1.4a)", () => {
  const perms: EffectivePermission[] = [
    { module: "M09", action: "create", scope: "GLOBAL" },
    { module: "M27", action: "update", scope: "GLOBAL" },
    { module: "M27", action: "read", scope: "GLOBAL" }
  ];
  it("blocks every module except M27 until enrollment completes", () => {
    const gated = subjectWith(perms, { totpEnrollmentRequired: true });
    expect(hasModuleAccess(gated, "create", "M09")).toBe(false);
    expect(can(gated, "create", "M09")).toBe(false);
    expect(can(gated, "update", "M27")).toBe(true);
    expect(hasModuleAccess(gated, "read", "M27")).toBe(true);
    const enrolled = subjectWith(perms);
    expect(hasModuleAccess(enrolled, "create", "M09")).toBe(true);
  });
});

describe("M27 audit trail (PII masking + tamper evidence)", () => {
  it("masks emails, phones and sensitive keys in before/after payloads", async () => {
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M27",
      action: "update",
      entityType: "pii_probe",
      entityId: "probe1",
      summary: "PII masking probe",
      before: { email: "chan.ling@example.test", phone: "+855 12 345 678", name: "Chan Ling", idNumber: "KH-998877" }
    });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "pii_probe", entityId: "probe1" } });
    const payload = JSON.parse(row.before!) as Record<string, string>;
    expect(payload.email).not.toContain("chan.ling@example.test");
    expect(payload.email).toMatch(/^c\*\*\*@/);
    expect(payload.phone).not.toContain("345 678");
    expect(payload.idNumber).toBe("K***");
    expect(payload.name).toBe("Chan Ling"); // operational fields stay readable
  });

  it("detects mutation (hash mismatch) and counts deletion gaps separately", async () => {
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      module: "M28",
      action: "update",
      entityType: "chain_probe",
      entityId: "probe2",
      summary: "chain probe — original"
    });
    const before = await verifyAuditChain();
    expect(before.ok).toBe(true);

    const probe = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "chain_probe", entityId: "probe2" } });
    await prisma.auditLog.update({ where: { id: probe.id }, data: { summary: "chain probe — TAMPERED" } });
    const after = await verifyAuditChain();
    expect(after.ok).toBe(false);
    expect(after.brokenAtId).toBe(probe.id);

    await prisma.auditLog.update({ where: { id: probe.id }, data: { summary: "chain probe — original" } });
    const restored = await verifyAuditChain();
    expect(restored.ok).toBe(true);
    expect(typeof restored.gaps).toBe("number");
  });
});

describe("M28 settings (audited, forward-only, sealed secrets)", () => {
  it("returns defaults, applies audited updates, drives feature flags", async () => {
    const initial = await getSettings();
    expect(initial.org.name.length).toBeGreaterThan(0);
    expect(initial.billing.dunningDays).toEqual([3, 7, 14]);
    expect(initial.features).toMatchObject(DEFAULT_FEATURE_FLAGS);

    await updateSettings("org", { name: "Borey Penh Holdings" }, actor, "127.0.0.1");
    const updated = await getSettings();
    expect(updated.org.name).toBe("Borey Penh Holdings");

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { module: "M28", entityType: "setting", entityId: "m28.org" },
      orderBy: { createdAt: "desc" }
    });
    expect(audit.summary).toContain("org");
    expect((JSON.parse(audit.after!) as { name: string }).name).toBe("Borey Penh Holdings");

    await updateSettings("features", { M14: false }, actor, null);
    expect(await isModuleEnabled("M14")).toBe(false);
    expect(await isModuleEnabled("M15")).toBe(true);
    const flags = await getFeatureFlags();
    expect(flags.M14).toBe(false);
  });

  it("seals provider secrets, masks them in reads, falls back to env", async () => {
    const secretValue = "dev-telegram-rotated-987654";
    await setProviderSecret("telegramBotToken", secretValue, actor, null);
    expect(await getProviderSecret("telegramBotToken")).toBe(secretValue); // runtime accessor decrypts

    const settings = await getSettings();
    expect(settings.providers.telegramBotToken).toEqual({ configured: true, last4: "7654" });

    const raw = await prisma.setting.findUniqueOrThrow({ where: { key: "m28.providers" } });
    expect(raw.value).not.toContain(secretValue); // never plaintext at rest

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { module: "M28", entityType: "setting", summary: { contains: "rotated" } },
      orderBy: { createdAt: "desc" }
    });
    expect(audit.summary).not.toContain(secretValue);
    expect(JSON.stringify(audit.after ?? "")).not.toContain(secretValue);

    await prisma.setting.delete({ where: { key: "m28.providers" } });
    expect(await getProviderSecret("telegramBotToken")).toBe(process.env.TELEGRAM_BOT_TOKEN ?? "dev-telegram-token"); // env fallback
  });
});

describe("M28 opening balances (balanced `opening` posting)", () => {
  it("posts a balanced opening transaction through the ledger", async () => {
    const debitBefore = await prisma.ledgerEntry.aggregate({ where: { account: { code: "1100" } }, _sum: { debit: true } });
    const creditBefore = await prisma.ledgerEntry.aggregate({ where: { account: { code: "1300" } }, _sum: { credit: true } });

    const txId = await prisma.$transaction((tx) =>
      postTransaction(tx, {
        memo: "Opening balances (fixture)",
        refType: "opening",
        actorId: actor.id,
        lines: [
          { code: "1100", debit: 50_000, credit: 0 },
          { code: "1300", debit: 0, credit: 50_000 }
        ]
      })
    );

    const debitAfter = await prisma.ledgerEntry.aggregate({ where: { account: { code: "1100" } }, _sum: { debit: true } });
    const creditAfter = await prisma.ledgerEntry.aggregate({ where: { account: { code: "1300" } }, _sum: { credit: true } });
    expect(debitAfter._sum.debit! - debitBefore._sum.debit!).toBe(50_000);
    expect(creditAfter._sum.credit! - creditBefore._sum.credit!).toBe(50_000);
    const tx = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: txId }, select: { refType: true, totalDebit: true, totalCredit: true } });
    expect(tx.refType).toBe("opening");
    expect(tx.totalDebit).toBe(tx.totalCredit);
  });

  it("rejects unbalanced opening postings", async () => {
    await expect(
      prisma.$transaction((tx) =>
        postTransaction(tx, {
          memo: "Unbalanced attempt",
          refType: "opening",
          lines: [
            { code: "1100", debit: 100, credit: 0 },
            { code: "1300", debit: 0, credit: 90 }
          ]
        })
      )
    ).rejects.toThrow(/UNBALANCED/);
  });
});

/// The backup job shells out to `pg_dump` (installed in the Docker image via
/// postgresql-client). Skip when the binary is absent locally so the suite
/// still runs on machines without the Postgres client tools.
const hasPgDump = () => {
  try {
    return spawnSync("which", ["pg_dump"]).status === 0;
  } catch {
    return false;
  }
};
const describeBackup = hasPgDump() ? describe : describe.skip;

describeBackup("M27 backup snapshot job", () => {
  it("creates a consistent snapshot and prunes to the retention count", async () => {
    const dir = "/tmp/p21-backups";
    rmSync(dir, { recursive: true, force: true });
    process.env.BACKUP_DIR = dir;
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < KEEP_BACKUPS + 2; i++) {
      writeFileSync(path.join(dir, `backup-2020-01-0${i % 10}-00-00-00-000Z.dump`), "stale");
    }
    const result = await backupDatabase();
    expect(statSync(result.file).size).toBeGreaterThan(0);
    const remaining = readdirSync(dir).filter((f) => f.startsWith("backup-"));
    expect(remaining.length).toBeLessThanOrEqual(KEEP_BACKUPS);
    expect(result.pruned.length).toBeGreaterThanOrEqual(2);
  });
});

describe("M28 retention purge", () => {
  it("purges stale outbox/events/OTPs/sessions, never audit rows", async () => {
    const member = await prisma.memberProfile.findFirstOrThrow({ select: { id: true } });
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    await prisma.telegramOutbox.create({ data: { chatId: "999999", template: "retention_probe", body: "old", status: "mocked", createdAt: old } });
    await prisma.domainEvent.create({ data: { type: "retention.probe", payload: "{}", occurredAt: old } });
    await prisma.memberOtp.create({
      data: { identifier: "retention.probe@example.test", codeHash: "x", memberProfileId: member.id, expiresAt: old, consumedAt: old }
    });
    await prisma.session.create({
      data: { userId: actor.id, tokenHash: `retention-probe-${Date.now()}`, expiresAt: new Date(Date.now() + 86_400_000), revokedAt: old }
    });
    const auditsBefore = await prisma.auditLog.count();

    const result = await runRetentionPurge(actor, null);
    expect(result.outbox).toBeGreaterThanOrEqual(1);
    expect(result.events).toBeGreaterThanOrEqual(1);
    expect(result.otps).toBeGreaterThanOrEqual(1);
    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.count()).toBe(auditsBefore + 1); // the purge's own audit, nothing purged
  });
});

describe("M27 rate limiter + S3 presign", () => {
  it("slides its window: allows the limit then refuses", () => {
    const key = `probe:${Date.now()}-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("presigns S3 GETs with query auth (no network)", async () => {
    process.env.S3_BUCKET = "probe-bucket";
    process.env.S3_ACCESS_KEY_ID = "AKIDPROBE";
    process.env.S3_SECRET_ACCESS_KEY = "secret-probe";
    process.env.S3_REGION = "us-east-1";
    expect(s3ConfigFromEnv()?.bucket).toBe("probe-bucket");
    const storage = new S3Storage(s3ConfigFromEnv()!);
    const url = new URL(await storage.signedUrl("objects/abc.pdf", 120));
    expect(url.pathname).toContain("probe-bucket");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(url.searchParams.get("X-Amz-Signature")?.length).toBe(64);
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    expect(s3ConfigFromEnv()).toBeNull(); // dev-disk fallback when unconfigured
  });
});

describe("M28 settings → engine wiring (settings actually drive behaviour)", () => {
  it("invoicePrefix setting is prepended to generated invoice codes", async () => {
    // direct formatting check
    const plain = await prisma.$transaction((tx) => allocateInvoiceNumber(tx, "ZZZ", 2026));
    expect(plain).toMatch(/^ZZZ-2026-\d{4}$/);

    // end-to-end: generateInvoices must read the org prefix from settings.
    // Reopen a billing period by deleting an allocation-free invoice of the
    // active lease, then regenerate with the prefix configured.
    const lease = await prisma.lease.findFirstOrThrow({ where: { status: "active" }, select: { id: true } });
    const candidates = await prisma.invoice.findMany({
      where: { leaseId: lease.id, allocations: { none: {} } },
      orderBy: { periodEnd: "desc" },
      select: { id: true, code: true }
    });
    let deleted = false;
    for (const c of candidates) {
      try {
        await prisma.invoice.delete({ where: { id: c.id } });
        deleted = true;
        break;
      } catch {
        // Restrict (deposit/credit-note link) — try the next candidate
      }
    }
    if (!deleted) return; // nothing regenerable on this copy — prefix path covered above

    await updateSettings("billing", { invoicePrefix: "X-" }, actor, null);
    const summary = await generateInvoices(actor);
    expect(summary.generated).toBeGreaterThanOrEqual(1);
    const regen = await prisma.invoice.findFirstOrThrow({
      where: { leaseId: lease.id, code: { startsWith: "X-" } },
      orderBy: { createdAt: "desc" },
      select: { code: true }
    });
    expect(regen.code).toMatch(/^X-.+-\d{4}-\d{4}$/);
    await updateSettings("billing", { invoicePrefix: "" }, actor, null); // restore default
  });

  it("graceDays gates the overdue transition in the dunning sweep", async () => {
    const member = await prisma.memberProfile.findFirstOrThrow({ select: { id: true } });
    const property = await prisma.property.findFirstOrThrow({ select: { id: true } });
    const due3dAgo = new Date(Date.now() - 3 * 86_400_000);
    const inv = await prisma.invoice.create({
      data: {
        code: `P21-GRA-${Date.now()}`,
        propertyId: property.id,
        memberProfileId: member.id,
        status: "issued",
        periodStart: new Date(Date.now() - 40 * 86_400_000),
        periodEnd: new Date(Date.now() - 10 * 86_400_000),
        dueDate: due3dAgo,
        totalMinor: 9000,
        amountDueMinor: 9000
      },
      select: { id: true }
    });

    await updateSettings("billing", { graceDays: 5 }, actor, null);
    await runDunning(actor);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("issued"); // inside grace

    await updateSettings("billing", { graceDays: 1 }, actor, null);
    await runDunning(actor);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("overdue"); // past grace

    await prisma.invoice.delete({ where: { id: inv.id } });
    await updateSettings("billing", { graceDays: 3 }, actor, null); // restore default
  });

  it("late-fee M28 defaults apply when no M06 rule is active", async () => {
    const member = await prisma.memberProfile.findFirstOrThrow({ select: { id: true } });
    const property = await prisma.property.findFirstOrThrow({ select: { id: true } });
    const inv = await prisma.invoice.create({
      data: {
        code: `P21-LF-${Date.now()}`,
        propertyId: property.id,
        memberProfileId: member.id,
        status: "overdue",
        periodStart: new Date(Date.now() - 60 * 86_400_000),
        periodEnd: new Date(Date.now() - 30 * 86_400_000),
        dueDate: new Date(Date.now() - 10 * 86_400_000),
        totalMinor: 5000,
        amountDueMinor: 5000
      },
      select: { id: true }
    });

    await prisma.lateFeeRule.updateMany({ data: { isActive: false } });
    await updateSettings("lateFee", { mode: "flat", flatMinor: 250 }, actor, null);
    await updateSettings("billing", { graceDays: 3 }, actor, null);

    const result = await applyLateFees(actor);
    expect(result.applied).toBeGreaterThanOrEqual(1);
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: inv.id, kind: "late_fee" } });
    expect(items).toHaveLength(1);
    expect(items[0]!.amountMinor).toBe(250);

    // mode "none" disables late fees entirely
    await updateSettings("lateFee", { mode: "none" }, actor, null);
    const again = await applyLateFees(actor);
    expect(again.applied).toBe(0);

    // restore: reverse the fixture posting (append-only net-zero — this suite
    // may run BEFORE the billing suite, whose chart-mapping test counts exact
    // per-account deltas) and drop the fixture invoice
    const feeTx = await prisma.ledgerTransaction.findFirstOrThrow({ where: { refType: "late_fee", refId: inv.id }, select: { id: true } });
    await prisma.$transaction((tx) => reverseTransaction(tx, feeTx.id, { memo: "P21 wiring fixture reversal", refType: "late_fee" }));
    await prisma.lateFeeRule.updateMany({ data: { isActive: true } });
    await updateSettings("lateFee", { mode: "flat", flatMinor: 0 }, actor, null);
    await prisma.invoice.delete({ where: { id: inv.id } });
  });

  it("notification template overrides render with {var} substitution", async () => {
    expect(await getTemplateOverride("invoice.issued", { code: "X-1", total: "10.00" })).toBeNull(); // no override yet
    await updateSettings("templates", { "payment.confirmed": "Merci! {receipt} · {total}" }, actor, null);
    expect(await getTemplateOverride("payment.confirmed", { receipt: "RCP-9", total: "12.50" })).toBe("Merci! RCP-9 · 12.50");
    expect(await getTemplateOverride("payment.confirmed", {})).toBe("Merci! {receipt} · {total}"); // unknown vars stay literal
    await updateSettings("templates", { "payment.confirmed": "" }, actor, null); // empty clears the override
    expect(await getTemplateOverride("payment.confirmed", { receipt: "R" })).toBeNull();
  });

  it("the legacy org.profile key no longer feeds M28 reads (single source of truth)", async () => {
    await prisma.setting.upsert({
      where: { key: "org.profile" },
      create: { key: "org.profile", value: JSON.stringify({ name: "LEGACY NAME" }), updatedBy: "test" },
      update: { value: JSON.stringify({ name: "LEGACY NAME" }) }
    });
    expect((await getSettings()).org.name).not.toBe("LEGACY NAME"); // m28.org wins
  });
});
