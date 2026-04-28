import { readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { $ } from "bun";
import { sql } from "./db";
import {
  VIDEO_EXTS,
  parsePath,
  type ParsedMovie,
  type ParsedEpisode,
} from "./scanner-parse";

export { parsePath };
export type { Parsed } from "./scanner-parse";

// ----------------------------------------------------------------------------
// ffprobe
// ----------------------------------------------------------------------------

export type FfprobeResult = {
  durationSec: number | null;
  sizeBytes: number;
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
};

type FfprobeJson = {
  format?: { duration?: string; size?: string; format_name?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
  }>;
};

async function ffprobe(filePath: string): Promise<FfprobeResult | null> {
  try {
    const proc =
      await $`ffprobe -v error -print_format json -show_format -show_streams ${filePath}`.quiet();
    if (proc.exitCode !== 0) return null;
    const parsed = JSON.parse(proc.stdout.toString()) as FfprobeJson;
    const video = parsed.streams?.find((s) => s.codec_type === "video");
    const audio = parsed.streams?.find((s) => s.codec_type === "audio");
    return {
      durationSec: parsed.format?.duration ? Number(parsed.format.duration) : null,
      sizeBytes: parsed.format?.size ? Number(parsed.format.size) : 0,
      container: parsed.format?.format_name ?? null,
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      width: video?.width ?? null,
      height: video?.height ?? null,
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Filesystem walk
// ----------------------------------------------------------------------------

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTS.has(ext)) yield full;
    }
  }
}

// ----------------------------------------------------------------------------
// Upserts
// ----------------------------------------------------------------------------

async function upsertMediaFile(
  householdId: string,
  filePath: string,
  probe: FfprobeResult,
): Promise<string> {
  const id = randomUUID();
  const rows = (await sql`
    INSERT INTO media."MediaFile" (
      "id", "householdId", "path", "sizeBytes", "durationSec",
      "container", "videoCodec", "audioCodec", "width", "height",
      "scannedAt", "updatedAt"
    ) VALUES (
      ${id}, ${householdId}, ${filePath}, ${probe.sizeBytes}, ${probe.durationSec},
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
    RETURNING "id"
  `) as { id: string }[];
  return rows[0]!.id;
}

/** Returns true if a NEW Movie row was created. */
async function upsertMovie(
  householdId: string,
  mediaFileId: string,
  parsed: ParsedMovie,
  durationSec: number | null,
): Promise<boolean> {
  const existing = (await sql`
    SELECT "id" FROM media."Movie"
    WHERE "householdId" = ${householdId} AND "mediaFileId" = ${mediaFileId}
    LIMIT 1
  `) as { id: string }[];
  if (existing.length > 0) return false;

  const id = randomUUID();
  await sql`
    INSERT INTO media."Movie" (
      "id", "householdId", "title", "year", "durationSec", "mediaFileId",
      "addedAt", "updatedAt"
    ) VALUES (
      ${id}, ${householdId}, ${parsed.title}, ${parsed.year}, ${durationSec},
      ${mediaFileId}, now(), now()
    )
  `;
  return true;
}

async function upsertSeries(
  householdId: string,
  title: string,
  year: number | null,
): Promise<string> {
  const existing = (await sql`
    SELECT "id" FROM media."Series"
    WHERE "householdId" = ${householdId} AND "title" = ${title}
    LIMIT 1
  `) as { id: string }[];
  if (existing.length > 0) return existing[0]!.id;

  const id = randomUUID();
  await sql`
    INSERT INTO media."Series" (
      "id", "householdId", "title", "year", "addedAt", "updatedAt"
    ) VALUES (
      ${id}, ${householdId}, ${title}, ${year}, now(), now()
    )
  `;
  return id;
}

async function upsertSeason(
  householdId: string,
  seriesId: string,
  number: number,
): Promise<string> {
  const existing = (await sql`
    SELECT "id" FROM media."Season"
    WHERE "seriesId" = ${seriesId} AND "number" = ${number}
    LIMIT 1
  `) as { id: string }[];
  if (existing.length > 0) return existing[0]!.id;

  const id = randomUUID();
  await sql`
    INSERT INTO media."Season" (
      "id", "householdId", "seriesId", "number"
    ) VALUES (
      ${id}, ${householdId}, ${seriesId}, ${number}
    )
  `;
  return id;
}

/** Returns true if a NEW Episode row was created. */
async function upsertEpisode(
  householdId: string,
  seasonId: string,
  mediaFileId: string,
  parsed: ParsedEpisode,
  durationSec: number | null,
): Promise<boolean> {
  const existing = (await sql`
    SELECT "id" FROM media."Episode"
    WHERE "seasonId" = ${seasonId} AND "number" = ${parsed.episode}
    LIMIT 1
  `) as { id: string }[];
  if (existing.length > 0) {
    // Re-link mediaFileId in case the file was renamed or replaced.
    await sql`
      UPDATE media."Episode"
      SET "mediaFileId" = ${mediaFileId}, "durationSec" = ${durationSec}
      WHERE "id" = ${existing[0]!.id}
    `;
    return false;
  }

  const id = randomUUID();
  await sql`
    INSERT INTO media."Episode" (
      "id", "householdId", "seasonId", "number", "title",
      "durationSec", "mediaFileId", "addedAt"
    ) VALUES (
      ${id}, ${householdId}, ${seasonId}, ${parsed.episode},
      ${parsed.episodeTitle ?? `Episode ${parsed.episode}`},
      ${durationSec}, ${mediaFileId}, now()
    )
  `;
  return true;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export type ScanSummary = {
  filesSeen: number;
  filesIndexed: number;
  filesSkipped: number;
  moviesAdded: number;
  episodesAdded: number;
  errors: string[]; // capped to MAX_ERRORS_RETAINED
  startedAt: string;
  finishedAt: string;
};

const MAX_ERRORS_RETAINED = 50;

export async function scanLibrary(opts: {
  householdId: string;
  rootPath: string;
}): Promise<ScanSummary> {
  const startedAt = new Date().toISOString();
  const summary: ScanSummary = {
    filesSeen: 0,
    filesIndexed: 0,
    filesSkipped: 0,
    moviesAdded: 0,
    episodesAdded: 0,
    errors: [],
    startedAt,
    finishedAt: "",
  };

  const recordError = (msg: string) => {
    console.warn(`[scan] ${msg}`);
    if (summary.errors.length < MAX_ERRORS_RETAINED) {
      summary.errors.push(msg);
    }
  };

  for await (const file of walk(opts.rootPath)) {
    summary.filesSeen++;
    const rel = path.relative(opts.rootPath, file);
    const parsed = parsePath(rel);
    if (!parsed) {
      summary.filesSkipped++;
      recordError(`unparseable: ${rel}`);
      continue;
    }

    const probe = await ffprobe(file);
    if (!probe) {
      summary.filesSkipped++;
      recordError(`ffprobe failed: ${rel}`);
      continue;
    }

    try {
      const fileId = await upsertMediaFile(opts.householdId, file, probe);
      if (parsed.kind === "movie") {
        if (await upsertMovie(opts.householdId, fileId, parsed, probe.durationSec)) {
          summary.moviesAdded++;
        }
      } else {
        const seriesId = await upsertSeries(
          opts.householdId,
          parsed.seriesTitle,
          parsed.seriesYear,
        );
        const seasonId = await upsertSeason(opts.householdId, seriesId, parsed.season);
        if (
          await upsertEpisode(
            opts.householdId,
            seasonId,
            fileId,
            parsed,
            probe.durationSec,
          )
        ) {
          summary.episodesAdded++;
        }
      }
      summary.filesIndexed++;
    } catch (err) {
      summary.filesSkipped++;
      recordError(
        `db error on ${rel}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  summary.finishedAt = new Date().toISOString();
  return summary;
}
