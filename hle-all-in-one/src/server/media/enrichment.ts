// TMDB metadata enrichment, ported from hle-media/src/server/enrichment.ts.
import { sql } from "@/server/db"
import { lookupMovie, lookupSeries, tmdbConfigured } from "./tmdb"

export type EnrichmentSummary = {
  moviesAttempted: number
  moviesEnriched: number
  seriesAttempted: number
  seriesEnriched: number
  skipped: boolean // true when TMDB_API_KEY is unset
}

/**
 * Walk all not-yet-enriched movies and series for a household and fill in
 * TMDB metadata where a match exists. COALESCE on update so we never
 * clobber a value the user (or a prior run) already populated.
 *
 * Idempotent: items that already have a tmdbId are skipped, so repeated
 * runs are cheap. Failures on individual items are logged and skipped —
 * one bad title doesn't break the rest of the pass.
 */
export async function enrichHousehold(
  householdId: string
): Promise<EnrichmentSummary> {
  const summary: EnrichmentSummary = {
    moviesAttempted: 0,
    moviesEnriched: 0,
    seriesAttempted: 0,
    seriesEnriched: 0,
    skipped: false,
  }
  if (!tmdbConfigured()) {
    console.warn("[enrich] TMDB_API_KEY not set; skipping enrichment.")
    summary.skipped = true
    return summary
  }

  const movies = await sql<
    Array<{ id: string; title: string; year: number | null }>
  >`
    SELECT "id", "title", "year"
    FROM "Movie"
    WHERE "householdId" = ${householdId} AND "tmdbId" IS NULL`

  for (const m of movies) {
    summary.moviesAttempted++
    try {
      const d = await lookupMovie(m.title, m.year)
      if (!d) continue
      await sql`
        UPDATE "Movie"
        SET "tmdbId"        = ${d.tmdbId},
            "imdbId"        = ${d.imdbId},
            "synopsis"      = COALESCE("synopsis",      ${d.synopsis}),
            "posterPath"    = COALESCE("posterPath",    ${d.posterPath}),
            "backdropPath"  = COALESCE("backdropPath",  ${d.backdropPath}),
            "durationSec"   = COALESCE("durationSec",   ${d.durationSec}),
            "contentRating" = COALESCE("contentRating", ${d.contentRating}),
            "updatedAt"     = now()
        WHERE "id" = ${m.id} AND "householdId" = ${householdId}`
      summary.moviesEnriched++
    } catch (err) {
      console.warn(`[enrich] movie ${m.id} (${m.title}):`, err)
    }
  }

  const seriesList = await sql<
    Array<{ id: string; title: string; year: number | null }>
  >`
    SELECT "id", "title", "year"
    FROM "Series"
    WHERE "householdId" = ${householdId} AND "tmdbId" IS NULL`

  for (const s of seriesList) {
    summary.seriesAttempted++
    try {
      const d = await lookupSeries(s.title, s.year)
      if (!d) continue
      await sql`
        UPDATE "Series"
        SET "tmdbId"        = ${d.tmdbId},
            "synopsis"      = COALESCE("synopsis",      ${d.synopsis}),
            "posterPath"    = COALESCE("posterPath",    ${d.posterPath}),
            "backdropPath"  = COALESCE("backdropPath",  ${d.backdropPath}),
            "contentRating" = COALESCE("contentRating", ${d.contentRating}),
            "updatedAt"     = now()
        WHERE "id" = ${s.id} AND "householdId" = ${householdId}`
      summary.seriesEnriched++
    } catch (err) {
      console.warn(`[enrich] series ${s.id} (${s.title}):`, err)
    }
  }

  return summary
}
