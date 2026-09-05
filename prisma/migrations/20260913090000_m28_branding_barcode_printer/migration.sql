-- Branding + barcode + printer/telegram settings
ALTER TABLE "PosProduct" ADD COLUMN "barcode" TEXT;
ALTER TABLE "PosProduct" ADD COLUMN "sku" TEXT;
ALTER TABLE "PosProduct" ADD COLUMN "description" TEXT;
CREATE UNIQUE INDEX "PosProduct_barcode_key" ON "PosProduct"("barcode");
