-- Initial schema for hle-media.
-- Tenant isolation: every household-scoped table carries "householdId" and is
-- filtered on it at query time. Cross-schema FKs are intentionally avoided —
-- "userId" / "householdId" reference family_manager.* but are not declared as
-- FKs because cross-schema FKs make app-level migrations brittle.

CREATE SCHEMA IF NOT EXISTS media;

-- ---------------------------------------------------------------------------
-- Media files (raw on-disk artifacts produced by ffprobe during scan).
-- One row per discrete file. Movies/Episodes reference these.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media."MediaFile" (
  "id"          TEXT PRIMARY KEY,
  "householdId" TEXT NOT NULL,
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
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaFile_householdId_path_key"
  ON media."MediaFile" ("householdId", "path");
CREATE INDEX IF NOT EXISTS "MediaFile_householdId_idx"
  ON media."MediaFile" ("householdId");
CREATE INDEX IF NOT EXISTS "MediaFile_contentHash_idx"
  ON media."MediaFile" ("contentHash") WHERE "contentHash" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Movies. contentRating uses MPAA values.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media."Movie" (
  "id"            TEXT PRIMARY KEY,
  "householdId"   TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "year"          INTEGER,
  "synopsis"      TEXT,
  "posterPath"    TEXT,
  "backdropPath"  TEXT,
  "durationSec"   DOUBLE PRECISION,
  "contentRating" TEXT,
  "tmdbId"        INTEGER,
  "imdbId"        TEXT,
  "mediaFileId"   TEXT REFERENCES media."MediaFile"("id") ON DELETE SET NULL,
  "addedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Movie_contentRating_check"
    CHECK ("contentRating" IS NULL
           OR "contentRating" IN ('G','PG','PG-13','R','NC-17','NR'))
);
CREATE INDEX IF NOT EXISTS "Movie_householdId_idx"
  ON media."Movie" ("householdId");
CREATE INDEX IF NOT EXISTS "Movie_householdId_title_idx"
  ON media."Movie" ("householdId", "title");
CREATE INDEX IF NOT EXISTS "Movie_tmdbId_idx"
  ON media."Movie" ("tmdbId") WHERE "tmdbId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Series / Season / Episode. contentRating on Series uses TV Parental
-- Guidelines values.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media."Series" (
  "id"            TEXT PRIMARY KEY,
  "householdId"   TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS "Series_householdId_idx"
  ON media."Series" ("householdId");
CREATE INDEX IF NOT EXISTS "Series_householdId_title_idx"
  ON media."Series" ("householdId", "title");

CREATE TABLE IF NOT EXISTS media."Season" (
  "id"          TEXT PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "seriesId"    TEXT NOT NULL REFERENCES media."Series"("id") ON DELETE CASCADE,
  "number"      INTEGER NOT NULL,
  "title"       TEXT,
  "posterPath"  TEXT,
  CONSTRAINT "Season_seriesId_number_key" UNIQUE ("seriesId", "number")
);
CREATE INDEX IF NOT EXISTS "Season_householdId_idx"
  ON media."Season" ("householdId");
CREATE INDEX IF NOT EXISTS "Season_seriesId_idx"
  ON media."Season" ("seriesId");

CREATE TABLE IF NOT EXISTS media."Episode" (
  "id"          TEXT PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "seasonId"    TEXT NOT NULL REFERENCES media."Season"("id") ON DELETE CASCADE,
  "number"      INTEGER NOT NULL,
  "title"       TEXT NOT NULL,
  "synopsis"    TEXT,
  "durationSec" DOUBLE PRECISION,
  "mediaFileId" TEXT REFERENCES media."MediaFile"("id") ON DELETE SET NULL,
  "airDate"     DATE,
  "addedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Episode_seasonId_number_key" UNIQUE ("seasonId", "number")
);
CREATE INDEX IF NOT EXISTS "Episode_householdId_idx"
  ON media."Episode" ("householdId");
CREATE INDEX IF NOT EXISTS "Episode_seasonId_idx"
  ON media."Episode" ("seasonId");

-- ---------------------------------------------------------------------------
-- Per-member parental controls. Admins set rating ceilings for kids.
-- NULL ceiling = unrestricted. blockUnrated treats NR / no rating as blocked.
-- pinHash, if set, lets the member type a PIN to override (UI to be decided).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media."ParentalProfile" (
  "id"             TEXT PRIMARY KEY,
  "householdId"    TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "maxMovieRating" TEXT,
  "maxTvRating"    TEXT,
  "blockUnrated"   BOOLEAN NOT NULL DEFAULT false,
  "pinHash"        TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ParentalProfile_household_user_key" UNIQUE ("householdId", "userId"),
  CONSTRAINT "ParentalProfile_maxMovieRating_check"
    CHECK ("maxMovieRating" IS NULL
           OR "maxMovieRating" IN ('G','PG','PG-13','R','NC-17')),
  CONSTRAINT "ParentalProfile_maxTvRating_check"
    CHECK ("maxTvRating" IS NULL
           OR "maxTvRating" IN ('TV-Y','TV-Y7','TV-G','TV-PG','TV-14','TV-MA'))
);
CREATE INDEX IF NOT EXISTS "ParentalProfile_householdId_idx"
  ON media."ParentalProfile" ("householdId");
