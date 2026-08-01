-- ============================================================================
-- 0011: Audit log (AU-2/AU-3/AU-9)
--
-- Append-only record of security-relevant events: authentication, credential
-- changes, admin user management, household membership, backup downloads,
-- and destructive finance operations. Written via src/server/audit.ts.
--
-- Design notes:
--  - actorUserId is ON DELETE SET NULL so deleting a user never erases the
--    trail of what they (or an admin acting on them) did; actorEmail keeps a
--    human-readable principal after the FK nulls out.
--  - householdId has NO foreign key: audit rows must outlive the household
--    they describe.
--  - No UPDATE path exists in the app layer; the log is insert-only.
-- ============================================================================

CREATE TABLE "AuditLog" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "action"      TEXT NOT NULL,
  "actorUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "actorEmail"  TEXT,
  "targetType"  TEXT,
  "targetId"    TEXT,
  "householdId" UUID,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "detail"      JSONB
);

CREATE INDEX "AuditLog_at_idx" ON "AuditLog" ("at");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog" ("actorUserId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog" ("action");
