-- Add FILE_SHARE_LINK_ACCESS to AuditAction enum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FILE_SHARE_LINK_ACCESS';

-- Index: "my files" queries (householdId + ownerId + status + deletedAt)
CREATE INDEX IF NOT EXISTS "File_householdId_ownerId_status_deletedAt_idx"
  ON "File" ("householdId", "ownerId", "status", "deletedAt");

-- Index: audit log filtered by action type within a household
CREATE INDEX IF NOT EXISTS "AuditLog_householdId_action_createdAt_idx"
  ON "AuditLog" ("householdId", "action", "createdAt");

-- Index: audit log filtered by file with time ordering
CREATE INDEX IF NOT EXISTS "AuditLog_fileId_createdAt_idx"
  ON "AuditLog" ("fileId", "createdAt");
