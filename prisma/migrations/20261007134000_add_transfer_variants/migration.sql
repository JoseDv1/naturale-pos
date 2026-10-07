-- AlterTable
ALTER TABLE "ProductTransfer" ADD COLUMN "variantId" TEXT REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductTransfer" ADD COLUMN "targetVariantId" TEXT REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductTransfer_variantId_idx" ON "ProductTransfer"("variantId");
CREATE INDEX IF NOT EXISTS "ProductTransfer_targetVariantId_idx" ON "ProductTransfer"("targetVariantId");
