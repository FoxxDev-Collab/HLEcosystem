// Library reads, ported from hle-media/src/server/library.ts. Every query is
// double-gated: householdId scoping AND the caller's parental profile (rating
// ceilings + blockUnrated). Episodes inherit visibility from their Series.
import { sql } from "@/server/db"
import {
  allowedMovieRatings,
  allowedTvRatings,
  blocksUnrated,
} from "./parental"
import type { ParentalProfile } from "./parental"

export type LibraryItem =
  | {
      kind: "movie"
      id: string
      title: string
      year: number | null
      posterPath: string | null
      contentRating: string | null
      durationSec: number | null
    }
  | {
      kind: "series"
      id: string
      title: string
      year: number | null
      posterPath: string | null
      contentRating: string | null
      episodeCount: number
    }

type RawLibraryRow = {
  kind: "movie" | "series"
  id: string
  title: string
  year: number | null
  posterPath: string | null
  contentRating: string | null
  durationSec: string | number | null
  episodeCount: string | number | null
}

export async function listLibrary(
  householdId: string,
  parental: ParentalProfile | null
): Promise<Array<LibraryItem>> {
  const movieRatings = allowedMovieRatings(parental)
  const tvRatings = allowedTvRatings(parental)
  const allowUnrated = !blocksUnrated(parental)

  const rows = await sql<Array<RawLibraryRow>>`
    SELECT
      'movie'::text   AS kind,
      m."id"          AS id,
      m."title"       AS title,
      m."year"        AS year,
      m."posterPath"  AS "posterPath",
      m."contentRating" AS "contentRating",
      m."durationSec" AS "durationSec",
      NULL::int       AS "episodeCount"
    FROM "Movie" m
    WHERE m."householdId" = ${householdId}
      AND (
        m."contentRating" IN ${sql(movieRatings)}
        OR (m."contentRating" IS NULL AND ${allowUnrated})
      )
    UNION ALL
    SELECT
      'series'::text  AS kind,
      s."id"          AS id,
      s."title"       AS title,
      s."year"        AS year,
      s."posterPath"  AS "posterPath",
      s."contentRating" AS "contentRating",
      NULL::float     AS "durationSec",
      (
        SELECT COUNT(*)::int
        FROM "Episode" e
        JOIN "Season"  se ON se."id" = e."seasonId"
        WHERE se."seriesId" = s."id"
          AND e."householdId" = ${householdId}
      )               AS "episodeCount"
    FROM "Series" s
    WHERE s."householdId" = ${householdId}
      AND (
        s."contentRating" IN ${sql(tvRatings)}
        OR (s."contentRating" IS NULL AND ${allowUnrated})
      )
    ORDER BY title`

  return rows.map(
    (r): LibraryItem =>
      r.kind === "movie"
        ? {
            kind: "movie",
            id: r.id,
            title: r.title,
            year: r.year,
            posterPath: r.posterPath,
            contentRating: r.contentRating,
            durationSec: r.durationSec === null ? null : Number(r.durationSec),
          }
        : {
            kind: "series",
            id: r.id,
            title: r.title,
            year: r.year,
            posterPath: r.posterPath,
            contentRating: r.contentRating,
            episodeCount: Number(r.episodeCount ?? 0),
          }
  )
}

export type MovieDetail = {
  id: string
  title: string
  year: number | null
  synopsis: string | null
  posterPath: string | null
  backdropPath: string | null
  durationSec: number | null
  contentRating: string | null
  tmdbId: number | null
  mediaFileId: string | null
  // Linked MediaFile tech info (file path deliberately NOT exposed).
  fileSizeBytes: number | null
  fileContainer: string | null
  fileVideoCodec: string | null
  fileAudioCodec: string | null
  fileWidth: number | null
  fileHeight: number | null
}

export async function getMovie(
  householdId: string,
  movieId: string,
  parental: ParentalProfile | null
): Promise<MovieDetail | null> {
  const movieRatings = allowedMovieRatings(parental)
  const allowUnrated = !blocksUnrated(parental)
  const rows = await sql<
    Array<
      Omit<MovieDetail, "durationSec"> & { durationSec: string | number | null }
    >
  >`
    SELECT m."id", m."title", m."year", m."synopsis", m."posterPath",
           m."backdropPath", m."durationSec", m."contentRating", m."tmdbId",
           m."mediaFileId",
           mf."sizeBytes"::float8 AS "fileSizeBytes",
           mf."container"  AS "fileContainer",
           mf."videoCodec" AS "fileVideoCodec",
           mf."audioCodec" AS "fileAudioCodec",
           mf."width"      AS "fileWidth",
           mf."height"     AS "fileHeight"
    FROM "Movie" m
    LEFT JOIN "MediaFile" mf
      ON mf."id" = m."mediaFileId" AND mf."householdId" = m."householdId"
    WHERE m."householdId" = ${householdId} AND m."id" = ${movieId}
      AND (
        m."contentRating" IN ${sql(movieRatings)}
        OR (m."contentRating" IS NULL AND ${allowUnrated})
      )
    LIMIT 1`
  const r = rows[0]
  if (!r) return null
  return {
    ...r,
    durationSec: r.durationSec === null ? null : Number(r.durationSec),
  }
}

export type SeriesEpisode = {
  id: string
  number: number
  title: string
  synopsis: string | null
  durationSec: number | null
  mediaFileId: string | null
  airDate: string | null
}

export type SeriesSeason = {
  id: string
  number: number
  title: string | null
  posterPath: string | null
  episodes: Array<SeriesEpisode>
}

export type SeriesDetail = {
  id: string
  title: string
  year: number | null
  synopsis: string | null
  posterPath: string | null
  backdropPath: string | null
  contentRating: string | null
  tmdbId: number | null
  seasons: Array<SeriesSeason>
}

export async function getSeries(
  householdId: string,
  seriesId: string,
  parental: ParentalProfile | null
): Promise<SeriesDetail | null> {
  const tvRatings = allowedTvRatings(parental)
  const allowUnrated = !blocksUnrated(parental)
  const seriesRows = await sql<Array<Omit<SeriesDetail, "seasons">>>`
    SELECT "id", "title", "year", "synopsis", "posterPath", "backdropPath",
           "contentRating", "tmdbId"
    FROM "Series"
    WHERE "householdId" = ${householdId} AND "id" = ${seriesId}
      AND (
        "contentRating" IN ${sql(tvRatings)}
        OR ("contentRating" IS NULL AND ${allowUnrated})
      )
    LIMIT 1`
  const series = seriesRows[0]
  if (!series) return null

  const seasons = await sql<
    Array<{
      id: string
      number: number
      title: string | null
      posterPath: string | null
    }>
  >`
    SELECT "id", "number", "title", "posterPath"
    FROM "Season"
    WHERE "householdId" = ${householdId} AND "seriesId" = ${seriesId}
    ORDER BY "number"`

  if (seasons.length === 0) {
    return { ...series, seasons: [] }
  }

  const seasonIds = seasons.map((s) => s.id)
  const episodes = await sql<
    Array<{
      id: string
      seasonId: string
      number: number
      title: string
      synopsis: string | null
      durationSec: string | number | null
      mediaFileId: string | null
      airDate: string | null
    }>
  >`
    SELECT "id", "seasonId", "number", "title", "synopsis",
           "durationSec", "mediaFileId", "airDate"::text
    FROM "Episode"
    WHERE "householdId" = ${householdId}
      AND "seasonId" IN ${sql(seasonIds)}
    ORDER BY "seasonId", "number"`

  return {
    ...series,
    seasons: seasons.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      posterPath: s.posterPath,
      episodes: episodes
        .filter((e) => e.seasonId === s.id)
        .map((e) => ({
          id: e.id,
          number: e.number,
          title: e.title,
          synopsis: e.synopsis,
          durationSec: e.durationSec === null ? null : Number(e.durationSec),
          mediaFileId: e.mediaFileId,
          airDate: e.airDate,
        })),
    })),
  }
}

export type LibraryCounts = {
  movies: number
  series: number
  episodes: number
}

export async function getLibraryCounts(
  householdId: string,
  parental: ParentalProfile | null
): Promise<LibraryCounts> {
  const movieRatings = allowedMovieRatings(parental)
  const tvRatings = allowedTvRatings(parental)
  const allowUnrated = !blocksUnrated(parental)
  // Episode count reflects only episodes whose parent Series is visible to
  // this profile — episodes don't carry their own rating, the series does.
  const rows = await sql<Array<LibraryCounts>>`
    SELECT
      (
        SELECT COUNT(*)::int FROM "Movie"
        WHERE "householdId" = ${householdId}
          AND (
            "contentRating" IN ${sql(movieRatings)}
            OR ("contentRating" IS NULL AND ${allowUnrated})
          )
      ) AS movies,
      (
        SELECT COUNT(*)::int FROM "Series"
        WHERE "householdId" = ${householdId}
          AND (
            "contentRating" IN ${sql(tvRatings)}
            OR ("contentRating" IS NULL AND ${allowUnrated})
          )
      ) AS series,
      (
        SELECT COUNT(*)::int FROM "Episode" e
        JOIN "Season" se ON se."id" = e."seasonId"
        JOIN "Series" s  ON s."id"  = se."seriesId"
        WHERE e."householdId" = ${householdId}
          AND (
            s."contentRating" IN ${sql(tvRatings)}
            OR (s."contentRating" IS NULL AND ${allowUnrated})
          )
      ) AS episodes`
  return rows[0] ?? { movies: 0, series: 0, episodes: 0 }
}
