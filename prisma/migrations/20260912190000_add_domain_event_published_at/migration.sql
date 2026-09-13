-- Migration: Add publishedAt column + index to DomainEvent for the Kafka transactional outbox relay.
-- Additive only (INTENT.md §3). IF NOT EXISTS guards make it idempotent.

-- Add column (no-op if already exists from db push)
ALTER TABLE "DomainEvent"
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Add index (IF NOT EXISTS guards against re-application)
CREATE INDEX IF NOT EXISTS "DomainEvent_publishedAt_idx"
  ON "DomainEvent" ("publishedAt");
