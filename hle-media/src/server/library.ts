import { sql } from "./db";

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

export async function listLibrary(householdId: string): Promise<LibraryItem[]> {
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
): Promise<MovieDetail | null> {
  const rows = (await sql`
    SELECT "id", "title", "year", "synopsis", "posterPath", "backdropPath",
           "durationSec", "contentRating", "tmdbId", "mediaFileId"
    FROM media."Movie"
    WHERE "householdId" = ${householdId} AND "id" = ${movieId}
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
): Promise<SeriesDetail | null> {
  const seriesRows = (await sql`
    SELECT "id", "title", "year", "synopsis", "posterPath", "backdropPath",
           "contentRating", "tmdbId"
    FROM media."Series"
    WHERE "householdId" = ${householdId} AND "id" = ${seriesId}
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
): Promise<{ movies: number; series: number; episodes: number }> {
  const rows = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM media."Movie"   WHERE "householdId" = ${householdId}) AS movies,
      (SELECT COUNT(*)::int FROM media."Series"  WHERE "householdId" = ${householdId}) AS series,
      (SELECT COUNT(*)::int FROM media."Episode" WHERE "householdId" = ${householdId}) AS episodes
  `) as Array<{ movies: number; series: number; episodes: number }>;
  return rows[0] ?? { movies: 0, series: 0, episodes: 0 };
}
