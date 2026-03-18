-- CreateTable
CREATE TABLE "FamilyRelation" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "relationType" "Relationship" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyRelation_householdId_idx" ON "FamilyRelation"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyRelation_fromMemberId_toMemberId_key" ON "FamilyRelation"("fromMemberId", "toMemberId");

-- AddForeignKey
ALTER TABLE "FamilyRelation" ADD CONSTRAINT "FamilyRelation_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyRelation" ADD CONSTRAINT "FamilyRelation_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
