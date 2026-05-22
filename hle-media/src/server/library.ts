import { sql } from "./db";
import {
  allowedMovieRatings,
  allowedTvRatings,
  blocksUnrated,
  type ParentalProfile,
} from "./parental";

export type LibraryItem =
  | {
      kind: "movie";
      id: string;
      title: string;
      year: number | null;
      posterPath: string | null;
      contentRating: string | null;
      durationSec: number | null;
    }
  | {
      kind: "series";
      id: string;
      title: string;
      year: number | null;
      posterPath: string | null;
      contentRating: string | null;
      episodeCount: number;
    };

type RawRow = {
  kind: "movie" | "series";
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  contentRating: string | null;
  durationSec: string | number | null;
  episodeCount: string | number | null;
};

export async function listLibrary(
  householdId: string,
  parental: ParentalProfile | null,
): Promise<LibraryItem[]> {
  const movieRatings = allowedMovieRatings(parental);
  const tvRatings = allowedTvRatings(parental);
  const allowUnrated = !blocksUnrated(parental);

  const rows = (await sql`
    SELECT
      'movie'::text                      AS kind,
      m."id"                             AS id,
      m."title"                          AS title,
      m."year"                           AS year,
      m."posterPath"                     AS "posterPath",
      m."contentRating"                  AS "contentRating",
      m."durationSec"                    AS "durationSec",
      NULL::int                          AS "episodeCount"
    FROM media."Movie" m
    WHERE m."householdId" = ${householdId}
      AND (
        m."contentRating" = ANY(${movieRatings})
        OR (m."contentRating" IS NULL AND ${allowUnrated})
      )
    UNION ALL
    SELECT
      'series'::text                     AS kind,
      s."id"                             AS id,
      s."title"                          AS title,
      s."year"                           AS year,
      s."posterPath"                     AS "posterPath",
      s."contentRating"                  AS "contentRating",
      NULL::float                        AS "durationSec",
      (
        SELECT COUNT(*)::int
        FROM media."Episode" e
        JOIN media."Season"  se ON se."id" = e."seasonId"
        WHERE se."seriesId" = s."id"
      )                                  AS "episodeCount"
    FROM media."Series" s
    WHERE s."householdId" = ${householdId}
      AND (
        s."contentRating" = ANY(${tvRatings})
        OR (s."contentRating" IS NULL AND ${allowUnrated})
      )
    ORDER BY title
  `) as RawRow[];

  return rows.map((r): LibraryItem =>
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
        },
  );
}

export type MovieDetail = {
  id: string;
  title: string;
  year: number | null;
  synopsis: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  durationSec: number | null;
  contentRating: string | null;
  tmdbId: number | null;
  mediaFileId: string | null;
};

export async function getMovie(
  householdId: string,
  movieId: string,
  parental: ParentalProfile | null,
): Promise<MovieDetail | null> {
  const movieRatings = allowedMovieRatings(parental);
  const allowUnrated = !blocksUnrated(parental);
  const rows = (await sql`
    SELECT "id", "title", "year", "synopsis", "posterPath", "backdropPath",
           "durationSec", "contentRating", "tmdbId", "mediaFileId"
    FROM media."Movie"
    WHERE "householdId" = ${householdId} AND "id" = ${movieId}
      AND (
        "contentRating" = ANY(${movieRatings})
        OR ("contentRating" IS NULL AND ${allowUnrated})
      )
    LIMIT 1
  `) as Array<{
    id: string;
    title: string;
    year: number | null;
    synopsis: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    durationSec: string | number | null;
    contentRating: string | null;
    tmdbId: number | null;
    mediaFileId: string | null;
  }>;
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    durationSec: r.durationSec === null ? null : Number(r.durationSec),
  };
}

export type SeriesDetail = {
  id: string;
  title: string;
  year: number | null;
  synopsis: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  contentRating: string | null;
  tmdbId: number | null;
  seasons: Array<{
    id: string;
    number: number;
    title: string | null;
    posterPath: string | null;
    episodes: Array<{
      id: string;
      number: number;
      title: string;
      synopsis: string | null;
      durationSec: number | null;
      mediaFileId: string | null;
      airDate: string | null;
    }>;
  }>;
};

export async function getSeries(
  householdId: string,
  seriesId: string,
  parental: ParentalProfile | null,
): Promise<SeriesDetail | null> {
  const tvRatings = allowedTvRatings(parental);
  const allowUnrated = !blocksUnrated(parental);
  const seriesRows = (await sql`
    SELECT "id", "title", "year", "synopsis", "posterPath", "backdropPath",
           "contentRating", "tmdbId"
    FROM media."Series"
    WHERE "householdId" = ${householdId} AND "id" = ${seriesId}
      AND (
        "contentRating" = ANY(${tvRatings})
        OR ("contentRating" IS NULL AND ${allowUnrated})
      )
    LIMIT 1
  `) as Array<Omit<SeriesDetail, "seasons">>;
  const series = seriesRows[0];
  if (!series) return null;

  const seasons = (await sql`
    SELECT "id", "number", "title", "posterPath"
    FROM media."Season"
    WHERE "householdId" = ${householdId} AND "seriesId" = ${seriesId}
    ORDER BY "number"
  `) as Array<{
    id: string;
    number: number;
    title: string | null;
    posterPath: string | null;
  }>;

  if (seasons.length === 0) {
    return { ...series, seasons: [] };
  }

  const seasonIds = seasons.map((s) => s.id);
  const episodes = (await sql`
    SELECT "id", "seasonId", "number", "title", "synopsis",
           "durationSec", "mediaFileId", "airDate"
    FROM media."Episode"
    WHERE "householdId" = ${householdId}
      AND "seasonId" = ANY(${seasonIds})
    ORDER BY "seasonId", "number"
  `) as Array<{
    id: string;
    seasonId: string;
    number: number;
    title: string;
    synopsis: string | null;
    durationSec: string | number | null;
    mediaFileId: string | null;
    airDate: Date | string | null;
  }>;

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
          airDate:
            e.airDate === null
              ? null
              : e.airDate instanceof Date
                ? e.airDate.toISOString().slice(0, 10)
                : e.airDate,
        })),
    })),
  };
}

export async function getLibraryCounts(
  householdId: string,
  parental: ParentalProfile | null,
): Promise<{ movies: number; series: number; episodes: number }> {
  const movieRatings = allowedMovieRatings(parental);
  const tvRatings = allowedTvRatings(parental);
  const allowUnrated = !blocksUnrated(parental);
  // Episode count reflects only episodes whose parent Series is visible to
  // this profile — episodes don't carry their own rating, the series does.
  const rows = (await sql`
    SELECT
      (
        SELECT COUNT(*)::int FROM media."Movie"
        WHERE "householdId" = ${householdId}
          AND (
            "contentRating" = ANY(${movieRatings})
            OR ("contentRating" IS NULL AND ${allowUnrated})
          )
      ) AS movies,
      (
        SELECT COUNT(*)::int FROM media."Series"
        WHERE "householdId" = ${householdId}
          AND (
            "contentRating" = ANY(${tvRatings})
            OR ("contentRating" IS NULL AND ${allowUnrated})
          )
      ) AS series,
      (
        SELECT COUNT(*)::int FROM media."Episode" e
        JOIN media."Season"  se ON se."id" = e."seasonId"
        JOIN media."Series"  s  ON s."id"  = se."seriesId"
        WHERE e."householdId" = ${householdId}
          AND (
            s."contentRating" = ANY(${tvRatings})
            OR (s."contentRating" IS NULL AND ${allowUnrated})
          )
      ) AS episodes
  `) as Array<{ movies: number; series: number; episodes: number }>;
  return rows[0] ?? { movies: 0, series: 0, episodes: 0 };
}
