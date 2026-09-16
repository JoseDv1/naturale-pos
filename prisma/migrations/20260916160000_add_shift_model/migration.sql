-- CreateTable
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "initialCash" DECIMAL NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "closedByUserId" TEXT,
    "expectedCash" DECIMAL,
    "actualCash" DECIMAL,
    "difference" DECIMAL,
    "totalSales" DECIMAL DEFAULT 0,
    "totalCard" DECIMAL DEFAULT 0,
    "totalTransfer" DECIMAL DEFAULT 0,
    "totalInternal" DECIMAL DEFAULT 0,
    "totalExpenses" DECIMAL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Shift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shift_userId_idx" ON "Shift"("userId");
CREATE INDEX IF NOT EXISTS "Shift_status_idx" ON "Shift"("status");
CREATE INDEX IF NOT EXISTS "Shift_openedAt_idx" ON "Shift"("openedAt");

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "shiftId" TEXT REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sale_shiftId_idx" ON "Sale"("shiftId");

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "shiftId" TEXT REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_shiftId_idx" ON "Expense"("shiftId");
