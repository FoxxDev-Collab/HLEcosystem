import { sql } from "./db";

// Rating ladders, lowest → highest. Must match the CHECK constraints in
// migrations/0001_init.sql (Movie_contentRating_check, ParentalProfile_*_check).
export const MOVIE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"] as const;
export const TV_RATINGS = ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"] as const;

export type ParentalProfile = {
  userId: string;
  householdId: string;
  maxMovieRating: string | null;
  maxTvRating: string | null;
  blockUnrated: boolean;
};

/**
 * Load the parental profile for (user, household). A missing row means
 * fully unrestricted — admins/parents typically have no row at all.
 */
export async function getParentalProfile(
  userId: string,
  householdId: string,
): Promise<ParentalProfile | null> {
  const rows = (await sql`
    SELECT "userId", "householdId", "maxMovieRating", "maxTvRating", "blockUnrated"
    FROM media."ParentalProfile"
    WHERE "userId" = ${userId} AND "householdId" = ${householdId}
    LIMIT 1
  `) as ParentalProfile[];
  return rows[0] ?? null;
}

/** Movie ratings this profile is allowed to watch. */
export function allowedMovieRatings(profile: ParentalProfile | null): string[] {
  if (!profile?.maxMovieRating) return [...MOVIE_RATINGS];
  const idx = MOVIE_RATINGS.indexOf(profile.maxMovieRating as (typeof MOVIE_RATINGS)[number]);
  return idx === -1 ? [...MOVIE_RATINGS] : MOVIE_RATINGS.slice(0, idx + 1);
}

/** TV ratings this profile is allowed to watch. */
export function allowedTvRatings(profile: ParentalProfile | null): string[] {
  if (!profile?.maxTvRating) return [...TV_RATINGS];
  const idx = TV_RATINGS.indexOf(profile.maxTvRating as (typeof TV_RATINGS)[number]);
  return idx === -1 ? [...TV_RATINGS] : TV_RATINGS.slice(0, idx + 1);
}

/** When true, unrated (NULL contentRating) content is blocked. */
export function blocksUnrated(profile: ParentalProfile | null): boolean {
  return profile?.blockUnrated === true;
}

/** True when the given (kind, rating) pair would be hidden from this profile. */
export function isBlocked(
  profile: ParentalProfile | null,
  kind: "movie" | "series",
  rating: string | null,
): boolean {
  if (rating === null) return blocksUnrated(profile);
  const allowed = kind === "movie" ? allowedMovieRatings(profile) : allowedTvRatings(profile);
  return !allowed.includes(rating);
}
