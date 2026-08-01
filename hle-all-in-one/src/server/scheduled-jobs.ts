// Jobs the background scheduler (scripts/scheduler.ts) drives on an
// interval. Import discipline: this module may only depend on ./db and node
// builtins — it ships into the slim runtime image, where framework imports
// (@tanstack/*) do not resolve.
import { readdir, rename, unlink } from "node:fs/promises"
import path from "node:path"
import { sql } from "./db"

// UTC stamp for backup filenames: 2026-07-31-2145. Lexical order == time
// order, which the retention pruning below relies on.
export function backupStamp(now = new Date()): string {
  return now.toISOString().slice(0, 16).replace("T", "-").replace(":", "")
}

// Expired sessions are otherwise only deleted lazily when their exact token
// is presented again — a session that expires and is never revisited would
// hold userAgent/ipAddress forever (data-retention hygiene, AC-12/SI-12).
// Session_expiresAt_idx (0001_init) keeps this cheap.
export async function pruneExpiredSessions(): Promise<number> {
  const rows = await sql`
    DELETE FROM "Session" WHERE "expiresAt" < now() RETURNING "id"
  `
  return rows.length
}

// process_due_recurring() is per-household (it was button-driven in the
// legacy app). The scheduler sweeps every household; NULL acting user marks
// the created transactions as system-generated.
export async function processAllDueRecurring(): Promise<{
  households: number
  created: number
}> {
  const households = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Household"
  `
  let created = 0
  for (const h of households) {
    const [row] = await sql<Array<{ count: number }>>`
      SELECT process_due_recurring(${h.id}, NULL)::int AS "count"
    `
    created += row?.count ?? 0
  }
  return { households: households.length, created }
}

const BACKUP_PREFIX = "hle-aio-"
const BACKUP_SUFFIX = ".dump"

export function isBackupFile(name: string): boolean {
  return name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX)
}

// Pure retention policy: which files to delete so at most `retain` newest
// dumps remain. Stamped names sort lexically by age.
export function backupsToPrune(
  files: Array<string>,
  retain: number
): Array<string> {
  if (retain <= 0) return []
  const dumps = files.filter(isBackupFile).sort()
  return dumps.slice(0, Math.max(0, dumps.length - retain))
}

// Scheduled pg_dump to BACKUP_DIR. Writes to a dot-prefixed partial first so
// a crash mid-dump never leaves a file the retention logic (or a human)
// could mistake for a valid backup, then prunes to the retention count.
export async function runScheduledBackup(
  dir: string,
  retain: number
): Promise<{ file: string; bytes: number; pruned: Array<string> }> {
  const file = `${BACKUP_PREFIX}${backupStamp()}${BACKUP_SUFFIX}`
  const partial = path.join(dir, `.${file}.partial`)
  const proc = Bun.spawn(
    [
      "pg_dump",
      "--format=custom",
      `--dbname=${process.env.DATABASE_URL}`,
      `--file=${partial}`,
    ],
    { stdout: "ignore", stderr: "pipe" }
  )
  const code = await proc.exited
  if (code !== 0) {
    const err = await new Response(proc.stderr).text()
    await unlink(partial).catch(() => {})
    throw new Error(`pg_dump exited ${code}: ${err.slice(0, 500)}`)
  }
  await rename(partial, path.join(dir, file))
  const bytes = Bun.file(path.join(dir, file)).size

  const pruned = backupsToPrune(await readdir(dir), retain)
  for (const old of pruned) {
    await unlink(path.join(dir, old))
  }
  return { file, bytes, pruned }
}

// Age of the newest completed dump, or null when none exist. Lets the
// scheduler skip the boot-time backup when a recent one already exists, so
// container restarts don't stack dumps.
export async function newestBackupAgeMs(
  dir: string,
  now = Date.now()
): Promise<number | null> {
  const dumps = (await readdir(dir)).filter(isBackupFile).sort()
  const newest = dumps[dumps.length - 1]
  if (!newest) return null
  const stat = await Bun.file(path.join(dir, newest)).stat()
  return now - stat.mtime.getTime()
}
