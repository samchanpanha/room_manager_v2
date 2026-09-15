-- Tenant isolation for shared catalog models (M11/M12/M14/M15):
-- Tariff, ServiceCatalog, StockCategory, Supplier and PosProduct now carry
-- tenantId so catalogs, rates and vendor lists never leak across workspaces.
-- Existing rows default to the platform DEFAULT workspace.

-- AlterTable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Tariff' AND column_name='tenantId') THEN
        ALTER TABLE "Tariff" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'DEFAULT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ServiceCatalog' AND column_name='tenantId') THEN
        ALTER TABLE "ServiceCatalog" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'DEFAULT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='StockCategory' AND column_name='tenantId') THEN
        ALTER TABLE "StockCategory" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'DEFAULT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Supplier' AND column_name='tenantId') THEN
        ALTER TABLE "Supplier" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'DEFAULT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PosProduct' AND column_name='tenantId') THEN
        ALTER TABLE "PosProduct" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'DEFAULT';
    END IF;
END $$;

-- Drop the global unique constraints in favour of per-workspace composites.
DROP INDEX IF EXISTS "PosProduct_name_key";
DROP INDEX IF EXISTS "PosProduct_barcode_key";
DROP INDEX IF EXISTS "ServiceCatalog_code_key";
DROP INDEX IF EXISTS "Supplier_name_key";
DROP INDEX IF EXISTS "StockCategory_name_parentId_propertyId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tariff_tenantId_idx" ON "Tariff"("tenantId");
CREATE INDEX IF NOT EXISTS "ServiceCatalog_tenantId_idx" ON "ServiceCatalog"("tenantId");
CREATE INDEX IF NOT EXISTS "StockCategory_tenantId_idx" ON "StockCategory"("tenantId");
CREATE INDEX IF NOT EXISTS "Supplier_tenantId_idx" ON "Supplier"("tenantId");
CREATE INDEX IF NOT EXISTS "PosProduct_tenantId_idx" ON "PosProduct"("tenantId");

-- Uniqueness is now scoped per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS "PosProduct_tenantId_name_key" ON "PosProduct"("tenantId","name");
CREATE UNIQUE INDEX IF NOT EXISTS "PosProduct_tenantId_barcode_key" ON "PosProduct"("tenantId","barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceCatalog_tenantId_code_key" ON "ServiceCatalog"("tenantId","code");
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_tenantId_name_key" ON "Supplier"("tenantId","name");
CREATE UNIQUE INDEX IF NOT EXISTS "StockCategory_name_parentId_propertyId_tenantId_key" ON "StockCategory"("name","parentId","propertyId","tenantId");

-- AddForeignKey
DO $$
BEGIN
    BEGIN
        ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER TABLE "ServiceCatalog" ADD CONSTRAINT "ServiceCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER TABLE "StockCategory" ADD CONSTRAINT "StockCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER TABLE "PosProduct" ADD CONSTRAINT "PosProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;