-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN     "linkedUserId" TEXT,
ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_householdId_linkedUserId_key" ON "FamilyMember"("householdId", "linkedUserId");
