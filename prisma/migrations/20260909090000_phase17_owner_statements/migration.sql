-- CreateTable
CREATE TABLE "OwnerStatement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "collectedMinor" INTEGER NOT NULL,
    "grossShareMinor" INTEGER NOT NULL,
    "managementFeeMinor" INTEGER NOT NULL,
    "passthroughMinor" INTEGER NOT NULL,
    "ownerMaintenanceMinor" INTEGER NOT NULL,
    "adjustmentsMinor" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL,
    "adjustmentsReason" TEXT,
    "lineSnapshot" TEXT NOT NULL,
    "ledgerTxId" TEXT,
    "paidVia" TEXT,
    "paidAt" DATETIME,
    "paidById" TEXT,
    "statementDocId" TEXT,
    "generatedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OwnerStatement_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnerStatement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "OwnerContract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnerStatement_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "chargeTo" TEXT NOT NULL DEFAULT 'company',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExpenseCategory" ("accountCode", "createdAt", "id", "isActive", "name", "propertyId", "updatedAt") SELECT "accountCode", "createdAt", "id", "isActive", "name", "propertyId", "updatedAt" FROM "ExpenseCategory";
DROP TABLE "ExpenseCategory";
ALTER TABLE "new_ExpenseCategory" RENAME TO "ExpenseCategory";
CREATE UNIQUE INDEX "ExpenseCategory_propertyId_name_key" ON "ExpenseCategory"("propertyId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_code_key" ON "OwnerStatement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_ledgerTxId_key" ON "OwnerStatement"("ledgerTxId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_statementDocId_key" ON "OwnerStatement"("statementDocId");

-- CreateIndex
CREATE INDEX "OwnerStatement_ownerProfileId_month_idx" ON "OwnerStatement"("ownerProfileId", "month");

-- CreateIndex
CREATE INDEX "OwnerStatement_propertyId_month_idx" ON "OwnerStatement"("propertyId", "month");

-- CreateIndex
CREATE INDEX "OwnerStatement_status_idx" ON "OwnerStatement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerStatement_contractId_month_key" ON "OwnerStatement"("contractId", "month");

