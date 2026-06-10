-- Family Health module: tracked members, health profiles, appointments,
-- medications, vaccinations, providers, insurance, medical expenses, visit
-- summaries, workout tracking, pet health. Ported from
-- hle-family_health/prisma/schema.prisma.
--
-- Differences from legacy: UUID PKs; real FKs now that everything lives in one
-- database. Legacy health kept its own snapshot "FamilyMember" table linked to
-- familyhub."FamilyMember" via "familyhubMemberId" and family_manager users
-- via "linkedUserId". Here that table is renamed "HealthMember" (the hub
-- module already owns "FamilyMember" in 0003) and the link columns become
-- proper FKs: "familyMemberId" -> hub "FamilyMember", "linkedUserId" ->
-- "User". Child tables reference "HealthMember" via "memberId" and scope
-- through it (like "Address" -> "FamilyMember" in 0003). Legacy
-- "EmergencyContact" is renamed "HealthEmergencyContact" (home care owns
-- "EmergencyContact" in 0004).

CREATE TYPE "BloodType" AS ENUM (
  'A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE',
  'AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE','UNKNOWN'
);
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED');
CREATE TYPE "AppointmentType" AS ENUM (
  'ANNUAL_CHECKUP','FOLLOW_UP','SPECIALIST','PROCEDURE','LAB_WORK',
  'DENTAL','VISION','URGENT_CARE','TELEHEALTH','OTHER'
);
CREATE TYPE "ProviderType" AS ENUM (
  'DOCTOR','DENTIST','OPTOMETRIST','SPECIALIST','HOSPITAL','LAB',
  'PHARMACY','THERAPIST','CHIROPRACTOR','VETERINARIAN','OTHER'
);
CREATE TYPE "InsuranceType" AS ENUM ('MEDICAL','DENTAL','VISION','PRESCRIPTION','SUPPLEMENTAL','OTHER');
CREATE TYPE "VisitType" AS ENUM ('IN_PERSON','TELEHEALTH','EMERGENCY','HOSPITAL','URGENT_CARE');
CREATE TYPE "SetType" AS ENUM ('NORMAL','WARMUP','FAILURE','DROPSET');
CREATE TYPE "ExpenseCategory" AS ENUM (
  'MEDICAL_EQUIPMENT','VISION','DENTAL','SUPPLIES','OVER_THE_COUNTER',
  'PRESCRIPTION','COPAY','LAB_WORK','THERAPY','OTHER'
);
CREATE TYPE "Species" AS ENUM ('DOG','CAT','BIRD','FISH','REPTILE','SMALL_MAMMAL','HORSE','OTHER');
CREATE TYPE "PetAppointmentType" AS ENUM (
  'WELLNESS_EXAM','VACCINATION','DENTAL','SURGERY','EMERGENCY',
  'GROOMING','LAB_WORK','FOLLOW_UP','OTHER'
);
CREATE TYPE "PetAppointmentStatus" AS ENUM ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED');
CREATE TYPE "PetInsuranceType" AS ENUM ('ACCIDENT_ONLY','ACCIDENT_AND_ILLNESS','WELLNESS','COMPREHENSIVE','OTHER');

-- People with health tracking enabled. Opt-in snapshot of a hub FamilyMember
-- (legacy "enable health tracking" flow); name/DOB/relationship are synced
-- copies so health pages render without joining hub on every query.
CREATE TABLE "HealthMember" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId" UUID REFERENCES "FamilyMember"("id") ON DELETE SET NULL,
  "linkedUserId"   UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "firstName"      TEXT NOT NULL,
  "lastName"       TEXT NOT NULL,
  "dateOfBirth"    DATE,
  "relationship"   TEXT,
  "gender"         TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "familyMemberId"),
  UNIQUE ("householdId", "linkedUserId")
);
CREATE INDEX "HealthMember_householdId_idx" ON "HealthMember" ("householdId");
CREATE INDEX "HealthMember_familyMemberId_idx" ON "HealthMember" ("familyMemberId");
CREATE INDEX "HealthMember_linkedUserId_idx" ON "HealthMember" ("linkedUserId");

-- Point-in-time health profile snapshots (latest record per member is the
-- "current" profile; history preserved).
CREATE TABLE "HealthProfileRecord" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"            UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "recordDate"          DATE NOT NULL DEFAULT CURRENT_DATE,
  "bloodType"           "BloodType" NOT NULL DEFAULT 'UNKNOWN',
  "heightCm"            NUMERIC(5,2),
  "weightKg"            NUMERIC(5,2),
  "allergies"           TEXT[] NOT NULL DEFAULT '{}',
  "chronicConditions"   TEXT[] NOT NULL DEFAULT '{}',
  "majorSurgeries"      TEXT[] NOT NULL DEFAULT '{}',
  "primaryCareProvider" TEXT,
  "preferredHospital"   TEXT,
  "medicalNotes"        TEXT,
  "isOrganDonor"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "HealthProfileRecord_memberId_idx" ON "HealthProfileRecord" ("memberId");
CREATE INDEX "HealthProfileRecord_memberId_recordDate_idx" ON "HealthProfileRecord" ("memberId", "recordDate" DESC);

-- Medical providers (doctors, dentists, labs, pharmacies, vets...). Distinct
-- from home care's "ServiceProvider" (contractors) in 0004.
CREATE TABLE "Provider" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"            UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"                   TEXT NOT NULL,
  "specialty"              TEXT,
  "type"                   "ProviderType" NOT NULL DEFAULT 'DOCTOR',
  "address"                TEXT,
  "phoneNumber"            TEXT,
  "faxNumber"              TEXT,
  "email"                  TEXT,
  "website"                TEXT,
  "portalUrl"              TEXT,
  "preferredContactMethod" TEXT,
  "notes"                  TEXT,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Provider_householdId_idx" ON "Provider" ("householdId");

CREATE TABLE "Appointment" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"            UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "providerId"          UUID REFERENCES "Provider"("id") ON DELETE SET NULL,
  "appointmentDateTime" TIMESTAMPTZ NOT NULL,
  "durationMinutes"     INT NOT NULL DEFAULT 30,
  "appointmentType"     "AppointmentType" NOT NULL DEFAULT 'OTHER',
  "status"              "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "location"            TEXT,
  "reasonForVisit"      TEXT,
  "preAppointmentNotes" TEXT,
  "reminderSent"        BOOLEAN NOT NULL DEFAULT false,
  "reminderSentAt"      TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Appointment_memberId_idx" ON "Appointment" ("memberId");

CREATE TABLE "Medication" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"         UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "medicationName"   TEXT NOT NULL,
  "dosage"           TEXT,
  "frequency"        TEXT,
  "startDate"        DATE,
  "endDate"          DATE,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "prescribedBy"     TEXT,
  "pharmacy"         TEXT,
  "lastRefillDate"   DATE,
  "nextRefillDate"   DATE,
  "refillsRemaining" INT,
  "purpose"          TEXT,
  "sideEffects"      TEXT,
  "notes"            TEXT,
  "costPerRefill"    NUMERIC(10,2),
  "copay"            NUMERIC(10,2),
  "paidFromHsa"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Medication_memberId_idx" ON "Medication" ("memberId");

CREATE TABLE "Vaccination" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"         UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "vaccineName"      TEXT NOT NULL,
  "doseNumber"       TEXT,
  "dateAdministered" DATE NOT NULL,
  "nextDoseDate"     DATE,
  "administeredBy"   TEXT,
  "lotNumber"        TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Vaccination_memberId_idx" ON "Vaccination" ("memberId");

-- Renamed from legacy "EmergencyContact" — home care owns that name (0004).
CREATE TABLE "HealthEmergencyContact" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"       UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "relationship"   TEXT NOT NULL,
  "phoneNumber"    TEXT NOT NULL,
  "alternatePhone" TEXT,
  "email"          TEXT,
  "address"        TEXT,
  "priority"       INT NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "HealthEmergencyContact_memberId_idx" ON "HealthEmergencyContact" ("memberId");

CREATE TABLE "InsurancePolicy" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"      UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "providerName"     TEXT NOT NULL,
  "policyNumber"     TEXT NOT NULL,
  "groupNumber"      TEXT,
  "policyHolderName" TEXT,
  "insuranceType"    "InsuranceType" NOT NULL DEFAULT 'MEDICAL',
  "phoneNumber"      TEXT,
  "website"          TEXT,
  "effectiveDate"    DATE,
  "expirationDate"   DATE,
  "deductible"       NUMERIC(10,2),
  "outOfPocketMax"   NUMERIC(10,2),
  "copay"            NUMERIC(10,2),
  "notes"            TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "InsurancePolicy_householdId_idx" ON "InsurancePolicy" ("householdId");

CREATE TABLE "InsurancePolicyCoverage" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "policyId"         UUID NOT NULL REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE,
  "memberId"         UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "subscriberId"     TEXT,
  "relationToHolder" TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("policyId", "memberId")
);
CREATE INDEX "InsurancePolicyCoverage_memberId_idx" ON "InsurancePolicyCoverage" ("memberId");

CREATE TABLE "MedicalExpense" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"               UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "description"            TEXT NOT NULL,
  "category"               "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
  "amount"                 NUMERIC(10,2) NOT NULL,
  "expenseDate"            DATE NOT NULL,
  "paidFromHsa"            BOOLEAN NOT NULL DEFAULT false,
  "insuranceReimbursement" NUMERIC(10,2),
  "notes"                  TEXT,
  "receiptPath"            TEXT,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MedicalExpense_memberId_idx" ON "MedicalExpense" ("memberId");

CREATE TABLE "VisitSummary" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "appointmentId"        UUID UNIQUE REFERENCES "Appointment"("id") ON DELETE SET NULL,
  "memberId"             UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "providerId"           UUID REFERENCES "Provider"("id") ON DELETE SET NULL,
  "visitDate"            TIMESTAMPTZ NOT NULL,
  "visitType"            "VisitType" NOT NULL DEFAULT 'IN_PERSON',
  "chiefComplaint"       TEXT,
  "diagnosis"            TEXT,
  "treatmentProvided"    TEXT,
  "prescriptionsWritten" TEXT,
  "labTestsOrdered"      TEXT,
  "followUpInstructions" TEXT,
  "nextVisitRecommended" TIMESTAMPTZ,
  "attachedDocuments"    TEXT,
  "notes"                TEXT,
  "billedAmount"         NUMERIC(10,2),
  "insurancePaid"        NUMERIC(10,2),
  "outOfPocketCost"      NUMERIC(10,2),
  "paidFromHsa"          BOOLEAN NOT NULL DEFAULT false,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "VisitSummary_memberId_idx" ON "VisitSummary" ("memberId");

CREATE TABLE "Workout" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "memberId"    UUID NOT NULL REFERENCES "HealthMember"("id") ON DELETE CASCADE,
  "title"       TEXT NOT NULL,
  "startTime"   TIMESTAMPTZ NOT NULL,
  "endTime"     TIMESTAMPTZ,
  "description" TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Workout_memberId_idx" ON "Workout" ("memberId");

CREATE TABLE "WorkoutExercise" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workoutId"       UUID NOT NULL REFERENCES "Workout"("id") ON DELETE CASCADE,
  "exerciseName"    TEXT NOT NULL,
  "orderIndex"      INT NOT NULL DEFAULT 0,
  "supersetGroupId" INT,
  "notes"           TEXT
);
CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise" ("workoutId");

CREATE TABLE "ExerciseSet" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workoutExerciseId" UUID NOT NULL REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE,
  "setIndex"          INT NOT NULL DEFAULT 0,
  "setType"           "SetType" NOT NULL DEFAULT 'NORMAL',
  "weightLbs"         NUMERIC(7,2),
  "reps"              INT,
  "distanceMiles"     NUMERIC(7,2),
  "durationSeconds"   INT,
  "rpe"               NUMERIC(3,1)
);
CREATE INDEX "ExerciseSet_workoutExerciseId_idx" ON "ExerciseSet" ("workoutExerciseId");

CREATE TABLE "Pet" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"  UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"         TEXT NOT NULL,
  "species"      "Species" NOT NULL,
  "breed"        TEXT,
  "color"        TEXT,
  "weightLbs"    NUMERIC(6,2),
  "dateOfBirth"  DATE,
  "gender"       TEXT,
  "microchipId"  TEXT,
  "adoptionDate" DATE,
  "photoUrl"     TEXT,
  "notes"        TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Pet_householdId_idx" ON "Pet" ("householdId");

CREATE TABLE "PetVaccination" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "petId"            UUID NOT NULL REFERENCES "Pet"("id") ON DELETE CASCADE,
  "vaccineName"      TEXT NOT NULL,
  "doseNumber"       TEXT,
  "dateAdministered" DATE NOT NULL,
  "nextDueDate"      DATE,
  "administeredBy"   TEXT,
  "providerId"       UUID REFERENCES "Provider"("id") ON DELETE SET NULL,
  "lotNumber"        TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PetVaccination_petId_idx" ON "PetVaccination" ("petId");

CREATE TABLE "PetMedication" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "petId"          UUID NOT NULL REFERENCES "Pet"("id") ON DELETE CASCADE,
  "medicationName" TEXT NOT NULL,
  "dosage"         TEXT,
  "frequency"      TEXT,
  "startDate"      DATE,
  "endDate"        DATE,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "prescribedBy"   TEXT,
  "pharmacy"       TEXT,
  "nextRefillDate" DATE,
  "purpose"        TEXT,
  "costPerRefill"  NUMERIC(10,2),
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PetMedication_petId_idx" ON "PetMedication" ("petId");

CREATE TABLE "PetAppointment" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "petId"               UUID NOT NULL REFERENCES "Pet"("id") ON DELETE CASCADE,
  "providerId"          UUID REFERENCES "Provider"("id") ON DELETE SET NULL,
  "appointmentDateTime" TIMESTAMPTZ NOT NULL,
  "durationMinutes"     INT NOT NULL DEFAULT 30,
  "appointmentType"     "PetAppointmentType" NOT NULL DEFAULT 'OTHER',
  "status"              "PetAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "location"            TEXT,
  "reasonForVisit"      TEXT,
  "diagnosis"           TEXT,
  "treatmentNotes"      TEXT,
  "cost"                NUMERIC(10,2),
  "notes"               TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PetAppointment_petId_idx" ON "PetAppointment" ("petId");

CREATE TABLE "PetCondition" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "petId"         UUID NOT NULL REFERENCES "Pet"("id") ON DELETE CASCADE,
  "conditionName" TEXT NOT NULL,
  "diagnosedDate" DATE,
  "resolvedDate"  DATE,
  "isOngoing"     BOOLEAN NOT NULL DEFAULT true,
  "severity"      TEXT,
  "treatment"     TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PetCondition_petId_idx" ON "PetCondition" ("petId");

CREATE TABLE "PetInsurance" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "petId"            UUID NOT NULL REFERENCES "Pet"("id") ON DELETE CASCADE,
  "providerName"     TEXT NOT NULL,
  "policyNumber"     TEXT NOT NULL,
  "insuranceType"    "PetInsuranceType" NOT NULL DEFAULT 'COMPREHENSIVE',
  "monthlyPremium"   NUMERIC(10,2),
  "deductible"       NUMERIC(10,2),
  "annualLimit"      NUMERIC(10,2),
  "reimbursementPct" INT,
  "effectiveDate"    DATE,
  "expirationDate"   DATE,
  "phoneNumber"      TEXT,
  "website"          TEXT,
  "notes"            TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PetInsurance_petId_idx" ON "PetInsurance" ("petId");
