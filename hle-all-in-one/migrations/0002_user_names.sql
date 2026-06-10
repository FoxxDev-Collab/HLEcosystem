-- Split User.name into structured firstName / lastName.

ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName"  TEXT;

-- Backfill: first token -> firstName, remainder -> lastName ('' if single word).
UPDATE "User" SET
  "firstName" = split_part("name", ' ', 1),
  "lastName"  = CASE
                  WHEN position(' ' IN "name") > 0
                  THEN btrim(substring("name" FROM position(' ' IN "name") + 1))
                  ELSE ''
                END;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName"  SET NOT NULL;

-- Display name is derived from firstName + lastName in the query layer now.
ALTER TABLE "User" DROP COLUMN "name";
