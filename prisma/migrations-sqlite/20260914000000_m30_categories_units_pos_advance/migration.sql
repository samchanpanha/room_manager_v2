-- CreateTable
CREATE TABLE "StockCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StockCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PosProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "category" TEXT,
    "categoryId" TEXT,
    "barcode" TEXT,
    "sku" TEXT,
    "description" TEXT,
    "stockItemId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PosProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StockCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PosProduct_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PosProduct" ("barcode", "category", "createdAt", "description", "id", "isActive", "name", "priceMinor", "sku", "stockItemId", "updatedAt") SELECT "barcode", "category", "createdAt", "description", "id", "isActive", "name", "priceMinor", "sku", "stockItemId", "updatedAt" FROM "PosProduct";
DROP TABLE "PosProduct";
ALTER TABLE "new_PosProduct" RENAME TO "PosProduct";
CREATE UNIQUE INDEX "PosProduct_name_key" ON "PosProduct"("name");
CREATE UNIQUE INDEX "PosProduct_barcode_key" ON "PosProduct"("barcode");
CREATE TABLE "new_PosSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "discountLabel" TEXT,
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
CREATE TABLE "new_StockItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryId" TEXT,
    "unit" TEXT NOT NULL,
    "qtyMilli" INTEGER NOT NULL DEFAULT 0,
    "avgCostMilli" INTEGER NOT NULL DEFAULT 0,
    "minQtyMilli" INTEGER NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "propertyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StockCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockItem" ("avgCostMilli", "category", "createdAt", "id", "isActive", "minQtyMilli", "name", "propertyId", "qtyMilli", "supplierId", "unit", "updatedAt") SELECT "avgCostMilli", "category", "createdAt", "id", "isActive", "minQtyMilli", "name", "propertyId", "qtyMilli", "supplierId", "unit", "updatedAt" FROM "StockItem";
DROP TABLE "StockItem";
ALTER TABLE "new_StockItem" RENAME TO "StockItem";
CREATE INDEX "StockItem_propertyId_categoryId_idx" ON "StockItem"("propertyId", "categoryId");
CREATE UNIQUE INDEX "StockItem_name_propertyId_key" ON "StockItem"("name", "propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockCategory_propertyId_parentId_idx" ON "StockCategory"("propertyId", "parentId");
