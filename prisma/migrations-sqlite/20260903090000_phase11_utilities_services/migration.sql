-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT 'kWh',
    "roomId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meter_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meterId" TEXT NOT NULL,
    "valueMilli" INTEGER NOT NULL,
    "readAt" DATETIME NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utilityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyId" TEXT,
    "unitRateMinor" INTEGER NOT NULL,
    "tiers" JSONB,
    "effectiveFrom" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UtilityCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaseId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "consumptionMilli" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "tariffName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invoiceId" TEXT,
    "invoiceItemId" TEXT,
    "anomaly" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UtilityCharge_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UtilityCharge_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UtilityCharge_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "MeterReading" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingModel" TEXT NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "unitLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ServiceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" DATETIME NOT NULL,
    "suspendedAt" DATETIME,
    "endedAt" DATETIME,
    "parkingSlotId" TEXT,
    "wifiAccountId" TEXT,
    "snapshotId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceAssignment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceAssignment_parkingSlotId_fkey" FOREIGN KEY ("parkingSlotId") REFERENCES "ParkingSlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceAssignment_wifiAccountId_fkey" FOREIGN KEY ("wifiAccountId") REFERENCES "WifiAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "qtyMilli" INTEGER NOT NULL,
    "unitLabel" TEXT,
    "unitPriceMinor" INTEGER NOT NULL,
    "usedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invoiceId" TEXT,
    "invoiceItemId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceUsage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCatalog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceUsage_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParkingSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "monthlyFeeMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParkingSlot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WifiAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ssid" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "speedLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WifiAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Meter_code_key" ON "Meter"("code");

-- CreateIndex
CREATE INDEX "Meter_roomId_idx" ON "Meter"("roomId");

-- CreateIndex
CREATE INDEX "MeterReading_meterId_readAt_idx" ON "MeterReading"("meterId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_meterId_readAt_key" ON "MeterReading"("meterId", "readAt");

-- CreateIndex
CREATE INDEX "Tariff_utilityType_effectiveFrom_idx" ON "Tariff"("utilityType", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityCharge_readingId_key" ON "UtilityCharge"("readingId");

-- CreateIndex
CREATE INDEX "UtilityCharge_leaseId_status_idx" ON "UtilityCharge"("leaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalog_code_key" ON "ServiceCatalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAssignment_parkingSlotId_key" ON "ServiceAssignment"("parkingSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAssignment_wifiAccountId_key" ON "ServiceAssignment"("wifiAccountId");

-- CreateIndex
CREATE INDEX "ServiceAssignment_leaseId_status_idx" ON "ServiceAssignment"("leaseId", "status");

-- CreateIndex
CREATE INDEX "ServiceUsage_leaseId_status_idx" ON "ServiceUsage"("leaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlot_code_key" ON "ParkingSlot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WifiAccount_ssid_key" ON "WifiAccount"("ssid");
