-- V8 — utilities (INTENT.md M11) tenant scoping.
--
-- Tenant-scope the meter/reading/tariff/charge tables the utilities module
-- reads and writes. Backfilled to the DEFAULT tenant so existing single-tenant
-- data is untouched, then made NOT NULL with a default + index — identical to
-- V2–V7.
DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['Meter','MeterReading','Tariff','UtilityCharge'];
BEGIN
    FOREACH t IN ARRAY scoped LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
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
        END IF;
    END LOOP;
END $$;
