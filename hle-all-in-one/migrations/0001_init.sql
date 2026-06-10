-- Identity & tenancy core for the HLE all-in-one app.
--
-- Single schema (public) in a dedicated database. Quoted PascalCase tables and
-- camelCase columns mirror the legacy family_manager schema so the existing
-- TypeScript row types and query logic port with minimal change.
--
-- Multi-household membership: a User belongs to many Households via
-- HouseholdMember (the tenancy join). Session.activeHouseholdId is the
-- server-side "current household" selector for the sidebar switcher; every
-- request re-verifies membership against it (ADR-0005, generalized).

CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "User" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"       TEXT NOT NULL UNIQUE,
  "name"        TEXT NOT NULL,
  "password"    TEXT,
  "avatar"      TEXT,
  "role"        "Role" NOT NULL DEFAULT 'MEMBER',
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "totpSecret"  TEXT,
  "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Household" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        TEXT NOT NULL,
  "createdById" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "HouseholdMember" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "householdId" UUID NOT NULL REFERENCES "Household"("id") ON DELETE CASCADE,
  "userId"      UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "displayName" TEXT NOT NULL,
  "role"        "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("householdId", "userId")
);
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember" ("userId");

CREATE TABLE "Session" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "token"             TEXT NOT NULL UNIQUE,
  "userId"            UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "activeHouseholdId" UUID REFERENCES "Household"("id") ON DELETE SET NULL,
  "expiresAt"         TIMESTAMPTZ NOT NULL,
  "userAgent"         TEXT,
  "ipAddress"         TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");

-- Admin-provisioned account activation + password reset (email link / SMTP).
CREATE TABLE "ActivationToken" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ActivationToken_userId_idx" ON "ActivationToken" ("userId");
