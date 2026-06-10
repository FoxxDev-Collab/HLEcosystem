-- Wiki module: Confluence-like knowledge base — pages (3-level hierarchy,
-- TipTap JSON content), cross-household shares, threaded comments, tags, and
-- version snapshots. Ported from hle-family_wiki/prisma/schema.prisma.
--
-- Differences from legacy: UUID PKs (greenfield convention), real FKs to
-- "Household"/"User" (single database makes them possible).
--
-- Ownership: the legacy "ownerId" was polymorphic — a userId for PRIVATE
-- pages, a householdId for HOUSEHOLD/SHARED/PUBLIC pages — so it could not
-- be a real FK. It is split into:
--   "householdId"  NOT NULL — the tenancy boundary on every page (ADR-0005);
--                  private pages still belong to the creator's household.
--   "ownerUserId"  set only when visibility = 'PRIVATE' (the owning user),
--                  enforced by a CHECK constraint.
--
-- Naming: legacy enum "SharePermission" is renamed "WikiSharePermission" —
-- the future hle-file_server port defines its own plain "SharePermission".
-- Table names "WikiPage"/"PageShare"/"PageComment"/"PageTag"/"PageVersion"
-- do not collide with migrations 0001-0006 and are kept. Legacy authorship
-- columns "createdBy"/"updatedBy"/"editedBy"/"grantedBy" become
-- "...ById" FKs (repo convention), nullable with ON DELETE SET NULL so
-- deleting a user keeps the content.
--
-- Search: legacy used on-the-fly to_tsvector + ILIKE fallback. Here the
-- tsvector is a stored generated column with a GIN index, plus a pg_trgm
-- GIN index on "title" for the ILIKE substring fallback.

CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

CREATE TYPE "PageVisibility" AS ENUM ('PRIVATE','HOUSEHOLD','SHARED','PUBLIC');
CREATE TYPE "WikiSharePermission" AS ENUM ('VIEW','EDIT');

-- Pages: up to 3 levels (parentId NULL = root). The legacy
-- @@unique([ownerId, parentId, slug]) becomes a NULLS NOT DISTINCT unique
-- index (PG15+) so root pages ("parentId" IS NULL) and household pages
-- ("ownerUserId" IS NULL) still get slug dedupe — the app also appends a
-- suffix on collision, matching legacy behavior.
CREATE TABLE "WikiPage" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId"  UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "ownerUserId"  UUID REFERENCES "User"("id") ON DELETE CASCADE,
  "visibility"   "PageVisibility" NOT NULL DEFAULT 'HOUSEHOLD',
  "parentId"     UUID REFERENCES "WikiPage"("id") ON DELETE CASCADE,
  "title"        TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "content"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contentText"  TEXT NOT NULL DEFAULT '',
  "icon"         TEXT,
  "pinned"       BOOLEAN NOT NULL DEFAULT false,
  "archived"     BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"    INT NOT NULL DEFAULT 0,
  "wordCount"    INT NOT NULL DEFAULT 0,
  "createdById"  UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "updatedById"  UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "searchVector" tsvector GENERATED ALWAYS AS (
    to_tsvector('english', "title" || ' ' || "contentText")
  ) STORED,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (("visibility" = 'PRIVATE') = ("ownerUserId" IS NOT NULL))
);
CREATE UNIQUE INDEX "WikiPage_householdId_ownerUserId_parentId_slug_key"
  ON "WikiPage" ("householdId", "ownerUserId", "parentId", "slug") NULLS NOT DISTINCT;
CREATE INDEX "WikiPage_householdId_idx" ON "WikiPage" ("householdId");
CREATE INDEX "WikiPage_ownerUserId_idx" ON "WikiPage" ("ownerUserId");
CREATE INDEX "WikiPage_parentId_idx" ON "WikiPage" ("parentId");
CREATE INDEX "WikiPage_visibility_idx" ON "WikiPage" ("visibility");
CREATE INDEX "WikiPage_createdById_idx" ON "WikiPage" ("createdById");
CREATE INDEX "WikiPage_archived_idx" ON "WikiPage" ("archived");
CREATE INDEX "WikiPage_searchVector_idx" ON "WikiPage" USING GIN ("searchVector");
CREATE INDEX "WikiPage_title_trgm_idx" ON "WikiPage" USING GIN ("title" gin_trgm_ops);

-- Cross-household sharing: "householdId" here is the GRANTEE household being
-- given access to the page (the page's own household is on "WikiPage").
CREATE TABLE "PageShare" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pageId"      UUID NOT NULL REFERENCES "WikiPage"("id") ON DELETE CASCADE,
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "permission"  "WikiSharePermission" NOT NULL DEFAULT 'VIEW',
  "grantedById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("pageId", "householdId")
);
CREATE INDEX "PageShare_householdId_idx" ON "PageShare" ("householdId");

-- Threaded comments ("parentId" = reply target).
CREATE TABLE "PageComment" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pageId"    UUID NOT NULL REFERENCES "WikiPage"("id") ON DELETE CASCADE,
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "parentId"  UUID REFERENCES "PageComment"("id") ON DELETE CASCADE,
  "message"   TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PageComment_pageId_idx" ON "PageComment" ("pageId");
CREATE INDEX "PageComment_parentId_idx" ON "PageComment" ("parentId");

CREATE TABLE "PageTag" (
  "id"     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pageId" UUID NOT NULL REFERENCES "WikiPage"("id") ON DELETE CASCADE,
  "tag"    TEXT NOT NULL,
  UNIQUE ("pageId", "tag")
);
CREATE INDEX "PageTag_tag_idx" ON "PageTag" ("tag");

-- Version snapshots: the pre-update state is appended on every page save
-- (version = count + 1, content is the prior TipTap JSON).
CREATE TABLE "PageVersion" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pageId"     UUID NOT NULL REFERENCES "WikiPage"("id") ON DELETE CASCADE,
  "version"    INT NOT NULL,
  "title"      TEXT NOT NULL,
  "content"    JSONB NOT NULL,
  "editedById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "wordCount"  INT NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PageVersion_pageId_version_idx" ON "PageVersion" ("pageId", "version");
