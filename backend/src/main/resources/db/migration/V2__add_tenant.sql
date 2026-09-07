-- V2 — SaaS multi-tenancy (shared DB, row-level tenant_id).
--
-- Additive & backfilled so the current single-tenant data keeps working:
--   1. create a Tenant table,
--   2. seed a DEFAULT tenant,
--   3. add nullable tenant_id to tenant-scoped tables,
--   4. backfill existing rows to DEFAULT,
--   5. enforce NOT NULL + FK + index.
--
-- Only the tables backing the Phase-1 vertical slice are included here; later
-- module migrations (V3+) extend the same pattern to their tables.

-- 1. Tenant registry -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id"        TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant" ("slug");

-- 2. Seed the default tenant that owns all pre-existing rows ----------------
INSERT INTO "Tenant" ("id", "slug", "name")
VALUES ('DEFAULT', 'default', 'Default Organization')
ON CONFLICT ("id") DO NOTHING;

-- 3-5. Add + backfill + constrain tenant_id on scoped tables ---------------
DO $$
DECLARE
    t text;
    scoped text[] := ARRAY[
        'Party','User','Role','MemberProfile','EmergencyContact',
        'Property','Building','Floor','Room','Bed',
        'AuditLog','DomainEvent','Setting','NumberSequence'
    ];
BEGIN
    FOREACH t IN ARRAY scoped LOOP
        -- add column if missing
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "tenantId" TEXT', t);
        -- backfill existing rows to DEFAULT
        EXECUTE format(
            'UPDATE %I SET "tenantId" = ''DEFAULT'' WHERE "tenantId" IS NULL', t);
        -- enforce NOT NULL
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "tenantId" SET NOT NULL', t);
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN "tenantId" SET DEFAULT ''DEFAULT''', t);
        -- index for tenant-scoped queries
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")',
            t || '_tenantId_idx', t);
    END LOOP;
END $$;
