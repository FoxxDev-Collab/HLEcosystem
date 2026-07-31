// Library scanner, ported from hle-media/src/server/scanner.ts. Walks the
// MEDIA_LIBRARY_PATH root (env-configured — never a request-supplied path),
// parses filenames into movies/episodes, probes tech metadata with ffprobe,
// and upserts rows keyed on UNIQUE ("householdId", "path"). Ids come from the
// DB defaults (gen_random_uuid()) instead of the legacy app-generated UUIDs.
//
// Degradation: if ffprobe is missing or fails on a file, that file is skipped
// and recorded in the summary's errors — the scan itself never crashes.
import { readdir } from "node:fs/promises"
import path from "node:path"
import { sql } from "@/server/db"
import { VIDEO_EXTS, parsePath } from "./scanner-parse"
import type { ParsedEpisode, ParsedMovie } from "./scanner-parse"

export { parsePath }
export type { Parsed } from "./scanner-parse"

// ----------------------------------------------------------------------------
// ffprobe
// ----------------------------------------------------------------------------

export type FfprobeResult = {
  durationSec: number | null
  sizeBytes: number
  container: string | null
  videoCodec: string | null
  audioCodec: string | null
  width: number | null
  height: number | null
}

type FfprobeJson = {
  format?: { duration?: string; size?: string; format_name?: string }
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
  }>
}

// Argument-array spawn — the file path is never interpolated into a shell
// string. Returns null on any failure (ffprobe absent, non-zero exit, bad
// JSON) so the caller can skip the file gracefully.
async function ffprobe(filePath: string): Promise<FfprobeResult | null> {
  try {
    const proc = Bun.spawn(
      [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { stdout: "pipe", stderr: "ignore" }
    )
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ])
    if (exitCode !== 0) return null
    const parsed = JSON.parse(stdout) as FfprobeJson
    const video = parsed.streams?.find((s) => s.codec_type === "video")
    const audio = parsed.streams?.find((s) => s.codec_type === "audio")
    return {
      durationSec: parsed.format?.duration
        ? Number(parsed.format.duration)
        : null,
      sizeBytes: parsed.format?.size ? Number(parsed.format.size) : 0,
      container: parsed.format?.format_name ?? null,
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      width: video?.width ?? null,
      height: video?.height ?? null,
    }
  } catch {
    return null
  }
}

// ----------------------------------------------------------------------------
// Filesystem walk
// ----------------------------------------------------------------------------

async function* walk(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (VIDEO_EXTS.has(ext)) yield full
    }
  }
}

// ----------------------------------------------------------------------------
// Upserts
// ----------------------------------------------------------------------------

async function upsertMediaFile(
  householdId: string,
  filePath: string,
  probe: FfprobeResult
): Promise<string> {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "MediaFile" (
      "householdId", "path", "sizeBytes", "durationSec",
      "container", "videoCodec", "audioCodec", "width", "height",
      "scannedAt", "updatedAt"
    ) VALUES (
      ${householdId}, ${filePath}, ${probe.sizeBytes}, ${probe.durationSec},
      ${probe.container}, ${probe.videoCodec}, ${probe.audioCodec},
      ${probe.width}, ${probe.height}, now(), now()
    )
    ON CONFLICT ("householdId", "path") DO UPDATE SET
      "sizeBytes"   = EXCLUDED."sizeBytes",
      "durationSec" = EXCLUDED."durationSec",
      "container"   = EXCLUDED."container",
      "videoCodec"  = EXCLUDED."videoCodec",
      "audioCodec"  = EXCLUDED."audioCodec",
      "width"       = EXCLUDED."width",
      "height"      = EXCLUDED."height",
      "scannedAt"   = now(),
      "updatedAt"   = now()
    RETURNING "id"`
  return rows[0].id
}

/** Returns true if a NEW Movie row was created. */
async function upsertMovie(
  householdId: string,
  mediaFileId: string,
  parsed: ParsedMovie,
  durationSec: number | null
): Promise<boolean> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Movie"
    WHERE "householdId" = ${householdId} AND "mediaFileId" = ${mediaFileId}
    LIMIT 1`
  if (existing.length > 0) return false

  await sql`
    INSERT INTO "Movie" (
      "householdId", "title", "year", "durationSec", "mediaFileId",
      "addedAt", "updatedAt"
    ) VALUES (
      ${householdId}, ${parsed.title}, ${parsed.year}, ${durationSec},
      ${mediaFileId}, now(), now()
    )`
  return true
}

async function upsertSeries(
  householdId: string,
  title: string,
  year: number | null
): Promise<string> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Series"
    WHERE "householdId" = ${householdId} AND "title" = ${title}
    LIMIT 1`
  if (existing.length > 0) return existing[0].id

  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Series" (
      "householdId", "title", "year", "addedAt", "updatedAt"
    ) VALUES (
      ${householdId}, ${title}, ${year}, now(), now()
    )
    RETURNING "id"`
  return rows[0].id
}

async function upsertSeason(
  householdId: string,
  seriesId: string,
  number: number
): Promise<string> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Season"
    WHERE "seriesId" = ${seriesId} AND "householdId" = ${householdId}
      AND "number" = ${number}
    LIMIT 1`
  if (existing.length > 0) return existing[0].id

  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Season" ("householdId", "seriesId", "number")
    VALUES (${householdId}, ${seriesId}, ${number})
    RETURNING "id"`
  return rows[0].id
}

/** Returns true if a NEW Episode row was created. */
async function upsertEpisode(
  householdId: string,
  seasonId: string,
  mediaFileId: string,
  parsed: ParsedEpisode,
  durationSec: number | null
): Promise<boolean> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Episode"
    WHERE "seasonId" = ${seasonId} AND "householdId" = ${householdId}
      AND "number" = ${parsed.episode}
    LIMIT 1`
  if (existing.length > 0) {
    // Re-link mediaFileId in case the file was renamed or replaced.
    await sql`
      UPDATE "Episode"
      SET "mediaFileId" = ${mediaFileId}, "durationSec" = ${durationSec}
      WHERE "id" = ${existing[0].id} AND "householdId" = ${householdId}`
    return false
  }

  await sql`
    INSERT INTO "Episode" (
      "householdId", "seasonId", "number", "title",
      "durationSec", "mediaFileId", "addedAt"
    ) VALUES (
      ${householdId}, ${seasonId}, ${parsed.episode},
      ${parsed.episodeTitle ?? `Episode ${parsed.episode}`},
      ${durationSec}, ${mediaFileId}, now()
    )`
  return true
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export type ScanSummary = {
  filesSeen: number
  filesIndexed: number
  filesSkipped: number
  moviesAdded: number
  episodesAdded: number
  errors: Array<string> // capped to MAX_ERRORS_RETAINED
  startedAt: string
  finishedAt: string
}

const MAX_ERRORS_RETAINED = 50

export async function scanLibrary(opts: {
  householdId: string
  rootPath: string
}): Promise<ScanSummary> {
  const startedAt = new Date().toISOString()
  const summary: ScanSummary = {
    filesSeen: 0,
    filesIndexed: 0,
    filesSkipped: 0,
    moviesAdded: 0,
    episodesAdded: 0,
    errors: [],
    startedAt,
    finishedAt: "",
  }

  const recordError = (msg: string) => {
    console.warn(`[scan] ${msg}`)
    if (summary.errors.length < MAX_ERRORS_RETAINED) {
      summary.errors.push(msg)
    }
  }

  for await (const file of walk(opts.rootPath)) {
    summary.filesSeen++
    const rel = path.relative(opts.rootPath, file)
    const parsed = parsePath(rel)
    if (!parsed) {
      summary.filesSkipped++
      recordError(`unparseable: ${rel}`)
      continue
    }

    const probe = await ffprobe(file)
    if (!probe) {
      summary.filesSkipped++
      recordError(`ffprobe failed: ${rel}`)
      continue
    }

    try {
      const fileId = await upsertMediaFile(opts.householdId, file, probe)
      if (parsed.kind === "movie") {
        if (
          await upsertMovie(opts.householdId, fileId, parsed, probe.durationSec)
        ) {
          summary.moviesAdded++
        }
      } else {
        const seriesId = await upsertSeries(
          opts.householdId,
          parsed.seriesTitle,
          parsed.seriesYear
        )
        const seasonId = await upsertSeason(
          opts.householdId,
          seriesId,
          parsed.season
        )
        if (
          await upsertEpisode(
            opts.householdId,
            seasonId,
            fileId,
            parsed,
            probe.durationSec
          )
        ) {
          summary.episodesAdded++
        }
      }
      summary.filesIndexed++
    } catch (err) {
      summary.filesSkipped++
      recordError(
        `db error on ${rel}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  summary.finishedAt = new Date().toISOString()
  return summary
}
