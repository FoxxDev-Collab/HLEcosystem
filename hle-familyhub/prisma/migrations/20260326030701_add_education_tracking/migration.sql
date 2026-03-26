-- CreateEnum
CREATE TYPE "DegreeType" AS ENUM ('HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'CERTIFICATE', 'DIPLOMA', 'GED', 'TRADE', 'OTHER');

-- CreateEnum
CREATE TYPE "EducationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "GradeTerm" AS ENUM ('QUARTER_1', 'QUARTER_2', 'QUARTER_3', 'QUARTER_4', 'SEMESTER_1', 'SEMESTER_2', 'TRIMESTER_1', 'TRIMESTER_2', 'TRIMESTER_3', 'SUMMER', 'FULL_YEAR');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('SPORTS', 'ARTS', 'MUSIC', 'ACADEMIC', 'VOLUNTEER', 'CLUB', 'RELIGIOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING', 'REVOKED');

-- CreateTable
CREATE TABLE "EducationEntry" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degreeType" "DegreeType",
    "fieldOfStudy" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "graduationDate" DATE,
    "status" "EducationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "gpa" DECIMAL(4,2),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeReport" (
    "id" TEXT NOT NULL,
    "educationEntryId" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "term" "GradeTerm" NOT NULL,
    "reportDate" DATE,
    "overallGpa" DECIMAL(4,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL,
    "gradeReportId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "percentage" DECIMAL(5,2),
    "credits" DECIMAL(4,1),
    "teacher" TEXT,
    "notes" TEXT,

    CONSTRAINT "GradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL DEFAULT 'OTHER',
    "organization" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "schedule" TEXT,
    "cost" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "activityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dateEarned" DATE,
    "issuer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT,
    "credentialId" TEXT,
    "issueDate" DATE,
    "expirationDate" DATE,
    "status" "CertificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewalCost" DECIMAL(10,2),
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EducationEntry_familyMemberId_idx" ON "EducationEntry"("familyMemberId");

-- CreateIndex
CREATE INDEX "GradeReport_educationEntryId_idx" ON "GradeReport"("educationEntryId");

-- CreateIndex
CREATE INDEX "GradeItem_gradeReportId_idx" ON "GradeItem"("gradeReportId");

-- CreateIndex
CREATE INDEX "Activity_householdId_idx" ON "Activity"("householdId");

-- CreateIndex
CREATE INDEX "Activity_familyMemberId_idx" ON "Activity"("familyMemberId");

-- CreateIndex
CREATE INDEX "Achievement_householdId_idx" ON "Achievement"("householdId");

-- CreateIndex
CREATE INDEX "Achievement_familyMemberId_idx" ON "Achievement"("familyMemberId");

-- CreateIndex
CREATE INDEX "Certification_householdId_idx" ON "Certification"("householdId");

-- CreateIndex
CREATE INDEX "Certification_familyMemberId_idx" ON "Certification"("familyMemberId");

-- CreateIndex
CREATE INDEX "Certification_expirationDate_idx" ON "Certification"("expirationDate");

-- AddForeignKey
ALTER TABLE "EducationEntry" ADD CONSTRAINT "EducationEntry_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeReport" ADD CONSTRAINT "GradeReport_educationEntryId_fkey" FOREIGN KEY ("educationEntryId") REFERENCES "EducationEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_gradeReportId_fkey" FOREIGN KEY ("gradeReportId") REFERENCES "GradeReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
