-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CafeTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentSaleId" TEXT,
    "x" REAL NOT NULL DEFAULT 0.0,
    "y" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CafeTable_currentSaleId_fkey" FOREIGN KEY ("currentSaleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CafeTable" ("createdAt", "currentSaleId", "id", "name", "status", "updatedAt") SELECT "createdAt", "currentSaleId", "id", "name", "status", "updatedAt" FROM "CafeTable";
DROP TABLE "CafeTable";
ALTER TABLE "new_CafeTable" RENAME TO "CafeTable";
CREATE UNIQUE INDEX "CafeTable_name_key" ON "CafeTable"("name");
CREATE UNIQUE INDEX "CafeTable_currentSaleId_key" ON "CafeTable"("currentSaleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
