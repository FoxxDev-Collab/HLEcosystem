-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN "familyhubMemberId" TEXT;

-- CreateIndex
CREATE INDEX "FamilyMember_familyhubMemberId_idx" ON "FamilyMember"("familyhubMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_householdId_familyhubMemberId_key" ON "FamilyMember"("householdId", "familyhubMemberId");
