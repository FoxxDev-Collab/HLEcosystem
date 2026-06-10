-- Media module: family media library + focused Plex-lite player. Ported from
-- hle-media/migrations/0001_init.sql (Bun-native app, schema `media`).
--
-- Legacy source tables (6): MediaFile, Movie, Series, Season, Episode,
-- ParentalProfile. No renames needed — none collide with 0001-0009.
--
-- Differences from legacy:
-- * TEXT app-generated ids -> UUID PKs DEFAULT gen_random_uuid() (house
--   convention; the legacy scanner generated ids in app code).
-- * "householdId"/"userId" were deliberately un-FK'd TEXT in legacy (cross-
--   schema). In the monolith they become real UUID FKs: householdId CASCADE,
--   ParentalProfile.userId -> "User" CASCADE (a profile without its user is
--   meaningless).
-- * IF NOT EXISTS dropped — the monolith migration runner applies each file
--   exactly once inside a transaction.

CREATE TABLE "MediaFile" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "path"        TEXT NOT NULL,
  "sizeBytes"   BIGINT NOT NULL,
  "durationSec" DOUBLE PRECISION,
  "container"   TEXT,
  "videoCodec"  TEXT,
  "audioCodec"  TEXT,
  "width"       INTEGER,
  "height"      INTEGER,
  "contentHash" TEXT,
  "scannedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "path")
);
CREATE INDEX "MediaFile_householdId_idx" ON "MediaFile" ("householdId");
CREATE INDEX "MediaFile_contentHash_idx"
  ON "MediaFile" ("contentHash") WHERE "contentHash" IS NOT NULL;

-- Movies. contentRating uses MPAA values.
CREATE TABLE "Movie" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"   UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "title"         TEXT NOT NULL,
  "year"          INTEGER,
  "synopsis"      TEXT,
  "posterPath"    TEXT,
  "backdropPath"  TEXT,
  "durationSec"   DOUBLE PRECISION,
  "contentRating" TEXT,
  "tmdbId"        INTEGER,
  "imdbId"        TEXT,
  "mediaFileId"   UUID REFERENCES "MediaFile"("id") ON DELETE SET NULL,
  "addedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Movie_contentRating_check"
    CHECK ("contentRating" IS NULL
           OR "contentRating" IN ('G','PG','PG-13','R','NC-17','NR'))
);
CREATE INDEX "Movie_householdId_idx" ON "Movie" ("householdId");
CREATE INDEX "Movie_householdId_title_idx" ON "Movie" ("householdId", "title");
CREATE INDEX "Movie_tmdbId_idx" ON "Movie" ("tmdbId") WHERE "tmdbId" IS NOT NULL;
CREATE INDEX "Movie_mediaFileId_idx" ON "Movie" ("mediaFileId");

-- Series / Season / Episode. Series contentRating uses TV Parental
-- Guidelines values.
CREATE TABLE "Series" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"   UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "title"         TEXT NOT NULL,
  "year"          INTEGER,
  "synopsis"      TEXT,
  "posterPath"    TEXT,
  "backdropPath"  TEXT,
  "contentRating" TEXT,
  "tmdbId"        INTEGER,
  "tvdbId"        INTEGER,
  "addedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Series_contentRating_check"
    CHECK ("contentRating" IS NULL
           OR "contentRating" IN ('TV-Y','TV-Y7','TV-G','TV-PG','TV-14','TV-MA','NR'))
);
CREATE INDEX "Series_householdId_idx" ON "Series" ("householdId");
CREATE INDEX "Series_householdId_title_idx" ON "Series" ("householdId", "title");

CREATE TABLE "Season" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "seriesId"    UUID NOT NULL REFERENCES "Series"("id") ON DELETE CASCADE,
  "number"      INTEGER NOT NULL,
  "title"       TEXT,
  "posterPath"  TEXT,
  UNIQUE ("seriesId", "number")
);
CREATE INDEX "Season_householdId_idx" ON "Season" ("householdId");
CREATE INDEX "Season_seriesId_idx" ON "Season" ("seriesId");

CREATE TABLE "Episode" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "seasonId"    UUID NOT NULL REFERENCES "Season"("id") ON DELETE CASCADE,
  "number"      INTEGER NOT NULL,
  "title"       TEXT NOT NULL,
  "synopsis"    TEXT,
  "durationSec" DOUBLE PRECISION,
  "mediaFileId" UUID REFERENCES "MediaFile"("id") ON DELETE SET NULL,
  "airDate"     DATE,
  "addedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("seasonId", "number")
);
CREATE INDEX "Episode_householdId_idx" ON "Episode" ("householdId");
CREATE INDEX "Episode_seasonId_idx" ON "Episode" ("seasonId");
CREATE INDEX "Episode_mediaFileId_idx" ON "Episode" ("mediaFileId");

-- Per-member parental controls. Admins set rating ceilings for members.
-- NULL ceiling = unrestricted. blockUnrated treats NR / no rating as blocked.
-- pinHash, if set, lets the member type a PIN to override.
CREATE TABLE "ParentalProfile" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"    UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "userId"         UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "maxMovieRating" TEXT,
  "maxTvRating"    TEXT,
  "blockUnrated"   BOOLEAN NOT NULL DEFAULT false,
  "pinHash"        TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "userId"),
  CONSTRAINT "ParentalProfile_maxMovieRating_check"
    CHECK ("maxMovieRating" IS NULL
           OR "maxMovieRating" IN ('G','PG','PG-13','R','NC-17')),
  CONSTRAINT "ParentalProfile_maxTvRating_check"
    CHECK ("maxTvRating" IS NULL
           OR "maxTvRating" IN ('TV-Y','TV-Y7','TV-G','TV-PG','TV-14','TV-MA'))
);
CREATE INDEX "ParentalProfile_householdId_idx"
  ON "ParentalProfile" ("householdId");
