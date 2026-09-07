-- V3 — tenant_id for the billing module tables (INTENT.md M07).
--
-- Same additive + backfill + constrain pattern as V2, extended to the invoice
-- tables now that the billing module is ported. Kept as a separate migration so
-- V2 (already applied on existing environments) is never rewritten.

DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['Invoice','InvoiceItem','CreditNote'];
BEGIN
    FOREACH t IN ARRAY scoped LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "tenantId" TEXT', t);
        EXECUTE format(
            'UPDATE %I SET "tenantId" = ''DEFAULT'' WHERE "tenantId" IS NULL', t);
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "tenantId" SET NOT NULL', t);
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "tenantId" SET DEFAULT ''DEFAULT''', t);
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")',
            t || '_tenantId_idx', t);
    END LOOP;
END $$;

-- Composite index powering the M05 open-dues gate and per-member invoice lists.
CREATE INDEX IF NOT EXISTS "Invoice_tenant_member_status_idx"
    ON "Invoice" ("tenantId", "memberProfileId", "status");
