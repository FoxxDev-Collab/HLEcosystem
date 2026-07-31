// Streaming query layer, ported from hle-media/src/server/stream.ts. The
// Response/Range mechanics live in src/routes/api/media/stream.$fileId.ts —
// this module owns the household-scoped lookup (the authz check) and the
// container → Content-Type map.
//
// CRITICAL: the served file path always comes from the DB row written by the
// scanner (which only walks the env-configured library root) — never from
// the request.
import { sql } from "@/server/db"

export const STREAM_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
}

export type StreamFileRow = {
  path: string
  sizeBytes: string | number // BIGINT comes back as a string from Bun.sql
  movieId: string | null
  movieRating: string | null
  seriesId: string | null
  seriesRating: string | null
}

/**
 * Pull the file row alongside its parent Movie / Series so the route can
 * apply the caller's parental profile. Episodes inherit their rating from
 * the parent Series. Household scoping in the WHERE clause IS the
 * authorization check.
 */
export async function getStreamFile(
  householdId: string,
  fileId: string
): Promise<StreamFileRow | null> {
  const rows = await sql<Array<StreamFileRow>>`
    SELECT mf."path", mf."sizeBytes",
           m."id"            AS "movieId",
           m."contentRating" AS "movieRating",
           s."id"            AS "seriesId",
           s."contentRating" AS "seriesRating"
    FROM "MediaFile" mf
    LEFT JOIN "Movie"   m  ON m."mediaFileId" = mf."id"
                          AND m."householdId" = mf."householdId"
    LEFT JOIN "Episode" e  ON e."mediaFileId" = mf."id"
                          AND e."householdId" = mf."householdId"
    LEFT JOIN "Season"  se ON se."id" = e."seasonId"
    LEFT JOIN "Series"  s  ON s."id"  = se."seriesId"
    WHERE mf."id" = ${fileId} AND mf."householdId" = ${householdId}
    LIMIT 1`
  return rows[0] ?? null
}

/**
 * Which rating ladder applies to this file. Resolved from the parent row
 * ids (the legacy code keyed off the rating columns, which made unrated —
 * NULL contentRating — content unplayable; resolving on ids fixes that
 * while keeping orphan files unreachable). null = orphan, refuse to stream.
 */
export function resolveStreamKind(
  row: StreamFileRow
): "movie" | "series" | null {
  if (row.movieId !== null) return "movie"
  if (row.seriesId !== null) return "series"
  return null
}
