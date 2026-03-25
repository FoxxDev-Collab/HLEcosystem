-- SimplifyFamilyRelationship
-- Reduce FamilyRelationship enum to just Spouse and Child.
-- Clear any existing values that are being removed, then alter the enum.

-- First, set any non-Spouse/Child relationships to NULL
UPDATE family_manager."HouseholdMember"
SET "familyRelationship" = NULL
WHERE "familyRelationship" IS NOT NULL
  AND "familyRelationship"::text NOT IN ('Spouse', 'Child');

-- Drop the old enum values by recreating the type
-- PostgreSQL doesn't support DROP VALUE from enum, so we recreate
ALTER TABLE family_manager."HouseholdMember"
  ALTER COLUMN "familyRelationship" TYPE text;

DROP TYPE IF EXISTS family_manager."FamilyRelationship";

CREATE TYPE family_manager."FamilyRelationship" AS ENUM ('Spouse', 'Child');

ALTER TABLE family_manager."HouseholdMember"
  ALTER COLUMN "familyRelationship" TYPE family_manager."FamilyRelationship"
  USING "familyRelationship"::family_manager."FamilyRelationship";
