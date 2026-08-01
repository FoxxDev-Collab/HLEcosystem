// Background scheduler — the third process the deployment needed but never
// had: nothing in the app ran on a schedule, so a deployed instance took
// zero automatic backups, never pruned expired sessions, and only created
// recurring transactions when someone pressed the button.
//
// Runs as its own supervised process (entrypoint.sh restarts it if it dies)
// so a scheduler crash can never take the web server down, and vice versa.
// Dev usage: `bun run scheduler` alongside `bun run dev`.
//
// Env:
//   BACKUP_DIR              unset → scheduled backups disabled (one log line)
//   BACKUP_INTERVAL_HOURS   default 24
//   BACKUP_RETENTION        default 7 (newest dumps kept; 0 disables pruning)
import { mkdir } from "node:fs/promises"
import {
  newestBackupAgeMs,
  processAllDueRecurring,
  pruneExpiredSessions,
  runScheduledBackup,
} from "../src/server/scheduled-jobs"

const TICK_MS = 60_000
const HOUR_MS = 60 * 60 * 1000
const SESSION_PRUNE_EVERY_MS = HOUR_MS
const RECURRING_EVERY_MS = HOUR_MS

const backupDir = process.env.BACKUP_DIR || null
const backupEveryMs =
  Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24) * HOUR_MS
const backupRetention = Math.max(0, Number(process.env.BACKUP_RETENTION ?? 7))

function log(job: string, msg: string) {
  console.log(`[scheduler] ${new Date().toISOString()} ${job}: ${msg}`)
}

async function sessionPruneJob() {
  const removed = await pruneExpiredSessions()
  if (removed > 0) log("sessions", `pruned ${removed} expired session(s)`)
}

async function recurringJob() {
  const { households, created } = await processAllDueRecurring()
  if (created > 0)
    log(
      "recurring",
      `created ${created} transaction(s) across ${households} household(s)`
    )
}

async function backupJob() {
  if (!backupDir) return
  const { file, bytes, pruned } = await runScheduledBackup(
    backupDir,
    backupRetention
  )
  log(
    "backup",
    `wrote ${file} (${(bytes / 1024 / 1024).toFixed(1)} MiB)` +
      (pruned.length > 0 ? `, pruned ${pruned.join(", ")}` : "")
  )
}

// ---------------------------------------------------------------------------

log("boot", `tick=${TICK_MS / 1000}s`)
if (backupDir) {
  await mkdir(backupDir, { recursive: true })
  log(
    "boot",
    `backups → ${backupDir} every ${backupEveryMs / HOUR_MS}h, keep ${backupRetention}`
  )
} else {
  log("boot", "scheduled backups disabled (BACKUP_DIR unset)")
}

// Interval jobs key off in-process time (and run once at boot). The backup
// job instead keys off the newest dump's file age, so a container restart
// loop can't stack dumps — and a host that was off past the interval backs
// up immediately on boot. A failing job backs off for FAIL_COOLDOWN_MS
// instead of retrying every tick.
const FAIL_COOLDOWN_MS = 15 * 60 * 1000
const lastRun = new Map<string, number>()
const failedUntil = new Map<string, number>()

type Job = {
  name: string
  due: () => Promise<boolean>
  run: () => Promise<void>
}

function intervalDue(name: string, everyMs: number): boolean {
  const last = lastRun.get(name)
  return last === undefined || Date.now() - last >= everyMs
}

const jobs: Array<Job> = [
  {
    name: "sessions",
    due: async () => intervalDue("sessions", SESSION_PRUNE_EVERY_MS),
    run: sessionPruneJob,
  },
  {
    name: "recurring",
    due: async () => intervalDue("recurring", RECURRING_EVERY_MS),
    run: recurringJob,
  },
  {
    name: "backup",
    due: async () => {
      if (!backupDir) return false
      const age = await newestBackupAgeMs(backupDir)
      return age === null || age >= backupEveryMs
    },
    run: backupJob,
  },
]

for (;;) {
  for (const job of jobs) {
    if ((failedUntil.get(job.name) ?? 0) > Date.now()) continue
    try {
      if (!(await job.due())) continue
      lastRun.set(job.name, Date.now())
      await job.run()
    } catch (err) {
      lastRun.set(job.name, Date.now())
      failedUntil.set(job.name, Date.now() + FAIL_COOLDOWN_MS)
      console.error(
        `[scheduler] ${new Date().toISOString()} ${job.name} FAILED (retry in ${FAIL_COOLDOWN_MS / 60000}m):`,
        err instanceof Error ? err.message : err
      )
    }
  }
  await new Promise((resolve) => setTimeout(resolve, TICK_MS))
}
