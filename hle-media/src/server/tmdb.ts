/**
 * Thin TMDB client. Optional — if TMDB_API_KEY is unset, every call
 * returns null and the scanner is unaffected.
 *
 * Uses TMDB v3 with the api_key query param. v4 bearer tokens are also
 * v3-compatible if you prefer to swap the auth scheme later.
 *
 * Rate limit: TMDB allows ~50 req/s globally. The enrichment loop is
 * sequential per-item so we never approach that ceiling on a personal
 * library.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

const MPAA = new Set(["G", "PG", "PG-13", "R", "NC-17", "NR"]);
const TV = new Set(["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"]);

function apiKey(): string | null {
  return process.env.TMDB_API_KEY?.trim() || null;
}

export function tmdbConfigured(): boolean {
  return apiKey() !== null;
}

async function get<T>(
  pathname: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`${TMDB_BASE}${pathname}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[tmdb] ${res.status} ${pathname}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[tmdb] fetch failed ${pathname}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------

export type TmdbMovieDetails = {
  tmdbId: number;
  imdbId: string | null;
  synopsis: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  durationSec: number | null;
  contentRating: string | null;
};

export async function lookupMovie(
  title: string,
  year: number | null,
): Promise<TmdbMovieDetails | null> {
  const search = await get<{
    results: Array<{ id: number; title: string; release_date?: string }>;
  }>("/search/movie", { query: title, year: year ?? undefined });
  const first = search?.results?.[0];
  if (!first) return null;

  const details = await get<{
    id: number;
    imdb_id: string | null;
    overview: string | null;
    poster_path: string | null;
    backdrop_path: string | null;
    runtime: number | null;
  }>(`/movie/${first.id}`);
  if (!details) return null;

  const releases = await get<{
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification: string }>;
    }>;
  }>(`/movie/${first.id}/release_dates`);
  const us = releases?.results.find((r) => r.iso_3166_1 === "US");
  const certRaw = us?.release_dates.find((d) => d.certification)?.certification;
  const contentRating = certRaw && MPAA.has(certRaw) ? certRaw : null;

  return {
    tmdbId: details.id,
    imdbId: details.imdb_id,
    synopsis: details.overview ?? null,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    durationSec: details.runtime ? details.runtime * 60 : null,
    contentRating,
  };
}

// ---------------------------------------------------------------------------
// Series (TMDB calls these "tv")
// ---------------------------------------------------------------------------

export type TmdbSeriesDetails = {
  tmdbId: number;
  synopsis: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  contentRating: string | null;
};

export async function lookupSeries(
  title: string,
  firstAirYear: number | null,
): Promise<TmdbSeriesDetails | null> {
  const search = await get<{
    results: Array<{ id: number; name: string }>;
  }>("/search/tv", {
    query: title,
    first_air_date_year: firstAirYear ?? undefined,
  });
  const first = search?.results?.[0];
  if (!first) return null;

  const details = await get<{
    id: number;
    overview: string | null;
    poster_path: string | null;
    backdrop_path: string | null;
  }>(`/tv/${first.id}`);
  if (!details) return null;

  const ratings = await get<{
    results: Array<{ iso_3166_1: string; rating: string }>;
  }>(`/tv/${first.id}/content_ratings`);
  const usRating = ratings?.results.find((r) => r.iso_3166_1 === "US")?.rating;
  const contentRating = usRating && TV.has(usRating) ? usRating : null;

  return {
    tmdbId: details.id,
    synopsis: details.overview ?? null,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    contentRating,
  };
}
