-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NEEDS_REPAIR', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "MaintenanceFrequency" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'CUSTOM_DAYS');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProviderSpecialty" AS ENUM ('HVAC', 'PLUMBING', 'ELECTRICAL', 'APPLIANCE_REPAIR', 'GENERAL_CONTRACTOR', 'LANDSCAPING', 'PEST_CONTROL', 'ROOFING', 'PAINTING', 'FLOORING', 'AUTO_MECHANIC', 'AUTO_BODY', 'AUTO_DEALER', 'CLEANING', 'LOCKSMITH', 'HANDYMAN', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'SOLD', 'SCRAPPED', 'STORED');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "floor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "roomId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATE,
    "purchasePrice" DECIMAL(10,2),
    "purchasedFrom" TEXT,
    "warrantyExpires" DATE,
    "warrantyNotes" TEXT,
    "condition" "ItemCondition" NOT NULL DEFAULT 'GOOD',
    "manualUrl" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "year" INTEGER,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "vin" TEXT,
    "licensePlate" TEXT,
    "color" TEXT,
    "currentMileage" INTEGER,
    "mileageAsOf" DATE,
    "purchaseDate" DATE,
    "purchasePrice" DECIMAL(10,2),
    "purchasedFrom" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MileageEntry" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "itemId" TEXT,
    "vehicleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "MaintenanceFrequency" NOT NULL,
    "customIntervalDays" INTEGER,
    "lastCompletedDate" DATE,
    "nextDueDate" DATE,
    "estimatedCost" DECIMAL(10,2),
    "assignedTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "maintenanceScheduleId" TEXT,
    "itemId" TEXT,
    "vehicleId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completedDate" DATE NOT NULL,
    "completedBy" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'COMPLETED',
    "cost" DECIMAL(10,2),
    "mileageAtService" INTEGER,
    "partsUsed" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "itemId" TEXT,
    "vehicleId" TEXT,
    "providerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RepairStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reportedDate" DATE NOT NULL,
    "scheduledDate" DATE,
    "completedDate" DATE,
    "completedBy" TEXT,
    "laborCost" DECIMAL(10,2),
    "partsCost" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "warrantyClaimId" TEXT,
    "partsUsed" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "specialty" "ProviderSpecialty" NOT NULL DEFAULT 'OTHER',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_householdId_idx" ON "Room"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_householdId_name_key" ON "Room"("householdId", "name");

-- CreateIndex
CREATE INDEX "Item_householdId_idx" ON "Item"("householdId");

-- CreateIndex
CREATE INDEX "Item_roomId_idx" ON "Item"("roomId");

-- CreateIndex
CREATE INDEX "Vehicle_householdId_idx" ON "Vehicle"("householdId");

-- CreateIndex
CREATE INDEX "MileageEntry_vehicleId_date_idx" ON "MileageEntry"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_householdId_idx" ON "MaintenanceSchedule"("householdId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_nextDueDate_idx" ON "MaintenanceSchedule"("nextDueDate");

-- CreateIndex
CREATE INDEX "MaintenanceLog_householdId_idx" ON "MaintenanceLog"("householdId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_itemId_idx" ON "MaintenanceLog"("itemId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_vehicleId_idx" ON "MaintenanceLog"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_completedDate_idx" ON "MaintenanceLog"("completedDate");

-- CreateIndex
CREATE INDEX "Repair_householdId_idx" ON "Repair"("householdId");

-- CreateIndex
CREATE INDEX "Repair_itemId_idx" ON "Repair"("itemId");

-- CreateIndex
CREATE INDEX "Repair_vehicleId_idx" ON "Repair"("vehicleId");

-- CreateIndex
CREATE INDEX "ServiceProvider_householdId_idx" ON "ServiceProvider"("householdId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageEntry" ADD CONSTRAINT "MileageEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
