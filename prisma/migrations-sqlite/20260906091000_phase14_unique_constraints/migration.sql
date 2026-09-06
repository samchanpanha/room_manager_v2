-- DropIndex
DROP INDEX "PosProduct_isActive_idx";

-- DropIndex
DROP INDEX "Supplier_name_idx";

-- CreateIndex
CREATE UNIQUE INDEX "PosProduct_name_key" ON "PosProduct"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_name_propertyId_key" ON "StockItem"("name", "propertyId");

