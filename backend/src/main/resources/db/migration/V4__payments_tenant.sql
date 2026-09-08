-- V4 — tenant_id for the payment tables (INTENT.md M09).
--
-- Same additive + backfill + constrain pattern as V2/V3, extended to the
-- payment tables now that M09 is ported. Kept separate so prior migrations are
-- never rewritten on environments that already applied them.

DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['Payment','PaymentAllocation'];
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
