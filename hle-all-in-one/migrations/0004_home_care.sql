-- Home Care module: rooms, items/appliances, vehicles, maintenance schedules
-- and logs, repairs, service providers, documents, chores (with points and
-- rewards), and emergency preparedness. Ported from
-- hle-family_home_care/prisma/schema.prisma.
--
-- Differences from legacy: UUID PKs (greenfield convention), real FKs to
-- "Household"/"User"/"HouseholdMember" (single database makes them possible),
-- householdId is the tenancy boundary on every household-scoped table
-- (ADR-0005). Legacy chore assignee/redeemer columns held
-- family_manager."HouseholdMember" ids as plain strings — here they are real
-- FKs to "HouseholdMember". Legacy ChoreCompletion used the sentinel string
-- 'unassigned' in "completedById"; here NULL means unassigned.
-- "Document"."uploadedBy" (legacy NOT NULL user id string) becomes nullable
-- "uploadedById" UUID ON DELETE SET NULL so deleting a user keeps documents.
-- "assignedTo" / "completedBy" on maintenance tables are free text in the
-- legacy UI ("Self, contractor name") and stay TEXT.

CREATE TYPE "ItemCondition" AS ENUM ('EXCELLENT','GOOD','FAIR','POOR','NEEDS_REPAIR','DECOMMISSIONED');
CREATE TYPE "MaintenanceFrequency" AS ENUM ('WEEKLY','BI_WEEKLY','MONTHLY','QUARTERLY','SEMI_ANNUALLY','ANNUALLY','CUSTOM_DAYS');
CREATE TYPE "MaintenanceStatus" AS ENUM ('PENDING','COMPLETED','SKIPPED','OVERDUE');
CREATE TYPE "RepairStatus" AS ENUM ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ProviderSpecialty" AS ENUM (
  'HVAC','PLUMBING','ELECTRICAL','APPLIANCE_REPAIR','GENERAL_CONTRACTOR',
  'LANDSCAPING','PEST_CONTROL','ROOFING','PAINTING','FLOORING','AUTO_MECHANIC',
  'AUTO_BODY','AUTO_DEALER','CLEANING','LOCKSMITH','HANDYMAN','OTHER'
);
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE','SOLD','SCRAPPED','STORED');
CREATE TYPE "DocumentType" AS ENUM ('MANUAL','WARRANTY','RECEIPT','INVOICE','PHOTO','OTHER');
CREATE TYPE "ChoreFrequency" AS ENUM ('DAILY','WEEKLY','BI_WEEKLY','MONTHLY','CUSTOM_DAYS');
CREATE TYPE "RotationMode" AS ENUM ('NONE','ROUND_ROBIN','WEEKLY_ROTATION');
CREATE TYPE "ChoreCompletionStatus" AS ENUM ('PENDING','COMPLETED','SKIPPED','MISSED');
CREATE TYPE "EmergencyContactType" AS ENUM ('NEIGHBOR','UTILITY','LOCAL_SERVICE','INSURANCE','GOVERNMENT','VETERINARIAN','OTHER');
CREATE TYPE "EmergencyPlanType" AS ENUM ('FIRE','FLOOD','EARTHQUAKE','TORNADO','HURRICANE','POWER_OUTAGE','MEDICAL','INTRUDER','EVACUATION','CUSTOM');
CREATE TYPE "SupplyCondition" AS ENUM ('GOOD','LOW','EXPIRED','NEEDS_REPLACEMENT');

-- ─── Rooms / locations ──────────────────────────────────────────────────────

CREATE TABLE "Room" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "floor"       TEXT,
  "sortOrder"   INT NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "name")
);
CREATE INDEX "Room_householdId_idx" ON "Room" ("householdId");

-- ─── Items / appliances ─────────────────────────────────────────────────────

CREATE TABLE "Item" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"     UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "roomId"          UUID REFERENCES "Room"("id") ON DELETE SET NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "manufacturer"    TEXT,
  "model"           TEXT,
  "serialNumber"    TEXT,
  "purchaseDate"    DATE,
  "purchasePrice"   NUMERIC(10,2),
  "purchasedFrom"   TEXT,
  "warrantyExpires" DATE,
  "warrantyNotes"   TEXT,
  "condition"       "ItemCondition" NOT NULL DEFAULT 'GOOD',
  "manualUrl"       TEXT,
  "notes"           TEXT,
  "isArchived"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Item_householdId_idx" ON "Item" ("householdId");
CREATE INDEX "Item_roomId_idx" ON "Item" ("roomId");

-- ─── Vehicles ───────────────────────────────────────────────────────────────

CREATE TABLE "Vehicle" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "year"           INT,
  "make"           TEXT NOT NULL,
  "model"          TEXT NOT NULL,
  "trim"           TEXT,
  "vin"            TEXT,
  "licensePlate"   TEXT,
  "color"          TEXT,
  "currentMileage" INT,
  "mileageAsOf"    DATE,
  "purchaseDate"   DATE,
  "purchasePrice"  NUMERIC(10,2),
  "purchasedFrom"  TEXT,
  "status"         "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes"          TEXT,
  "isArchived"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Vehicle_householdId_idx" ON "Vehicle" ("householdId");

CREATE TABLE "MileageEntry" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId" UUID NOT NULL REFERENCES "Vehicle"("id") ON DELETE CASCADE,
  "mileage"   INT NOT NULL,
  "date"      DATE NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MileageEntry_vehicleId_date_idx" ON "MileageEntry" ("vehicleId", "date");

-- ─── Service providers / contractors ────────────────────────────────────────

CREATE TABLE "ServiceProvider" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "company"     TEXT,
  "specialty"   "ProviderSpecialty" NOT NULL DEFAULT 'OTHER',
  "phone"       TEXT,
  "email"       TEXT,
  "website"     TEXT,
  "address"     TEXT,
  "rating"      INT,
  "notes"       TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ServiceProvider_householdId_idx" ON "ServiceProvider" ("householdId");

-- ─── Maintenance schedules (recurring tasks) ────────────────────────────────

CREATE TABLE "MaintenanceSchedule" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"        UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "itemId"             UUID REFERENCES "Item"("id") ON DELETE CASCADE,
  "vehicleId"          UUID REFERENCES "Vehicle"("id") ON DELETE CASCADE,
  "title"              TEXT NOT NULL,
  "description"        TEXT,
  "frequency"          "MaintenanceFrequency" NOT NULL,
  "customIntervalDays" INT,
  "lastCompletedDate"  DATE,
  "nextDueDate"        DATE,
  "estimatedCost"      NUMERIC(10,2),
  "assignedTo"         TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MaintenanceSchedule_householdId_idx" ON "MaintenanceSchedule" ("householdId");
CREATE INDEX "MaintenanceSchedule_nextDueDate_idx" ON "MaintenanceSchedule" ("nextDueDate");

-- ─── Maintenance logs (actual records — "when did I do X?") ─────────────────

CREATE TABLE "MaintenanceLog" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"           UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "maintenanceScheduleId" UUID REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL,
  "itemId"                UUID REFERENCES "Item"("id") ON DELETE SET NULL,
  "vehicleId"             UUID REFERENCES "Vehicle"("id") ON DELETE SET NULL,
  "title"                 TEXT NOT NULL,
  "description"           TEXT,
  "completedDate"         DATE NOT NULL,
  "completedBy"           TEXT,
  "status"                "MaintenanceStatus" NOT NULL DEFAULT 'COMPLETED',
  "cost"                  NUMERIC(10,2),
  "mileageAtService"      INT,
  "partsUsed"             TEXT,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "MaintenanceLog_householdId_idx" ON "MaintenanceLog" ("householdId");
CREATE INDEX "MaintenanceLog_itemId_idx" ON "MaintenanceLog" ("itemId");
CREATE INDEX "MaintenanceLog_vehicleId_idx" ON "MaintenanceLog" ("vehicleId");
CREATE INDEX "MaintenanceLog_completedDate_idx" ON "MaintenanceLog" ("completedDate");

-- ─── Repairs ────────────────────────────────────────────────────────────────

CREATE TABLE "Repair" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"     UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "itemId"          UUID REFERENCES "Item"("id") ON DELETE SET NULL,
  "vehicleId"       UUID REFERENCES "Vehicle"("id") ON DELETE SET NULL,
  "providerId"      UUID REFERENCES "ServiceProvider"("id") ON DELETE SET NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "status"          "RepairStatus" NOT NULL DEFAULT 'SCHEDULED',
  "reportedDate"    DATE NOT NULL,
  "scheduledDate"   DATE,
  "completedDate"   DATE,
  "completedBy"     TEXT,
  "laborCost"       NUMERIC(10,2),
  "partsCost"       NUMERIC(10,2),
  "totalCost"       NUMERIC(10,2),
  "warrantyClaimId" TEXT,
  "partsUsed"       TEXT,
  "notes"           TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Repair_householdId_idx" ON "Repair" ("householdId");
CREATE INDEX "Repair_itemId_idx" ON "Repair" ("itemId");
CREATE INDEX "Repair_vehicleId_idx" ON "Repair" ("vehicleId");

-- ─── Documents / attachments (content-addressed files on disk) ──────────────

CREATE TABLE "Document" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"  UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "itemId"       UUID REFERENCES "Item"("id") ON DELETE SET NULL,
  "vehicleId"    UUID REFERENCES "Vehicle"("id") ON DELETE SET NULL,
  "repairId"     UUID REFERENCES "Repair"("id") ON DELETE SET NULL,
  "type"         "DocumentType" NOT NULL DEFAULT 'OTHER',
  "name"         TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "size"         BIGINT NOT NULL,
  "storagePath"  TEXT NOT NULL,
  "contentHash"  TEXT NOT NULL,
  "uploadedById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "notes"        TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Document_householdId_idx" ON "Document" ("householdId");
CREATE INDEX "Document_itemId_idx" ON "Document" ("itemId");
CREATE INDEX "Document_vehicleId_idx" ON "Document" ("vehicleId");
CREATE INDEX "Document_repairId_idx" ON "Document" ("repairId");

-- ─── Chores / household tasks ───────────────────────────────────────────────

CREATE TABLE "Chore" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"        UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "title"              TEXT NOT NULL,
  "description"        TEXT,
  "roomId"             UUID REFERENCES "Room"("id") ON DELETE SET NULL,
  "frequency"          "ChoreFrequency" NOT NULL DEFAULT 'WEEKLY',
  "customIntervalDays" INT,
  "rotationMode"       "RotationMode" NOT NULL DEFAULT 'NONE',
  "pointValue"         INT NOT NULL DEFAULT 0,
  "estimatedMinutes"   INT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Chore_householdId_idx" ON "Chore" ("householdId");
CREATE INDEX "Chore_roomId_idx" ON "Chore" ("roomId");

CREATE TABLE "ChoreAssignment" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "choreId"      UUID NOT NULL REFERENCES "Chore"("id") ON DELETE CASCADE,
  "assigneeId"   UUID NOT NULL REFERENCES "HouseholdMember"("id") ON DELETE CASCADE,
  "assigneeName" TEXT NOT NULL,
  "sortOrder"    INT NOT NULL DEFAULT 0,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("choreId", "assigneeId")
);
CREATE INDEX "ChoreAssignment_assigneeId_idx" ON "ChoreAssignment" ("assigneeId");

-- NULL "completedById" means unassigned (legacy used the sentinel string
-- 'unassigned'); "completedByName" keeps the display name for history.
CREATE TABLE "ChoreCompletion" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"     UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "choreId"         UUID NOT NULL REFERENCES "Chore"("id") ON DELETE CASCADE,
  "completedById"   UUID REFERENCES "HouseholdMember"("id") ON DELETE SET NULL,
  "completedByName" TEXT NOT NULL,
  "dueDate"         DATE NOT NULL,
  "completedDate"   DATE,
  "status"          "ChoreCompletionStatus" NOT NULL DEFAULT 'PENDING',
  "pointsEarned"    INT NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ChoreCompletion_householdId_idx" ON "ChoreCompletion" ("householdId");
CREATE INDEX "ChoreCompletion_choreId_idx" ON "ChoreCompletion" ("choreId");
CREATE INDEX "ChoreCompletion_completedById_idx" ON "ChoreCompletion" ("completedById");
CREATE INDEX "ChoreCompletion_dueDate_idx" ON "ChoreCompletion" ("dueDate");

CREATE TABLE "ChoreReward" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "pointCost"   INT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ChoreReward_householdId_idx" ON "ChoreReward" ("householdId");

CREATE TABLE "RewardRedemption" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "rewardId"       UUID NOT NULL REFERENCES "ChoreReward"("id") ON DELETE CASCADE,
  "redeemedById"   UUID REFERENCES "HouseholdMember"("id") ON DELETE SET NULL,
  "redeemedByName" TEXT NOT NULL,
  "pointsSpent"    INT NOT NULL,
  "redeemedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "RewardRedemption_householdId_idx" ON "RewardRedemption" ("householdId");
CREATE INDEX "RewardRedemption_redeemedById_idx" ON "RewardRedemption" ("redeemedById");

-- ─── Emergency preparedness ─────────────────────────────────────────────────

CREATE TABLE "EmergencyContact" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "type"           "EmergencyContactType" NOT NULL DEFAULT 'OTHER',
  "company"        TEXT,
  "phone"          TEXT,
  "phoneAlt"       TEXT,
  "email"          TEXT,
  "address"        TEXT,
  "accountNumber"  TEXT,
  "availableHours" TEXT,
  "priority"       INT NOT NULL DEFAULT 0,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "EmergencyContact_householdId_idx" ON "EmergencyContact" ("householdId");
CREATE INDEX "EmergencyContact_type_idx" ON "EmergencyContact" ("type");

CREATE TABLE "EmergencyPlan" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"           UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "type"                  "EmergencyPlanType" NOT NULL,
  "title"                 TEXT NOT NULL,
  "description"           TEXT,
  "meetingPoint"          TEXT,
  "evacuationRoute"       TEXT,
  "procedures"            TEXT,
  "lastReviewed"          DATE,
  "reviewFrequencyMonths" INT,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "EmergencyPlan_householdId_idx" ON "EmergencyPlan" ("householdId");

CREATE TABLE "EmergencySupplyKit" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "location"    TEXT,
  "roomId"      UUID REFERENCES "Room"("id") ON DELETE SET NULL,
  "description" TEXT,
  "lastChecked" DATE,
  "notes"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "EmergencySupplyKit_householdId_idx" ON "EmergencySupplyKit" ("householdId");

CREATE TABLE "EmergencySupply" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kitId"          UUID NOT NULL REFERENCES "EmergencySupplyKit"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "quantity"       INT NOT NULL DEFAULT 1,
  "unit"           TEXT,
  "expirationDate" DATE,
  "condition"      "SupplyCondition" NOT NULL DEFAULT 'GOOD',
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "EmergencySupply_kitId_idx" ON "EmergencySupply" ("kitId");
CREATE INDEX "EmergencySupply_expirationDate_idx" ON "EmergencySupply" ("expirationDate");

CREATE TABLE "UtilityShutoff" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "utilityType" TEXT NOT NULL,
  "location"    TEXT NOT NULL,
  "roomId"      UUID REFERENCES "Room"("id") ON DELETE SET NULL,
  "procedure"   TEXT,
  "toolsNeeded" TEXT,
  "photoUrl"    TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "UtilityShutoff_householdId_idx" ON "UtilityShutoff" ("householdId");

CREATE TABLE "ImportantDocumentLocation" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"      UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "documentName"     TEXT NOT NULL,
  "category"         TEXT,
  "physicalLocation" TEXT,
  "digitalLocation"  TEXT,
  "accountNumber"    TEXT,
  "policyNumber"     TEXT,
  "expirationDate"   DATE,
  "notes"            TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ImportantDocumentLocation_householdId_idx" ON "ImportantDocumentLocation" ("householdId");
