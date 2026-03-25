-- CreateTable
CREATE TABLE "familyhub"."Address" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "label" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "moveInDate" DATE,
    "moveOutDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "familyhub"."CareerEntry" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_familyMemberId_idx" ON "familyhub"."Address"("familyMemberId");

-- CreateIndex
CREATE INDEX "CareerEntry_familyMemberId_idx" ON "familyhub"."CareerEntry"("familyMemberId");

-- AddForeignKey
ALTER TABLE "familyhub"."Address" ADD CONSTRAINT "Address_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "familyhub"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "familyhub"."CareerEntry" ADD CONSTRAINT "CareerEntry_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "familyhub"."FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing inline addresses to Address table
INSERT INTO "familyhub"."Address" ("id", "familyMemberId", "addressLine1", "addressLine2", "city", "state", "zipCode", "country", "isCurrent", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "addressLine1",
    "addressLine2",
    COALESCE("city", ''),
    "state",
    "zipCode",
    "country",
    true,
    NOW()
FROM "familyhub"."FamilyMember"
WHERE "addressLine1" IS NOT NULL AND "addressLine1" != '';
