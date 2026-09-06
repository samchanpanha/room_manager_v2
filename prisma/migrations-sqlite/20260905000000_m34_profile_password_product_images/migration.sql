-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PosProduct" ADD COLUMN "imageDocId" TEXT;

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN "imageDocId" TEXT;