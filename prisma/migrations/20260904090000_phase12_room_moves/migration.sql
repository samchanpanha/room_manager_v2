-- CreateTable
CREATE TABLE "RoomMove" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "fromLeaseId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,
    "effectiveAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requestedByRole" TEXT NOT NULL DEFAULT 'staff',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "executedById" TEXT,
    "executedAt" DATETIME,
    "cancelledById" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "newLeaseId" TEXT,
    "adjustmentInvoiceId" TEXT,
    "oldRentMinor" INTEGER,
    "newRentMinor" INTEGER,
    "rentCreditMinor" INTEGER,
    "newRentChargeMinor" INTEGER,
    "moveFeeMinor" INTEGER,
    "netMinor" INTEGER,
    "depositDeltaMinor" INTEGER,
    "inspectionsNote" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoomMove_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoomMove_fromLeaseId_fkey" FOREIGN KEY ("fromLeaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoomMove_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoomMove_newLeaseId_fkey" FOREIGN KEY ("newLeaseId") REFERENCES "Lease" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoomMove_adjustmentInvoiceId_fkey" FOREIGN KEY ("adjustmentInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomMove_code_key" ON "RoomMove"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMove_newLeaseId_key" ON "RoomMove"("newLeaseId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMove_adjustmentInvoiceId_key" ON "RoomMove"("adjustmentInvoiceId");

-- CreateIndex
CREATE INDEX "RoomMove_memberProfileId_status_idx" ON "RoomMove"("memberProfileId", "status");

-- CreateIndex
CREATE INDEX "RoomMove_fromLeaseId_idx" ON "RoomMove"("fromLeaseId");

