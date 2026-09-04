-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PosSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "memberProfileId" TEXT,
    "invoiceId" TEXT,
    "ref" TEXT,
    "receiptDocId" TEXT,
    "soldById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosSale_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PosSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PosSale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PosSale_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PosSale_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PosSale" ("code", "createdAt", "id", "invoiceId", "memberProfileId", "method", "propertyId", "receiptDocId", "ref", "sessionId", "soldById", "totalMinor") SELECT "code", "createdAt", "id", "invoiceId", "memberProfileId", "method", "propertyId", "receiptDocId", "ref", "sessionId", "soldById", "totalMinor" FROM "PosSale";
DROP TABLE "PosSale";
ALTER TABLE "new_PosSale" RENAME TO "PosSale";
CREATE UNIQUE INDEX "PosSale_code_key" ON "PosSale"("code");
CREATE UNIQUE INDEX "PosSale_invoiceId_key" ON "PosSale"("invoiceId");
CREATE INDEX "PosSale_sessionId_idx" ON "PosSale"("sessionId");
CREATE INDEX "PosSale_propertyId_createdAt_idx" ON "PosSale"("propertyId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

