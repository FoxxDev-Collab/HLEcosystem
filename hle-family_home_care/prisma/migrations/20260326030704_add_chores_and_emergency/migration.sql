-- CreateEnum
CREATE TYPE "ChoreFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'CUSTOM_DAYS');

-- CreateEnum
CREATE TYPE "RotationMode" AS ENUM ('NONE', 'ROUND_ROBIN', 'WEEKLY_ROTATION');

-- CreateEnum
CREATE TYPE "ChoreCompletionStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'MISSED');

-- CreateEnum
CREATE TYPE "EmergencyContactType" AS ENUM ('NEIGHBOR', 'UTILITY', 'LOCAL_SERVICE', 'INSURANCE', 'GOVERNMENT', 'VETERINARIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyPlanType" AS ENUM ('FIRE', 'FLOOD', 'EARTHQUAKE', 'TORNADO', 'HURRICANE', 'POWER_OUTAGE', 'MEDICAL', 'INTRUDER', 'EVACUATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SupplyCondition" AS ENUM ('GOOD', 'LOW', 'EXPIRED', 'NEEDS_REPLACEMENT');

-- CreateTable
CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "roomId" TEXT,
    "frequency" "ChoreFrequency" NOT NULL DEFAULT 'WEEKLY',
    "customIntervalDays" INTEGER,
    "rotationMode" "RotationMode" NOT NULL DEFAULT 'NONE',
    "pointValue" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreAssignment" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assigneeName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreCompletion" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "completedByName" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "completedDate" DATE,
    "status" "ChoreCompletionStatus" NOT NULL DEFAULT 'PENDING',
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreReward" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChoreReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "redeemedById" TEXT NOT NULL,
    "redeemedByName" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmergencyContactType" NOT NULL DEFAULT 'OTHER',
    "company" TEXT,
    "phone" TEXT,
    "phoneAlt" TEXT,
    "email" TEXT,
    "address" TEXT,
    "accountNumber" TEXT,
    "availableHours" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyPlan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "EmergencyPlanType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingPoint" TEXT,
    "evacuationRoute" TEXT,
    "procedures" TEXT,
    "lastReviewed" DATE,
    "reviewFrequencyMonths" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencySupplyKit" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "roomId" TEXT,
    "description" TEXT,
    "lastChecked" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencySupplyKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencySupply" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT,
    "expirationDate" DATE,
    "condition" "SupplyCondition" NOT NULL DEFAULT 'GOOD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencySupply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityShutoff" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "utilityType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "roomId" TEXT,
    "procedure" TEXT,
    "toolsNeeded" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityShutoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantDocumentLocation" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "category" TEXT,
    "physicalLocation" TEXT,
    "digitalLocation" TEXT,
    "accountNumber" TEXT,
    "policyNumber" TEXT,
    "expirationDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportantDocumentLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chore_householdId_idx" ON "Chore"("householdId");

-- CreateIndex
CREATE INDEX "Chore_roomId_idx" ON "Chore"("roomId");

-- CreateIndex
CREATE INDEX "ChoreAssignment_assigneeId_idx" ON "ChoreAssignment"("assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreAssignment_choreId_assigneeId_key" ON "ChoreAssignment"("choreId", "assigneeId");

-- CreateIndex
CREATE INDEX "ChoreCompletion_householdId_idx" ON "ChoreCompletion"("householdId");

-- CreateIndex
CREATE INDEX "ChoreCompletion_choreId_idx" ON "ChoreCompletion"("choreId");

-- CreateIndex
CREATE INDEX "ChoreCompletion_completedById_idx" ON "ChoreCompletion"("completedById");

-- CreateIndex
CREATE INDEX "ChoreCompletion_dueDate_idx" ON "ChoreCompletion"("dueDate");

-- CreateIndex
CREATE INDEX "ChoreReward_householdId_idx" ON "ChoreReward"("householdId");

-- CreateIndex
CREATE INDEX "RewardRedemption_householdId_idx" ON "RewardRedemption"("householdId");

-- CreateIndex
CREATE INDEX "RewardRedemption_redeemedById_idx" ON "RewardRedemption"("redeemedById");

-- CreateIndex
CREATE INDEX "EmergencyContact_householdId_idx" ON "EmergencyContact"("householdId");

-- CreateIndex
CREATE INDEX "EmergencyContact_type_idx" ON "EmergencyContact"("type");

-- CreateIndex
CREATE INDEX "EmergencyPlan_householdId_idx" ON "EmergencyPlan"("householdId");

-- CreateIndex
CREATE INDEX "EmergencySupplyKit_householdId_idx" ON "EmergencySupplyKit"("householdId");

-- CreateIndex
CREATE INDEX "EmergencySupply_kitId_idx" ON "EmergencySupply"("kitId");

-- CreateIndex
CREATE INDEX "EmergencySupply_expirationDate_idx" ON "EmergencySupply"("expirationDate");

-- CreateIndex
CREATE INDEX "UtilityShutoff_householdId_idx" ON "UtilityShutoff"("householdId");

-- CreateIndex
CREATE INDEX "ImportantDocumentLocation_householdId_idx" ON "ImportantDocumentLocation"("householdId");

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreAssignment" ADD CONSTRAINT "ChoreAssignment_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreCompletion" ADD CONSTRAINT "ChoreCompletion_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "ChoreReward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencySupplyKit" ADD CONSTRAINT "EmergencySupplyKit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencySupply" ADD CONSTRAINT "EmergencySupply_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "EmergencySupplyKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityShutoff" ADD CONSTRAINT "UtilityShutoff_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
