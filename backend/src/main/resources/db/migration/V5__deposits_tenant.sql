-- V5 — tenant_id for the deposit tables (INTENT.md M10).
--
-- Same additive + backfill + constrain pattern as V2–V4, extended to the
-- deposit tables now that the finance/deposits module is ported.

DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['Deposit','DepositTransaction'];
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
