-- Insurance: migrate from per-member Insurance to household-level InsurancePolicy + InsurancePolicyCoverage
-- Health Profiles: migrate from 1:1 HealthProfile to 1:many HealthProfileRecord

-- Step 1: Create new InsurancePolicy table
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
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

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create InsurancePolicyCoverage junction table
CREATE TABLE "InsurancePolicyCoverage" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "relationToHolder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsurancePolicyCoverage_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create HealthProfileRecord table
CREATE TABLE "HealthProfileRecord" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CONSTRAINT "HealthProfileRecord_pkey" PRIMARY KEY ("id")
);

-- Step 4: Migrate existing Insurance data into InsurancePolicy + InsurancePolicyCoverage
-- Group by unique policy (same provider + policyNumber + householdId) to deduplicate
INSERT INTO "InsurancePolicy" (
    "id", "householdId", "providerName", "policyNumber", "groupNumber",
    "policyHolderName", "insuranceType", "phoneNumber", "website",
    "effectiveDate", "expirationDate", "deductible", "outOfPocketMax",
    "copay", "notes", "isActive", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (fm."householdId", i."providerName", i."policyNumber")
    i."id",
    fm."householdId",
    i."providerName",
    i."policyNumber",
    i."groupNumber",
    i."policyHolderName",
    i."insuranceType",
    i."phoneNumber",
    i."website",
    i."effectiveDate",
    i."expirationDate",
    i."deductible",
    i."outOfPocketMax",
    i."copay",
    i."notes",
    i."isActive",
    i."createdAt",
    i."updatedAt"
FROM "Insurance" i
JOIN "FamilyMember" fm ON fm."id" = i."familyMemberId"
ORDER BY fm."householdId", i."providerName", i."policyNumber", i."createdAt" ASC;

-- Link all family members who had the same policy (by provider + policyNumber + householdId)
INSERT INTO "InsurancePolicyCoverage" ("id", "policyId", "familyMemberId", "createdAt")
SELECT
    gen_random_uuid()::text,
    ip."id",
    i."familyMemberId",
    i."createdAt"
FROM "Insurance" i
JOIN "FamilyMember" fm ON fm."id" = i."familyMemberId"
JOIN "InsurancePolicy" ip ON ip."providerName" = i."providerName"
    AND ip."policyNumber" = i."policyNumber"
    AND ip."householdId" = fm."householdId";

-- Step 5: Migrate existing HealthProfile data into HealthProfileRecord
INSERT INTO "HealthProfileRecord" (
    "id", "familyMemberId", "recordDate", "bloodType", "heightCm", "weightKg",
    "allergies", "chronicConditions", "majorSurgeries",
    "primaryCareProvider", "preferredHospital", "medicalNotes",
    "isOrganDonor", "createdAt", "updatedAt"
)
SELECT
    "id", "familyMemberId", COALESCE("updatedAt"::date, "createdAt"::date),
    "bloodType", "heightCm", "weightKg",
    "allergies", "chronicConditions", "majorSurgeries",
    "primaryCareProvider", "preferredHospital", "medicalNotes",
    "isOrganDonor", "createdAt", "updatedAt"
FROM "HealthProfile";

-- Step 6: Drop old tables
DROP TABLE "Insurance";
DROP TABLE "HealthProfile";

-- Step 7: Indexes and constraints for InsurancePolicy
CREATE INDEX "InsurancePolicy_householdId_idx" ON "InsurancePolicy"("householdId");

-- Step 8: Indexes and constraints for InsurancePolicyCoverage
CREATE UNIQUE INDEX "InsurancePolicyCoverage_policyId_familyMemberId_key" ON "InsurancePolicyCoverage"("policyId", "familyMemberId");
CREATE INDEX "InsurancePolicyCoverage_familyMemberId_idx" ON "InsurancePolicyCoverage"("familyMemberId");
CREATE INDEX "InsurancePolicyCoverage_policyId_idx" ON "InsurancePolicyCoverage"("policyId");

ALTER TABLE "InsurancePolicyCoverage" ADD CONSTRAINT "InsurancePolicyCoverage_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicyCoverage" ADD CONSTRAINT "InsurancePolicyCoverage_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Indexes and constraints for HealthProfileRecord
CREATE INDEX "HealthProfileRecord_familyMemberId_idx" ON "HealthProfileRecord"("familyMemberId");
CREATE INDEX "HealthProfileRecord_familyMemberId_recordDate_idx" ON "HealthProfileRecord"("familyMemberId", "recordDate" DESC);

ALTER TABLE "HealthProfileRecord" ADD CONSTRAINT "HealthProfileRecord_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
