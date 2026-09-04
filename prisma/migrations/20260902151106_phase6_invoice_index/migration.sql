-- DropIndex
DROP INDEX "Invoice_leaseId_periodStart_key";

-- CreateIndex
CREATE INDEX "Invoice_leaseId_periodStart_idx" ON "Invoice"("leaseId", "periodStart");
