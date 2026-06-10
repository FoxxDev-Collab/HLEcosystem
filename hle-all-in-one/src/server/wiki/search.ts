import { sql } from "@/server/db"
import type { PageVisibility } from "./collab"

export type WikiSearchResult = {
  id: string
  title: string
  visibility: PageVisibility
  updatedAt: Date
  updatedByName: string | null
  // For text searches this is a ts_headline excerpt with matches wrapped in
  // [[...]] markers (rendered as <mark> by the route — never raw HTML). For
  // tag browsing it is the first 200 chars of the page text, like legacy.
  snippet: string
}

export type PopularTag = { tag: string; count: number }

// ts_headline options: plain-text-safe custom delimiters. The default
// <b>...</b> would force HTML rendering — [[...]] keeps the snippet a plain
// string the client can split and render through React, never as raw HTML
// (per the security invariants).
const HEADLINE_OPTS =
  "StartSel=[[, StopSel=]], MaxWords=30, MinWords=12, MaxFragments=1"

// The access predicate below mirrors getAccessiblePage in ./collab.ts:
// PUBLIC, or own-household non-PRIVATE (or own PRIVATE), or shared to the
// caller's household. [security] Every search is filtered by it in SQL —
// results never include pages the caller could not open.

// Full-text search against the STORED "searchVector" column (GIN-indexed),
// with an ILIKE title fallback over the pg_trgm index — legacy semantics,
// minus the on-the-fly to_tsvector.
export async function searchPages(
  householdId: string,
  userId: string,
  query: string
): Promise<Array<WikiSearchResult>> {
  return sql<Array<WikiSearchResult>>`
    SELECT p."id", p."title", p."visibility", p."updatedAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "updatedByName",
           CASE
             WHEN p."contentText" = '' THEN ''
             ELSE ts_headline('english', p."contentText",
                              plainto_tsquery('english', ${query}),
                              ${HEADLINE_OPTS})
           END AS "snippet"
    FROM "WikiPage" p
    LEFT JOIN "User" u ON u."id" = p."updatedById"
    WHERE p."archived" = false
      AND (
        p."visibility" = 'PUBLIC'
        OR (p."householdId" = ${householdId}
            AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR EXISTS (
          SELECT 1 FROM "PageShare" ps
          WHERE ps."pageId" = p."id" AND ps."householdId" = ${householdId}
        )
      )
      AND (p."searchVector" @@ plainto_tsquery('english', ${query})
           OR p."title" ILIKE ${"%" + query + "%"})
    ORDER BY ts_rank(p."searchVector",
                     plainto_tsquery('english', ${query})) DESC,
             p."updatedAt" DESC
    LIMIT 50`
}

// Tag browsing — pages carrying the tag, newest first (legacy shape).
export async function searchPagesByTag(
  householdId: string,
  userId: string,
  tag: string
): Promise<Array<WikiSearchResult>> {
  return sql<Array<WikiSearchResult>>`
    SELECT p."id", p."title", p."visibility", p."updatedAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "updatedByName",
           LEFT(p."contentText", 200) AS "snippet"
    FROM "WikiPage" p
    JOIN "PageTag" pt ON pt."pageId" = p."id" AND pt."tag" = ${tag}
    LEFT JOIN "User" u ON u."id" = p."updatedById"
    WHERE p."archived" = false
      AND (
        p."visibility" = 'PUBLIC'
        OR (p."householdId" = ${householdId}
            AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR EXISTS (
          SELECT 1 FROM "PageShare" ps
          WHERE ps."pageId" = p."id" AND ps."householdId" = ${householdId}
        )
      )
    ORDER BY p."updatedAt" DESC
    LIMIT 50`
}

// Top 20 tags across pages the caller can access (the popular-tags cloud).
export async function listPopularTags(
  householdId: string,
  userId: string
): Promise<Array<PopularTag>> {
  return sql<Array<PopularTag>>`
    SELECT pt."tag", COUNT(*)::int AS "count"
    FROM "PageTag" pt
    JOIN "WikiPage" p ON p."id" = pt."pageId"
    WHERE p."archived" = false
      AND (
        p."visibility" = 'PUBLIC'
        OR (p."householdId" = ${householdId}
            AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR EXISTS (
          SELECT 1 FROM "PageShare" ps
          WHERE ps."pageId" = p."id" AND ps."householdId" = ${householdId}
        )
      )
    GROUP BY pt."tag"
    ORDER BY "count" DESC, pt."tag" ASC
    LIMIT 20`
}
