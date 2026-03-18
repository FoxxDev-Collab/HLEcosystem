-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('ANNUAL_CHECKUP', 'FOLLOW_UP', 'SPECIALIST', 'PROCEDURE', 'LAB_WORK', 'DENTAL', 'VISION', 'URGENT_CARE', 'TELEHEALTH', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('DOCTOR', 'DENTIST', 'OPTOMETRIST', 'SPECIALIST', 'HOSPITAL', 'LAB', 'PHARMACY', 'THERAPIST', 'CHIROPRACTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('MEDICAL', 'DENTAL', 'VISION', 'PRESCRIPTION', 'SUPPLEMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('IN_PERSON', 'TELEHEALTH', 'EMERGENCY', 'HOSPITAL', 'URGENT_CARE');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('NORMAL', 'WARMUP', 'FAILURE', 'DROPSET');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MEDICAL_EQUIPMENT', 'VISION', 'DENTAL', 'SUPPLIES', 'OVER_THE_COUNTER', 'PRESCRIPTION', 'COPAY', 'LAB_WORK', 'THERAPY', 'OTHER');

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "relationship" TEXT,
    "gender" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthProfile" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "bloodType" "BloodType" NOT NULL DEFAULT 'UNKNOWN',
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chronicConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "majorSurgeries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryCareProvider" TEXT,
    "preferredHospital" TEXT,
    "medicalNotes" TEXT,
    "isOrganDonor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "providerId" TEXT,
    "appointmentDateTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "appointmentType" "AppointmentType" NOT NULL DEFAULT 'OTHER',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "reasonForVisit" TEXT,
    "preAppointmentNotes" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "prescribedBy" TEXT,
    "pharmacy" TEXT,
    "lastRefillDate" DATE,
    "nextRefillDate" DATE,
    "refillsRemaining" INTEGER,
    "purpose" TEXT,
    "sideEffects" TEXT,
    "notes" TEXT,
    "costPerRefill" DECIMAL(10,2),
    "copay" DECIMAL(10,2),
    "paidFromHsa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" TEXT,
    "dateAdministered" DATE NOT NULL,
    "nextDoseDate" DATE,
    "administeredBy" TEXT,
    "lotNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insurance" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "groupNumber" TEXT,
    "policyHolderName" TEXT,
    "insuranceType" "InsuranceType" NOT NULL DEFAULT 'MEDICAL',
    "phoneNumber" TEXT,
    "website" TEXT,
    "effectiveDate" DATE,
    "expirationDate" DATE,
    "deductible" DECIMAL(10,2),
    "outOfPocketMax" DECIMAL(10,2),
    "copay" DECIMAL(10,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "type" "ProviderType" NOT NULL DEFAULT 'DOCTOR',
    "address" TEXT,
    "phoneNumber" TEXT,
    "faxNumber" TEXT,
    "email" TEXT,
    "website" TEXT,
    "portalUrl" TEXT,
    "preferredContactMethod" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalExpense" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(10,2) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "paidFromHsa" BOOLEAN NOT NULL DEFAULT false,
    "insuranceReimbursement" DECIMAL(10,2),
    "notes" TEXT,
    "receiptPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitSummary" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "familyMemberId" TEXT NOT NULL,
    "providerId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitType" "VisitType" NOT NULL DEFAULT 'IN_PERSON',
    "chiefComplaint" TEXT,
    "diagnosis" TEXT,
    "treatmentProvided" TEXT,
    "prescriptionsWritten" TEXT,
    "labTestsOrdered" TEXT,
    "followUpInstructions" TEXT,
    "nextVisitRecommended" TIMESTAMP(3),
    "attachedDocuments" TEXT,
    "notes" TEXT,
    "billedAmount" DECIMAL(10,2),
    "insurancePaid" DECIMAL(10,2),
    "outOfPocketCost" DECIMAL(10,2),
    "paidFromHsa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "supersetGroupId" INTEGER,
    "notes" TEXT,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" TEXT NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL DEFAULT 0,
    "setType" "SetType" NOT NULL DEFAULT 'NORMAL',
    "weightLbs" DECIMAL(7,2),
    "reps" INTEGER,
    "distanceMiles" DECIMAL(7,2),
    "durationSeconds" INTEGER,
    "rpe" DECIMAL(3,1),

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthProfile_familyMemberId_key" ON "HealthProfile"("familyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitSummary_appointmentId_key" ON "VisitSummary"("appointmentId");

-- AddForeignKey
ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExpense" ADD CONSTRAINT "MedicalExpense_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
