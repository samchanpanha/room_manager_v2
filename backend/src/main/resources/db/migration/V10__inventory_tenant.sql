-- V10 — inventory (INTENT.md M15) tenant scoping.
--
-- Tenant-scope the stock tables the inventory module reads and writes.
-- StockCategory and Supplier are intentionally omitted: the Prisma schema keeps
-- them shared (categories carry their own nullable propertyId for scoping, and
-- Supplier is a global, name-unique directory), so the JPA entities have no
-- tenantId column. Backfilled to the DEFAULT tenant so existing single-tenant
-- data is untouched, then NOT NULL with a default + index — identical to V2–V9.
DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['StockItem','StockMovement','Stocktake','StocktakeLine'];
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
