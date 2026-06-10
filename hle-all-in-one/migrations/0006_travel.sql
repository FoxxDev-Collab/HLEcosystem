-- Travel module: trips, travelers, itinerary, reservations, travel documents,
-- packing lists, trip budgets, travel contacts. Ported from
-- hle-family_travel/prisma/schema.prisma.
--
-- Differences from legacy: UUID PKs (greenfield convention), real FKs to
-- "Household"/"HouseholdMember" (single database makes them possible),
-- householdId is the tenancy boundary on "Trip" and "TravelDocument"
-- (ADR-0005); all other tables scope through their parent "Trip".
--
-- Naming: legacy "BudgetItem"/"BudgetCategory"/"Currency" are renamed
-- "TravelBudgetItem"/"TravelBudgetCategory"/"TravelCurrency" to avoid
-- collisions with the finance module port (and any concurrent migrations).
-- "TravelDocument"/"TravelContact" keep their legacy prefixed names.

CREATE TYPE "TripStatus" AS ENUM ('PLANNING','BOOKED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ReservationType" AS ENUM ('FLIGHT','HOTEL','CAR_RENTAL','RESTAURANT','ACTIVITY','TRAIN','BUS','FERRY','CRUISE','OTHER');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING','CONFIRMED','CANCELLED','COMPLETED');
CREATE TYPE "TravelDocumentType" AS ENUM (
  'PASSPORT','VISA','TRAVEL_INSURANCE','DRIVERS_LICENSE','VACCINATION_RECORD',
  'ITINERARY','BOOKING_CONFIRMATION','OTHER'
);
CREATE TYPE "PackingCategory" AS ENUM ('CLOTHING','TOILETRIES','ELECTRONICS','DOCUMENTS','MEDICATIONS','ACCESSORIES','GEAR','SNACKS','OTHER');
CREATE TYPE "TravelBudgetCategory" AS ENUM (
  'FLIGHTS','ACCOMMODATION','TRANSPORTATION','FOOD_AND_DRINK','ACTIVITIES',
  'SHOPPING','INSURANCE','VISA_AND_FEES','COMMUNICATION','OTHER'
);
CREATE TYPE "TravelCurrency" AS ENUM ('USD','EUR','GBP','CAD','AUD','JPY','CNY','MXN','CHF','OTHER');

CREATE TABLE "Trip" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"   UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "destination"   TEXT,
  "startDate"     DATE NOT NULL,
  "endDate"       DATE NOT NULL,
  "status"        "TripStatus" NOT NULL DEFAULT 'PLANNING',
  "coverImageUrl" TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Trip_householdId_idx" ON "Trip" ("householdId");
CREATE INDEX "Trip_startDate_idx" ON "Trip" ("startDate");
CREATE INDEX "Trip_status_idx" ON "Trip" ("status");

CREATE TABLE "Traveler" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"            UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "householdMemberId" UUID NOT NULL REFERENCES "HouseholdMember"("id") ON DELETE CASCADE,
  "displayName"       TEXT NOT NULL,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tripId", "householdMemberId")
);
CREATE INDEX "Traveler_tripId_idx" ON "Traveler" ("tripId");

CREATE TABLE "ItineraryDay" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"    UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "date"      DATE NOT NULL,
  "title"     TEXT,
  "notes"     TEXT,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tripId", "date")
);
CREATE INDEX "ItineraryDay_tripId_idx" ON "ItineraryDay" ("tripId");

CREATE TABLE "ItineraryActivity" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "itineraryDayId" UUID NOT NULL REFERENCES "ItineraryDay"("id") ON DELETE CASCADE,
  "title"          TEXT NOT NULL,
  "startTime"      TEXT,
  "endTime"        TEXT,
  "location"       TEXT,
  "address"        TEXT,
  "bookingRef"     TEXT,
  "cost"           NUMERIC(10,2),
  "currency"       "TravelCurrency" NOT NULL DEFAULT 'USD',
  "notes"          TEXT,
  "sortOrder"      INT NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ItineraryActivity_itineraryDayId_idx" ON "ItineraryActivity" ("itineraryDayId");

CREATE TABLE "Reservation" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"             UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "type"               "ReservationType" NOT NULL,
  "status"             "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "providerName"       TEXT NOT NULL,
  "confirmationNumber" TEXT,
  "startDateTime"      TIMESTAMPTZ,
  "endDateTime"        TIMESTAMPTZ,
  "location"           TEXT,
  "departureLocation"  TEXT,
  "arrivalLocation"    TEXT,
  "cost"               NUMERIC(10,2),
  "currency"           "TravelCurrency" NOT NULL DEFAULT 'USD',
  "isPaid"             BOOLEAN NOT NULL DEFAULT false,
  "bookingUrl"         TEXT,
  "contactPhone"       TEXT,
  "contactEmail"       TEXT,
  "notes"              TEXT,
  "fileServerFileId"   TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Reservation_tripId_idx" ON "Reservation" ("tripId");
CREATE INDEX "Reservation_type_idx" ON "Reservation" ("type");

-- householdId-scoped directly (documents can exist without a trip).
CREATE TABLE "TravelDocument" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"       UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "tripId"            UUID REFERENCES "Trip"("id") ON DELETE SET NULL,
  "householdMemberId" UUID REFERENCES "HouseholdMember"("id") ON DELETE SET NULL,
  "displayName"       TEXT,
  "type"              "TravelDocumentType" NOT NULL,
  "documentNumber"    TEXT,
  "issuingCountry"    TEXT,
  "issueDate"         DATE,
  "expiryDate"        DATE,
  "fileServerFileId"  TEXT,
  "notes"             TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TravelDocument_householdId_idx" ON "TravelDocument" ("householdId");
CREATE INDEX "TravelDocument_tripId_idx" ON "TravelDocument" ("tripId");
CREATE INDEX "TravelDocument_expiryDate_idx" ON "TravelDocument" ("expiryDate");

CREATE TABLE "PackingList" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"    UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PackingList_tripId_idx" ON "PackingList" ("tripId");

CREATE TABLE "PackingItem" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "packingListId" UUID NOT NULL REFERENCES "PackingList"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "category"      "PackingCategory" NOT NULL DEFAULT 'OTHER',
  "quantity"      INT NOT NULL DEFAULT 1,
  "isPacked"      BOOLEAN NOT NULL DEFAULT false,
  "notes"         TEXT,
  "sortOrder"     INT NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PackingItem_packingListId_idx" ON "PackingItem" ("packingListId");

CREATE TABLE "TravelBudgetItem" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"               UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "category"             "TravelBudgetCategory" NOT NULL,
  "description"          TEXT NOT NULL,
  "plannedAmount"        NUMERIC(10,2) NOT NULL,
  "actualAmount"         NUMERIC(10,2),
  "currency"             "TravelCurrency" NOT NULL DEFAULT 'USD',
  "financeTransactionId" TEXT,
  "notes"                TEXT,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TravelBudgetItem_tripId_idx" ON "TravelBudgetItem" ("tripId");

CREATE TABLE "TravelContact" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId"    UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "name"      TEXT NOT NULL,
  "role"      TEXT,
  "phone"     TEXT,
  "email"     TEXT,
  "address"   TEXT,
  "website"   TEXT,
  "notes"     TEXT,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "TravelContact_tripId_idx" ON "TravelContact" ("tripId");
