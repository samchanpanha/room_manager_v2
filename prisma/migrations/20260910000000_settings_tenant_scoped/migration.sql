-- AlterTable Setting
DO $$
BEGIN
    -- Drop old primary key constraint on Setting(key) if exists
    ALTER TABLE "Setting" DROP CONSTRAINT IF EXISTS "Setting_pkey";

    -- Add tenantId column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Setting' AND column_name='tenantId') THEN
        ALTER TABLE "Setting" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'DEFAULT';
    END IF;

    -- Add primary key on (tenantId, key)
    ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("tenantId", "key");
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Setting_tenantId_idx" ON "Setting"("tenantId");

-- AddForeignKey
DO $$
BEGIN
    BEGIN
        ALTER TABLE "Setting" ADD CONSTRAINT "Setting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
