// Instance backup for migration/disaster recovery: a pg_dump of the whole
// database plus a tar of the uploads directory, streamed as downloads from
// admin-only API routes. The dump uses pg_dump's custom format (-Fc,
// compressed, restorable with pg_restore on any machine) — see the "Backup &
// migration" section of the README for the restore runbook.
//
// The dump contains EVERY household's data plus password hashes and TOTP
// secrets — instance-ADMIN only, enforced here (API routes don't run
// createServerFn middleware).
import { readSessionToken } from "./auth"
import { validateSession } from "./session"

export async function authenticateAdminRequest(): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const token = readSessionToken()
  const session = token ? await validateSession(token) : null
  if (!session) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    }
  }
  if (session.user.role !== "ADMIN") {
    return { ok: false, response: new Response("Forbidden", { status: 403 }) }
  }
  return { ok: true, userId: session.user.id }
}

// UTC stamp for download filenames: 2026-07-31-2145
export function backupStamp(now = new Date()): string {
  return now.toISOString().slice(0, 16).replace("T", "-").replace(":", "")
}

// Spawn pg_dump streaming to the response. Custom format embeds its own
// compression and supports selective/parallel pg_restore.
export function spawnDbDump(): ReadableStream<Uint8Array> {
  const proc = Bun.spawn(
    ["pg_dump", "--format=custom", `--dbname=${process.env.DATABASE_URL}`],
    { stdout: "pipe", stderr: "pipe" }
  )
  void proc.exited.then(async (code) => {
    if (code !== 0) {
      const err = await new Response(proc.stderr).text()
      console.error(`[backup] pg_dump exited ${code}: ${err.slice(0, 500)}`)
    }
  })
  return proc.stdout
}

// Tar (gzipped) of the uploads directory. MEDIA_LIBRARY_PATH is deliberately
// excluded — bulk media is re-scannable and belongs to a separate volume.
export function spawnUploadsArchive(
  uploadDir: string
): ReadableStream<Uint8Array> {
  const proc = Bun.spawn(["tar", "-czf", "-", "-C", uploadDir, "."], {
    stdout: "pipe",
    stderr: "pipe",
  })
  void proc.exited.then(async (code) => {
    if (code !== 0) {
      const err = await new Response(proc.stderr).text()
      console.error(`[backup] tar exited ${code}: ${err.slice(0, 500)}`)
    }
  })
  return proc.stdout
}
