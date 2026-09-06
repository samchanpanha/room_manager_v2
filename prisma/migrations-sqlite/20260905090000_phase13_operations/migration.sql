-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "leaseId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "templateId" TEXT,
    "scheduledAt" DATETIME,
    "completedAt" DATETIME,
    "inspectorById" TEXT,
    "items" JSONB,
    "overallScore" INTEGER,
    "summaryNote" TEXT,
    "reportDocId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inspection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "note" TEXT NOT NULL,
    "photoDocId" TEXT,
    "ticketId" TEXT,
    "deductionMinor" INTEGER,
    "deductionStatus" TEXT,
    "deductionTxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectionFinding_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "leaseId" TEXT,
    "memberProfileId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'staff',
    "reportedById" TEXT,
    "slaDueAt" DATETIME NOT NULL,
    "slaBreachedAt" DATETIME,
    "escalatedAt" DATETIME,
    "assignedToId" TEXT,
    "assignedAt" DATETIME,
    "vendorName" TEXT,
    "resolvedAt" DATETIME,
    "resolutionNote" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceTicket_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceTicket_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "stockItemId" TEXT,
    "chargeTo" TEXT NOT NULL DEFAULT 'expense',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceCost_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "leaseId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "source" TEXT NOT NULL DEFAULT 'portal',
    "status" TEXT NOT NULL DEFAULT 'new',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slaDueAt" DATETIME NOT NULL,
    "slaBreachedAt" DATETIME,
    "escalatedAt" DATETIME,
    "assignedToId" TEXT,
    "ticketId" TEXT,
    "resolvedAt" DATETIME,
    "resolutionNote" TEXT,
    "rating" INTEGER,
    "ratingNote" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Complaint_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Complaint_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Complaint_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplaintComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "complaintId" TEXT NOT NULL,
    "authorById" TEXT,
    "byMember" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "photoDocId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplaintComment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "memberProfileId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedId" TEXT,
    "propertyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "rentAmountMinor" INTEGER NOT NULL,
    "billingCycleDay" INTEGER NOT NULL DEFAULT 1,
    "prorationBasis" TEXT NOT NULL DEFAULT 'calendar',
    "depositTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "depositInstallments" INTEGER NOT NULL DEFAULT 1,
    "noticeDays" INTEGER NOT NULL DEFAULT 30,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "escalationPercent" INTEGER,
    "rentPlanId" TEXT,
    "nextBillingDate" DATETIME,
    "moveOutInspectionId" TEXT,
    "terminationReason" TEXT,
    "terminatedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lease_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lease_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lease_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lease_rentPlanId_fkey" FOREIGN KEY ("rentPlanId") REFERENCES "RentPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lease_moveOutInspectionId_fkey" FOREIGN KEY ("moveOutInspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lease" ("autoRenew", "bedId", "billingCycleDay", "code", "createdAt", "createdById", "depositInstallments", "depositTotalMinor", "endDate", "escalationPercent", "id", "memberProfileId", "moveOutInspectionId", "nextBillingDate", "noticeDays", "propertyId", "prorationBasis", "rentAmountMinor", "rentPlanId", "roomId", "startDate", "status", "terminatedAt", "terminationReason", "updatedAt") SELECT "autoRenew", "bedId", "billingCycleDay", "code", "createdAt", "createdById", "depositInstallments", "depositTotalMinor", "endDate", "escalationPercent", "id", "memberProfileId", "moveOutInspectionId", "nextBillingDate", "noticeDays", "propertyId", "prorationBasis", "rentAmountMinor", "rentPlanId", "roomId", "startDate", "status", "terminatedAt", "terminationReason", "updatedAt" FROM "Lease";
DROP TABLE "Lease";
ALTER TABLE "new_Lease" RENAME TO "Lease";
CREATE UNIQUE INDEX "Lease_code_key" ON "Lease"("code");
CREATE UNIQUE INDEX "Lease_moveOutInspectionId_key" ON "Lease"("moveOutInspectionId");
CREATE INDEX "Lease_memberProfileId_idx" ON "Lease"("memberProfileId");
CREATE INDEX "Lease_roomId_idx" ON "Lease"("roomId");
CREATE INDEX "Lease_status_idx" ON "Lease"("status");
CREATE INDEX "Lease_propertyId_idx" ON "Lease"("propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplate_name_roomType_key" ON "InspectionTemplate"("name", "roomType");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_code_key" ON "Inspection"("code");

-- CreateIndex
CREATE INDEX "Inspection_leaseId_idx" ON "Inspection"("leaseId");

-- CreateIndex
CREATE INDEX "Inspection_roomId_idx" ON "Inspection"("roomId");

-- CreateIndex
CREATE INDEX "Inspection_propertyId_type_idx" ON "Inspection"("propertyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFinding_ticketId_key" ON "InspectionFinding"("ticketId");

-- CreateIndex
CREATE INDEX "InspectionFinding_inspectionId_idx" ON "InspectionFinding"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTicket_code_key" ON "MaintenanceTicket"("code");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_propertyId_status_idx" ON "MaintenanceTicket"("propertyId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_slaDueAt_idx" ON "MaintenanceTicket"("slaDueAt");

-- CreateIndex
CREATE INDEX "MaintenanceCost_ticketId_idx" ON "MaintenanceCost"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_code_key" ON "Complaint"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_ticketId_key" ON "Complaint"("ticketId");

-- CreateIndex
CREATE INDEX "Complaint_propertyId_status_idx" ON "Complaint"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Complaint_memberProfileId_idx" ON "Complaint"("memberProfileId");

-- CreateIndex
CREATE INDEX "ComplaintComment_complaintId_idx" ON "ComplaintComment"("complaintId");

