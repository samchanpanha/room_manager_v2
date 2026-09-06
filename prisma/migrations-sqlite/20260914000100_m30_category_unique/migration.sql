-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StockCategory_name_parentId_propertyId_key" ON "StockCategory"("name", "parentId", "propertyId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;