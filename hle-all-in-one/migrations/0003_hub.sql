-- FamilyHub module: people, relationships, important dates, gifts, education,
-- todos, media requests. Ported from hle-familyhub/prisma/schema.prisma.
--
-- Differences from legacy: UUID PKs (greenfield convention), real FKs to
-- "User"/"Household" (single database makes them possible), householdId is the
-- tenancy boundary on every household-scoped table (ADR-0005).

CREATE TYPE "Relationship" AS ENUM (
  'Spouse','Partner','Parent','Child','Sibling','Grandparent','Grandchild',
  'AuntUncle','NieceNephew','Cousin','InLaw','StepParent','StepChild',
  'StepSibling','Godparent','Godchild','Friend','Other'
);
CREATE TYPE "PreferredContactMethod" AS ENUM ('NONE','PHONE','EMAIL','TEXT');
CREATE TYPE "ImportantDateType" AS ENUM ('BIRTHDAY','ANNIVERSARY','GRADUATION','MEMORIAL','HOLIDAY','CUSTOM');
CREATE TYPE "RecurrenceType" AS ENUM ('ONCE','ANNUAL');
CREATE TYPE "GiftStatus" AS ENUM ('IDEA','PURCHASED','WRAPPED','GIVEN');
CREATE TYPE "GiftIdeaStatus" AS ENUM ('ACTIVE','PURCHASED','NOT_INTERESTED');
CREATE TYPE "GiftIdeaPriority" AS ENUM ('LOW','MEDIUM','HIGH');
CREATE TYPE "DegreeType" AS ENUM ('HIGH_SCHOOL','ASSOCIATE','BACHELOR','MASTER','DOCTORATE','CERTIFICATE','DIPLOMA','GED','TRADE','OTHER');
CREATE TYPE "EducationStatus" AS ENUM ('IN_PROGRESS','COMPLETED','WITHDRAWN','TRANSFERRED');
CREATE TYPE "GradeTerm" AS ENUM ('QUARTER_1','QUARTER_2','QUARTER_3','QUARTER_4','SEMESTER_1','SEMESTER_2','TRIMESTER_1','TRIMESTER_2','TRIMESTER_3','SUMMER','FULL_YEAR');
CREATE TYPE "ActivityCategory" AS ENUM ('SPORTS','ARTS','MUSIC','ACADEMIC','VOLUNTEER','CLUB','RELIGIOUS','OTHER');
CREATE TYPE "CertificationStatus" AS ENUM ('ACTIVE','EXPIRED','PENDING','REVOKED');
CREATE TYPE "TodoItemStatus" AS ENUM ('PENDING','IN_PROGRESS','DONE');
CREATE TYPE "MediaType" AS ENUM ('MOVIE','TV_SHOW','MUSIC');
CREATE TYPE "RequestStatus" AS ENUM ('REQUESTED','COMPLETED');

CREATE TABLE "FamilyMember" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"            UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "linkedUserId"           UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "firstName"              TEXT NOT NULL,
  "lastName"               TEXT NOT NULL,
  "nickname"               TEXT,
  "relationship"           "Relationship",
  "relationshipNotes"      TEXT,
  "birthday"               DATE,
  "anniversary"            DATE,
  "phone"                  TEXT,
  "email"                  TEXT,
  "preferredContactMethod" "PreferredContactMethod" NOT NULL DEFAULT 'NONE',
  "addressLine1"           TEXT,
  "addressLine2"           TEXT,
  "city"                   TEXT,
  "state"                  TEXT,
  "zipCode"                TEXT,
  "country"                TEXT,
  "profilePhotoUrl"        TEXT,
  "notes"                  TEXT,
  "isActive"               BOOLEAN NOT NULL DEFAULT true,
  "includeInHolidayCards"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "linkedUserId")
);
CREATE INDEX "FamilyMember_householdId_idx" ON "FamilyMember" ("householdId");

CREATE TABLE "Address" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "label"          TEXT,
  "addressLine1"   TEXT NOT NULL,
  "addressLine2"   TEXT,
  "city"           TEXT NOT NULL,
  "state"          TEXT,
  "zipCode"        TEXT,
  "country"        TEXT,
  "isCurrent"      BOOLEAN NOT NULL DEFAULT true,
  "moveInDate"     DATE,
  "moveOutDate"    DATE,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Address_familyMemberId_idx" ON "Address" ("familyMemberId");

CREATE TABLE "CareerEntry" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "employer"       TEXT NOT NULL,
  "title"          TEXT,
  "department"     TEXT,
  "startDate"      DATE,
  "endDate"        DATE,
  "isCurrent"      BOOLEAN NOT NULL DEFAULT false,
  "location"       TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "CareerEntry_familyMemberId_idx" ON "CareerEntry" ("familyMemberId");

CREATE TABLE "ImportantDate" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"        UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId"     UUID REFERENCES "FamilyMember"("id") ON DELETE SET NULL,
  "label"              TEXT NOT NULL,
  "date"               DATE NOT NULL,
  "type"               "ImportantDateType" NOT NULL,
  "recurrenceType"     "RecurrenceType" NOT NULL DEFAULT 'ANNUAL',
  "reminderDaysBefore" INT NOT NULL DEFAULT 14,
  "notes"              TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ImportantDate_householdId_idx" ON "ImportantDate" ("householdId");
CREATE INDEX "ImportantDate_familyMemberId_idx" ON "ImportantDate" ("familyMemberId");

CREATE TABLE "Gift" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "description"    TEXT NOT NULL,
  "giftDate"       DATE,
  "occasion"       TEXT,
  "status"         "GiftStatus" NOT NULL DEFAULT 'IDEA',
  "estimatedCost"  NUMERIC(10,2),
  "actualCost"     NUMERIC(10,2),
  "rating"         INT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Gift_householdId_idx" ON "Gift" ("householdId");
CREATE INDEX "Gift_familyMemberId_idx" ON "Gift" ("familyMemberId");

CREATE TABLE "GiftIdea" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId" UUID REFERENCES "FamilyMember"("id") ON DELETE SET NULL,
  "idea"           TEXT NOT NULL,
  "dateCaptured"   DATE NOT NULL DEFAULT CURRENT_DATE,
  "source"         TEXT,
  "priority"       "GiftIdeaPriority" NOT NULL DEFAULT 'MEDIUM',
  "status"         "GiftIdeaStatus" NOT NULL DEFAULT 'ACTIVE',
  "estimatedCost"  NUMERIC(10,2),
  "url"            TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "GiftIdea_householdId_idx" ON "GiftIdea" ("householdId");
CREATE INDEX "GiftIdea_familyMemberId_idx" ON "GiftIdea" ("familyMemberId");

CREATE TABLE "FamilyRelation" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"  UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "fromMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "toMemberId"   UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "relationType" "Relationship" NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("fromMemberId", "toMemberId")
);
CREATE INDEX "FamilyRelation_householdId_idx" ON "FamilyRelation" ("householdId");

CREATE TABLE "TodoList" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "color"       TEXT,
  "createdById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TodoList_householdId_idx" ON "TodoList" ("householdId");

CREATE TABLE "TodoItem" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "listId"      UUID NOT NULL REFERENCES "TodoList"("id") ON DELETE CASCADE,
  "title"       TEXT NOT NULL,
  "notes"       TEXT,
  "status"      "TodoItemStatus" NOT NULL DEFAULT 'PENDING',
  "dueDate"     DATE,
  "assigneeId"  UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMPTZ,
  "createdById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TodoItem_listId_idx" ON "TodoItem" ("listId");
CREATE INDEX "TodoItem_assigneeId_idx" ON "TodoItem" ("assigneeId");
CREATE INDEX "TodoItem_dueDate_idx" ON "TodoItem" ("dueDate");

-- Cross-household by design: any user can request media and see all requests.
CREATE TABLE "MediaRequest" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "mediaType"   "MediaType" NOT NULL,
  "title"       TEXT NOT NULL,
  "artist"      TEXT,
  "year"        INT,
  "status"      "RequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MediaRequest_requesterId_idx" ON "MediaRequest" ("requesterId");
CREATE INDEX "MediaRequest_status_idx" ON "MediaRequest" ("status");

CREATE TABLE "MediaRequestComment" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL REFERENCES "MediaRequest"("id") ON DELETE CASCADE,
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "message"   TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MediaRequestComment_requestId_idx" ON "MediaRequestComment" ("requestId");

CREATE TABLE "EducationEntry" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "institution"    TEXT NOT NULL,
  "degreeType"     "DegreeType",
  "fieldOfStudy"   TEXT,
  "startDate"      DATE,
  "endDate"        DATE,
  "graduationDate" DATE,
  "status"         "EducationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "gpa"            NUMERIC(4,2),
  "isCurrent"      BOOLEAN NOT NULL DEFAULT false,
  "location"       TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "EducationEntry_familyMemberId_idx" ON "EducationEntry" ("familyMemberId");

CREATE TABLE "GradeReport" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "educationEntryId" UUID NOT NULL REFERENCES "EducationEntry"("id") ON DELETE CASCADE,
  "schoolYear"       TEXT NOT NULL,
  "term"             "GradeTerm" NOT NULL,
  "reportDate"       DATE,
  "overallGpa"       NUMERIC(4,2),
  "notes"            TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "GradeReport_educationEntryId_idx" ON "GradeReport" ("educationEntryId");

CREATE TABLE "GradeItem" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "gradeReportId" UUID NOT NULL REFERENCES "GradeReport"("id") ON DELETE CASCADE,
  "subject"       TEXT NOT NULL,
  "grade"         TEXT NOT NULL,
  "percentage"    NUMERIC(5,2),
  "credits"       NUMERIC(4,1),
  "teacher"       TEXT,
  "notes"         TEXT
);
CREATE INDEX "GradeItem_gradeReportId_idx" ON "GradeItem" ("gradeReportId");

CREATE TABLE "Activity" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "category"       "ActivityCategory" NOT NULL DEFAULT 'OTHER',
  "organization"   TEXT,
  "startDate"      DATE,
  "endDate"        DATE,
  "isCurrent"      BOOLEAN NOT NULL DEFAULT true,
  "schedule"       TEXT,
  "cost"           NUMERIC(10,2),
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Activity_householdId_idx" ON "Activity" ("householdId");
CREATE INDEX "Activity_familyMemberId_idx" ON "Activity" ("familyMemberId");

CREATE TABLE "Achievement" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "activityId"     UUID REFERENCES "Activity"("id") ON DELETE SET NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "dateEarned"     DATE,
  "issuer"         TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Achievement_householdId_idx" ON "Achievement" ("householdId");
CREATE INDEX "Achievement_familyMemberId_idx" ON "Achievement" ("familyMemberId");

CREATE TABLE "Certification" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "familyMemberId" UUID NOT NULL REFERENCES "FamilyMember"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "issuingBody"    TEXT,
  "credentialId"   TEXT,
  "issueDate"      DATE,
  "expirationDate" DATE,
  "status"         "CertificationStatus" NOT NULL DEFAULT 'ACTIVE',
  "renewalCost"    NUMERIC(10,2),
  "url"            TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Certification_householdId_idx" ON "Certification" ("householdId");
CREATE INDEX "Certification_familyMemberId_idx" ON "Certification" ("familyMemberId");
