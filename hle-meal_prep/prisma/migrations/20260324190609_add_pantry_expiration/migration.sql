-- AlterTable
ALTER TABLE "PantryItem" ADD COLUMN     "expiresAt" DATE;

-- CreateIndex
CREATE INDEX "PantryItem_expiresAt_idx" ON "PantryItem"("expiresAt");
