-- Drop global unique constraints on ServiceAssignment foreign keys
ALTER TABLE "ServiceAssignment" DROP CONSTRAINT IF EXISTS "ServiceAssignment_parkingSlotId_key";
ALTER TABLE "ServiceAssignment" DROP CONSTRAINT IF EXISTS "ServiceAssignment_wifiAccountId_key";

DROP INDEX IF EXISTS "ServiceAssignment_parkingSlotId_key";
DROP INDEX IF EXISTS "ServiceAssignment_wifiAccountId_key";

-- Create standard indexes for lookups
CREATE INDEX IF NOT EXISTS "ServiceAssignment_parkingSlotId_idx" ON "ServiceAssignment"("parkingSlotId");
CREATE INDEX IF NOT EXISTS "ServiceAssignment_wifiAccountId_idx" ON "ServiceAssignment"("wifiAccountId");

-- Create partial unique indexes so only active/suspended assignments hold the resource uniquely,
-- allowing historical (ended) assignments to coexist without unique constraint collisions.
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAssignment_active_parkingSlotId_key"
  ON "ServiceAssignment"("parkingSlotId")
  WHERE status IN ('active', 'suspended');

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAssignment_active_wifiAccountId_key"
  ON "ServiceAssignment"("wifiAccountId")
  WHERE status IN ('active', 'suspended');
