-- V11 — POS (INTENT.md M14) tenant scoping.
--
-- Tenant-scope the POS session/sale tables the pos sub-package reads and writes.
-- PosProduct is intentionally omitted: the Prisma schema keeps the catalog
-- global (name + barcode unique), like Supplier, so the JPA entity has no
-- tenantId column. Backfilled to the DEFAULT tenant so existing single-tenant
-- data is untouched, then NOT NULL with a default + index — identical to V2–V10.
DO $$
DECLARE
    t text;
    scoped text[] := ARRAY['PosSession','PosSale','PosSaleItem'];
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
