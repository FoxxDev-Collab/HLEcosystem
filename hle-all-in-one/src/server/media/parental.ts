// Parental controls, ported from hle-media/src/server/parental.ts. A missing
// ParentalProfile row means fully unrestricted — admins/parents typically
// have no row at all. blockUnrated treats NULL contentRating as blocked.
// pinHash is carried in the data layer but has no UI yet (legacy: "UI to be
// decided") — upserts never touch it.
import { sql } from "@/server/db"

// Rating ladders, lowest → highest. Must match the CHECK constraints in
// migrations/0010_media.sql (Movie_contentRating_check, ParentalProfile_*).
export const MOVIE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"] as const
export const TV_RATINGS = [
  "TV-Y",
  "TV-Y7",
  "TV-G",
  "TV-PG",
  "TV-14",
  "TV-MA",
] as const

export type MovieRating = (typeof MOVIE_RATINGS)[number]
export type TvRating = (typeof TV_RATINGS)[number]

export type ParentalProfile = {
  userId: string
  householdId: string
  maxMovieRating: string | null
  maxTvRating: string | null
  blockUnrated: boolean
}

export type ParentalProfileRow = ParentalProfile & {
  id: string
  hasPin: boolean
}

/**
 * Load the parental profile for (user, household). A missing row means
 * fully unrestricted.
 */
export async function getParentalProfile(
  userId: string,
  householdId: string
): Promise<ParentalProfile | null> {
  const rows = await sql<Array<ParentalProfile>>`
    SELECT "userId", "householdId", "maxMovieRating", "maxTvRating",
           "blockUnrated"
    FROM "ParentalProfile"
    WHERE "userId" = ${userId} AND "householdId" = ${householdId}
    LIMIT 1`
  return rows[0] ?? null
}

// All profiles in a household, for the admin parental controls page. The
// pinHash itself never leaves the server — only a boolean flag.
export async function listParentalProfiles(
  householdId: string
): Promise<Array<ParentalProfileRow>> {
  return sql<Array<ParentalProfileRow>>`
    SELECT "id", "userId", "householdId", "maxMovieRating", "maxTvRating",
           "blockUnrated", ("pinHash" IS NOT NULL) AS "hasPin"
    FROM "ParentalProfile"
    WHERE "householdId" = ${householdId}`
}

// Set (or update) a member's rating ceilings. pinHash is deliberately left
// alone — there is no PIN UI yet and an upsert must not clobber it.
export async function upsertParentalProfile(
  householdId: string,
  userId: string,
  maxMovieRating: string | null,
  maxTvRating: string | null,
  blockUnrated: boolean
): Promise<void> {
  await sql`
    INSERT INTO "ParentalProfile" (
      "householdId", "userId", "maxMovieRating", "maxTvRating", "blockUnrated",
      "updatedAt"
    ) VALUES (
      ${householdId}, ${userId}, ${maxMovieRating}, ${maxTvRating},
      ${blockUnrated}, now()
    )
    ON CONFLICT ("householdId", "userId") DO UPDATE SET
      "maxMovieRating" = EXCLUDED."maxMovieRating",
      "maxTvRating"    = EXCLUDED."maxTvRating",
      "blockUnrated"   = EXCLUDED."blockUnrated",
      "updatedAt"      = now()`
}

export async function deleteParentalProfile(
  householdId: string,
  userId: string
): Promise<void> {
  await sql`
    DELETE FROM "ParentalProfile"
    WHERE "householdId" = ${householdId} AND "userId" = ${userId}`
}

/** Movie ratings this profile is allowed to watch. */
export function allowedMovieRatings(
  profile: ParentalProfile | null
): Array<string> {
  if (!profile?.maxMovieRating) return [...MOVIE_RATINGS]
  const idx = MOVIE_RATINGS.indexOf(profile.maxMovieRating as MovieRating)
  return idx === -1 ? [...MOVIE_RATINGS] : MOVIE_RATINGS.slice(0, idx + 1)
}

/** TV ratings this profile is allowed to watch. */
export function allowedTvRatings(
  profile: ParentalProfile | null
): Array<string> {
  if (!profile?.maxTvRating) return [...TV_RATINGS]
  const idx = TV_RATINGS.indexOf(profile.maxTvRating as TvRating)
  return idx === -1 ? [...TV_RATINGS] : TV_RATINGS.slice(0, idx + 1)
}

/** When true, unrated (NULL contentRating) content is blocked. */
export function blocksUnrated(profile: ParentalProfile | null): boolean {
  return profile?.blockUnrated === true
}

/** True when the given (kind, rating) pair would be hidden from this profile. */
export function isBlocked(
  profile: ParentalProfile | null,
  kind: "movie" | "series",
  rating: string | null
): boolean {
  if (rating === null) return blocksUnrated(profile)
  const allowed =
    kind === "movie" ? allowedMovieRatings(profile) : allowedTvRatings(profile)
  return !allowed.includes(rating)
}
