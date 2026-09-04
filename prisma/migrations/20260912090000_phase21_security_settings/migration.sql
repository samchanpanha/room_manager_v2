-- Phase 21 (M27 Security + M28 Settings) — additive only (§3: no destructive migration edits).
-- TOTP secret is sealed (AES-256-GCM) before it ever touches this column.
-- AuditLog gains a hash chain: hash = SHA-256(prevHash | row fields), prevHash = previous row's hash.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "prevHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "hash" TEXT;
