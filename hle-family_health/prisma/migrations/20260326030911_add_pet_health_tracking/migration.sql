-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT', 'BIRD', 'FISH', 'REPTILE', 'SMALL_MAMMAL', 'HORSE', 'OTHER');

-- CreateEnum
CREATE TYPE "PetAppointmentType" AS ENUM ('WELLNESS_EXAM', 'VACCINATION', 'DENTAL', 'SURGERY', 'EMERGENCY', 'GROOMING', 'LAB_WORK', 'FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "PetAppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "PetInsuranceType" AS ENUM ('ACCIDENT_ONLY', 'ACCIDENT_AND_ILLNESS', 'WELLNESS', 'COMPREHENSIVE', 'OTHER');

-- AlterEnum
ALTER TYPE "ProviderType" ADD VALUE 'VETERINARIAN';

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "color" TEXT,
    "weightLbs" DECIMAL(6,2),
    "dateOfBirth" DATE,
    "gender" TEXT,
    "microchipId" TEXT,
    "adoptionDate" DATE,
    "photoUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetVaccination" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" TEXT,
    "dateAdministered" DATE NOT NULL,
    "nextDueDate" DATE,
    "administeredBy" TEXT,
    "providerId" TEXT,
    "lotNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetVaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetMedication" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "prescribedBy" TEXT,
    "pharmacy" TEXT,
    "nextRefillDate" DATE,
    "purpose" TEXT,
    "costPerRefill" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetMedication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetAppointment" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "providerId" TEXT,
    "appointmentDateTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "appointmentType" "PetAppointmentType" NOT NULL DEFAULT 'OTHER',
    "status" "PetAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "reasonForVisit" TEXT,
    "diagnosis" TEXT,
    "treatmentNotes" TEXT,
    "cost" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetCondition" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "conditionName" TEXT NOT NULL,
    "diagnosedDate" DATE,
    "resolvedDate" DATE,
    "isOngoing" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetInsurance" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "insuranceType" "PetInsuranceType" NOT NULL DEFAULT 'COMPREHENSIVE',
    "monthlyPremium" DECIMAL(10,2),
    "deductible" DECIMAL(10,2),
    "annualLimit" DECIMAL(10,2),
    "reimbursementPct" INTEGER,
    "effectiveDate" DATE,
    "expirationDate" DATE,
    "phoneNumber" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_householdId_idx" ON "Pet"("householdId");

-- CreateIndex
CREATE INDEX "PetVaccination_petId_idx" ON "PetVaccination"("petId");

-- CreateIndex
CREATE INDEX "PetMedication_petId_idx" ON "PetMedication"("petId");

-- CreateIndex
CREATE INDEX "PetAppointment_petId_idx" ON "PetAppointment"("petId");

-- CreateIndex
CREATE INDEX "PetCondition_petId_idx" ON "PetCondition"("petId");

-- CreateIndex
CREATE INDEX "PetInsurance_petId_idx" ON "PetInsurance"("petId");

-- AddForeignKey
ALTER TABLE "PetVaccination" ADD CONSTRAINT "PetVaccination_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetVaccination" ADD CONSTRAINT "PetVaccination_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetMedication" ADD CONSTRAINT "PetMedication_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetAppointment" ADD CONSTRAINT "PetAppointment_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetAppointment" ADD CONSTRAINT "PetAppointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetCondition" ADD CONSTRAINT "PetCondition_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetInsurance" ADD CONSTRAINT "PetInsurance_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
