// Audit trail writer (AU-2/AU-3). One call per security-relevant event:
//
//   await audit("auth.login.failure", { actorEmail: email, ...requestMeta() })
//
// Deliberately never throws: the audited operation must not fail because the
// audit insert did (availability over completeness for a family server; the
// failure itself is logged to stderr, which the container captures). Keep
// `detail` to small structured facts — never secrets, hashes, or free-form
// user content.
import { sql } from "./db"

export type AuditEntry = {
  actorUserId?: string | null
  actorEmail?: string | null
  targetType?: string | null
  targetId?: string | null
  householdId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  detail?: Record<string, string | number | boolean | null> | null
}

export async function audit(
  action: string,
  entry: AuditEntry = {}
): Promise<void> {
  try {
    await sql`
      INSERT INTO "AuditLog"
        ("action","actorUserId","actorEmail","targetType","targetId",
         "householdId","ipAddress","userAgent","detail")
      VALUES
        (${action}, ${entry.actorUserId ?? null}, ${entry.actorEmail ?? null},
         ${entry.targetType ?? null}, ${entry.targetId ?? null},
         ${entry.householdId ?? null}, ${entry.ipAddress ?? null},
         ${entry.userAgent ?? null},
         ${entry.detail ? JSON.stringify(entry.detail) : null})
    `
  } catch (err) {
    console.error(
      `[audit] failed to record ${action}:`,
      err instanceof Error ? err.message : err
    )
  }
}
