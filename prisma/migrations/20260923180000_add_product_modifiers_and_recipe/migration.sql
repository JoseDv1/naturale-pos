-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL DEFAULT 0,
    "cost" DECIMAL NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductModifier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductModifier_productId_idx" ON "ProductModifier"("productId");
CREATE INDEX IF NOT EXISTS "ProductModifier_active_idx" ON "ProductModifier"("active");

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN "notes" TEXT;
