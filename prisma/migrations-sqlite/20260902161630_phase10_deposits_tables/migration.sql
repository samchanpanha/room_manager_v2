-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseId" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "propertyId" TEXT,
    "requiredMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deposit_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deposit_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deposit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepositTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "depositId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reason" TEXT,
    "evidenceDocId" TEXT,
    "note" TEXT NOT NULL,
    "method" TEXT,
    "ledgerTxId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepositTransaction_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leaseId" TEXT,
    "memberProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "issuedAt" DATETIME,
    "dueDate" DATETIME,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "amountCreditedMinor" INTEGER NOT NULL DEFAULT 0,
    "amountDueMinor" INTEGER NOT NULL DEFAULT 0,
    "dunningStage" INTEGER NOT NULL DEFAULT 0,
    "voidReason" TEXT,
    "voidedAt" DATETIME,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountCreditedMinor", "amountDueMinor", "amountPaidMinor", "code", "createdAt", "createdById", "discountMinor", "dueDate", "dunningStage", "id", "issuedAt", "leaseId", "memberProfileId", "notes", "periodEnd", "periodStart", "propertyId", "status", "subtotalMinor", "taxMinor", "totalMinor", "updatedAt", "voidReason", "voidedAt") SELECT "amountCreditedMinor", "amountDueMinor", "amountPaidMinor", "code", "createdAt", "createdById", "discountMinor", "dueDate", "dunningStage", "id", "issuedAt", "leaseId", "memberProfileId", "notes", "periodEnd", "periodStart", "propertyId", "status", "subtotalMinor", "taxMinor", "totalMinor", "updatedAt", "voidReason", "voidedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_code_key" ON "Invoice"("code");
CREATE INDEX "Invoice_leaseId_periodStart_idx" ON "Invoice"("leaseId", "periodStart");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_memberProfileId_idx" ON "Invoice"("memberProfileId");
CREATE INDEX "Invoice_propertyId_idx" ON "Invoice"("propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_leaseId_key" ON "Deposit"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_invoiceId_key" ON "Deposit"("invoiceId");

-- CreateIndex
CREATE INDEX "Deposit_memberProfileId_idx" ON "Deposit"("memberProfileId");

-- CreateIndex
CREATE INDEX "Deposit_propertyId_idx" ON "Deposit"("propertyId");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE INDEX "DepositTransaction_depositId_idx" ON "DepositTransaction"("depositId");

