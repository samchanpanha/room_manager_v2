-- M32 Rent modules: progressive-duration-bucket short-stay rentals
-- CreateTable
CREATE TABLE "RentModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "billingStrategy" TEXT NOT NULL DEFAULT 'progressive',
    "minDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "maxDurationMinutes" INTEGER NOT NULL DEFAULT 1440,
    "defaultDepositMinor" INTEGER NOT NULL DEFAULT 0,
    "minGuests" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER NOT NULL DEFAULT 4,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "propertyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentModule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StayRateRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "propertyId" TEXT,
    "roomType" TEXT,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveThrough" DATETIME,
    "toMinutes" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StayRateRule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "RentModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StayRateRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StayBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "guestIdNumber" TEXT,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "priceSnapshotMinor" INTEGER NOT NULL DEFAULT 0,
    "dayPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "depositMinor" INTEGER NOT NULL DEFAULT 0,
    "posMode" TEXT NOT NULL DEFAULT 'direct',
    "tabInvoiceId" TEXT,
    "checkedOutAt" DATETIME,
    "voidReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StayBooking_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "RentModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayBooking_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RentModule_isActive_idx" ON "RentModule"("isActive");
CREATE UNIQUE INDEX "RentModule_slug_key" ON "RentModule"("slug");

-- CreateIndex
CREATE INDEX "StayRateRule_moduleId_toMinutes_idx" ON "StayRateRule"("moduleId", "toMinutes");

-- CreateIndex
CREATE INDEX "StayBooking_roomId_checkIn_checkOut_idx" ON "StayBooking"("roomId", "checkIn", "checkOut");
CREATE INDEX "StayBooking_memberProfileId_idx" ON "StayBooking"("memberProfileId");
CREATE INDEX "StayBooking_status_idx" ON "StayBooking"("status");
CREATE UNIQUE INDEX "StayBooking_tabInvoiceId_key" ON "StayBooking"("tabInvoiceId");
CREATE UNIQUE INDEX "StayBooking_code_key" ON "StayBooking"("code");

-- RedefineTables (add Invoice.stayBookingId FK)
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
    "stayBookingId" TEXT,
    CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_stayBookingId_fkey" FOREIGN KEY ("stayBookingId") REFERENCES "StayBooking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountCreditedMinor", "amountDueMinor", "amountPaidMinor", "code", "createdAt", "createdById", "discountMinor", "dunningStage", "dueDate", "id", "isDeposit", "issuedAt", "leaseId", "memberProfileId", "notes", "periodEnd", "periodStart", "propertyId", "status", "subtotalMinor", "taxMinor", "totalMinor", "updatedAt", "voidReason", "voidedAt") SELECT "amountCreditedMinor", "amountDueMinor", "amountPaidMinor", "code", "createdAt", "createdById", "discountMinor", "dunningStage", "dueDate", "id", "isDeposit", "issuedAt", "leaseId", "memberProfileId", "notes", "periodEnd", "periodStart", "propertyId", "status", "subtotalMinor", "taxMinor", "totalMinor", "updatedAt", "voidReason", "voidedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_code_key" ON "Invoice"("code");
CREATE UNIQUE INDEX "Invoice_stayBookingId_key" ON "Invoice"("stayBookingId");
CREATE INDEX "Invoice_leaseId_periodStart_idx" ON "Invoice"("leaseId", "periodStart");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_memberProfileId_idx" ON "Invoice"("memberProfileId");
CREATE INDEX "Invoice_propertyId_idx" ON "Invoice"("propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;