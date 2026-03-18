-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('Spouse', 'Partner', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Grandchild', 'AuntUncle', 'NieceNephew', 'Cousin', 'InLaw', 'StepParent', 'StepChild', 'StepSibling', 'Godparent', 'Godchild', 'Friend', 'Other');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('NONE', 'PHONE', 'EMAIL', 'TEXT');

-- CreateEnum
CREATE TYPE "ImportantDateType" AS ENUM ('BIRTHDAY', 'ANNIVERSARY', 'GRADUATION', 'MEMORIAL', 'HOLIDAY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('ONCE', 'ANNUAL');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('IDEA', 'PURCHASED', 'WRAPPED', 'GIVEN');

-- CreateEnum
CREATE TYPE "GiftIdeaStatus" AS ENUM ('ACTIVE', 'PURCHASED', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "GiftIdeaPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "linkedUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickname" TEXT,
    "relationship" "Relationship" NOT NULL,
    "relationshipNotes" TEXT,
    "birthday" DATE,
    "anniversary" DATE,
    "phone" TEXT,
    "email" TEXT,
    "preferredContactMethod" "PreferredContactMethod" NOT NULL DEFAULT 'NONE',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "profilePhotoUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "includeInHolidayCards" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantDate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "familyMemberId" TEXT,
    "label" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "ImportantDateType" NOT NULL,
    "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'ANNUAL',
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 14,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportantDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "giftDate" DATE,
    "occasion" TEXT,
    "status" "GiftStatus" NOT NULL DEFAULT 'IDEA',
    "estimatedCost" DECIMAL(10,2),
    "actualCost" DECIMAL(10,2),
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftIdea" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "familyMemberId" TEXT,
    "idea" TEXT NOT NULL,
    "dateCaptured" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "priority" "GiftIdeaPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GiftIdeaStatus" NOT NULL DEFAULT 'ACTIVE',
    "estimatedCost" DECIMAL(10,2),
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedHousehold" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "linkedHouseholdId" TEXT NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedHousehold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMember_householdId_idx" ON "FamilyMember"("householdId");

-- CreateIndex
CREATE INDEX "FamilyMember_linkedUserId_idx" ON "FamilyMember"("linkedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_householdId_linkedUserId_key" ON "FamilyMember"("householdId", "linkedUserId");

-- CreateIndex
CREATE INDEX "ImportantDate_householdId_idx" ON "ImportantDate"("householdId");

-- CreateIndex
CREATE INDEX "ImportantDate_familyMemberId_idx" ON "ImportantDate"("familyMemberId");

-- CreateIndex
CREATE INDEX "Gift_householdId_idx" ON "Gift"("householdId");

-- CreateIndex
CREATE INDEX "Gift_familyMemberId_idx" ON "Gift"("familyMemberId");

-- CreateIndex
CREATE INDEX "GiftIdea_householdId_idx" ON "GiftIdea"("householdId");

-- CreateIndex
CREATE INDEX "GiftIdea_familyMemberId_idx" ON "GiftIdea"("familyMemberId");

-- CreateIndex
CREATE INDEX "LinkedHousehold_householdId_idx" ON "LinkedHousehold"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedHousehold_householdId_linkedHouseholdId_key" ON "LinkedHousehold"("householdId", "linkedHouseholdId");

-- AddForeignKey
ALTER TABLE "ImportantDate" ADD CONSTRAINT "ImportantDate_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdea" ADD CONSTRAINT "GiftIdea_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
