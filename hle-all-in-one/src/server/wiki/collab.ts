import { sql } from "@/server/db"

export type PageVisibility = "PRIVATE" | "HOUSEHOLD" | "SHARED" | "PUBLIC"
export type WikiSharePermission = "VIEW" | "EDIT"

// The minimal page shape needed for access + edit decisions.
export type AccessiblePageRow = {
  id: string
  householdId: string
  ownerUserId: string | null
  visibility: PageVisibility
  createdById: string | null
}

export type PageViewRow = AccessiblePageRow & {
  parentId: string | null
  title: string
  // JSONB selected ::text — a TipTap JSON document as a string. Kept textual
  // so server fn results stay serializable; parse where the renderer needs it.
  content: string
  icon: string | null
  pinned: boolean
  archived: boolean
  wordCount: number
  createdAt: Date
  updatedAt: Date
  createdByName: string | null
  updatedByName: string | null
}

export type BreadcrumbRow = { id: string; title: string }

export type ChildPageRow = {
  id: string
  title: string
  wordCount: number
  updatedAt: Date
}

export type CommentRow = {
  id: string
  parentId: string | null
  userId: string
  message: string
  createdAt: Date
  userName: string | null
}

export type ThreadedComment = CommentRow & { replies: Array<CommentRow> }

export type TagRow = { id: string; tag: string }

export type ShareRow = {
  id: string
  householdId: string
  permission: WikiSharePermission
  householdName: string
}

export type VersionRow = {
  id: string
  version: number
  title: string
  wordCount: number
  createdAt: Date
  editedByName: string | null
}

export type HouseholdOption = { id: string; name: string }

// ─── Access control ─────────────────────────────────────
//
// [security] Shared page-access check — the single source of truth for
// "can this user see this page". Legacy hle-family_wiki had NO such check on
// addCommentAction/removeShareAction (any authenticated user could comment on
// or un-share ANY page by id). Every comment/tag/share/version operation in
// this module calls this first (ADR-0005 tenancy invariant, PORTING.md §2).
//
// A page is accessible when:
//   - it is PUBLIC, or
//   - it belongs to the caller's active household AND is not someone else's
//     PRIVATE page (visibility <> 'PRIVATE' OR ownerUserId = caller), or
//   - the caller's household holds a "PageShare" grant for it.
export async function getAccessiblePage(
  householdId: string,
  userId: string,
  pageId: string
): Promise<AccessiblePageRow | null> {
  const rows = await sql<Array<AccessiblePageRow>>`
    SELECT p."id", p."householdId", p."ownerUserId", p."visibility",
           p."createdById"
    FROM "WikiPage" p
    WHERE p."id" = ${pageId}
      AND (
        p."visibility" = 'PUBLIC'
        OR (p."householdId" = ${householdId}
            AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR EXISTS (
          SELECT 1 FROM "PageShare" s
          WHERE s."pageId" = p."id" AND s."householdId" = ${householdId}
        )
      )`
  return rows[0] ?? null
}

// Legacy canEdit rule, mapped to the new ownership columns: the page must be
// owned by the caller's active household (and, for PRIVATE pages, by the
// caller), and the caller must be the page creator or an instance ADMIN.
export function canEditPage(
  page: AccessiblePageRow,
  userId: string,
  userRole: "ADMIN" | "MEMBER",
  householdId: string
): boolean {
  const ownerMatch =
    page.householdId === householdId &&
    (page.visibility !== "PRIVATE" || page.ownerUserId === userId)
  return ownerMatch && (userRole === "ADMIN" || page.createdById === userId)
}

// ─── Page view ──────────────────────────────────────────

export async function getPageView(
  householdId: string,
  userId: string,
  pageId: string
): Promise<PageViewRow | null> {
  // Same access predicate as getAccessiblePage, inlined so the page row and
  // the access decision come from one query.
  const rows = await sql<Array<PageViewRow>>`
    SELECT p."id", p."householdId", p."ownerUserId", p."visibility",
           p."createdById", p."parentId", p."title", p."content"::text,
           p."icon", p."pinned", p."archived", p."wordCount", p."createdAt",
           p."updatedAt",
           btrim(cu."firstName" || ' ' || cu."lastName") AS "createdByName",
           btrim(uu."firstName" || ' ' || uu."lastName") AS "updatedByName"
    FROM "WikiPage" p
    LEFT JOIN "User" cu ON cu."id" = p."createdById"
    LEFT JOIN "User" uu ON uu."id" = p."updatedById"
    WHERE p."id" = ${pageId}
      AND (
        p."visibility" = 'PUBLIC'
        OR (p."householdId" = ${householdId}
            AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR EXISTS (
          SELECT 1 FROM "PageShare" s
          WHERE s."pageId" = p."id" AND s."householdId" = ${householdId}
        )
      )`
  return rows[0] ?? null
}

// Parent + grandparent titles for the breadcrumb trail (3-level hierarchy).
export async function getBreadcrumbs(
  parentId: string
): Promise<Array<BreadcrumbRow>> {
  const rows = await sql<
    Array<{
      id: string
      title: string
      grandparentId: string | null
      grandparentTitle: string | null
    }>
  >`
    SELECT p."id", p."title",
           gp."id" AS "grandparentId", gp."title" AS "grandparentTitle"
    FROM "WikiPage" p
    LEFT JOIN "WikiPage" gp ON gp."id" = p."parentId"
    WHERE p."id" = ${parentId}`
  const row = rows[0]
  if (!row) return []
  const crumbs: Array<BreadcrumbRow> = []
  if (row.grandparentId && row.grandparentTitle !== null) {
    crumbs.push({ id: row.grandparentId, title: row.grandparentTitle })
  }
  crumbs.push({ id: row.id, title: row.title })
  return crumbs
}

// Non-archived sub-pages the viewer can access (same predicate — a sibling's
// PRIVATE child must not leak through its parent).
export async function listChildPages(
  householdId: string,
  userId: string,
  pageId: string
): Promise<Array<ChildPageRow>> {
  return sql<Array<ChildPageRow>>`
    SELECT p."id", p."title", p."wordCount", p."updatedAt"
    FROM "WikiPage" p
    WHERE p."parentId" = ${pageId} AND p."archived" = false
      AND (
        p."visibility" = 'PUBLIC'
        OR (p."householdId" = ${householdId}
            AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR EXISTS (
          SELECT 1 FROM "PageShare" s
          WHERE s."pageId" = p."id" AND s."householdId" = ${householdId}
        )
      )
    ORDER BY p."sortOrder" ASC, p."title" ASC`
}

// ─── Comments (threaded) ────────────────────────────────

// Author names joined from "User" — id/name only, never password/totpSecret.
export async function listComments(pageId: string): Promise<Array<CommentRow>> {
  return sql<Array<CommentRow>>`
    SELECT c."id", c."parentId", c."userId", c."message", c."createdAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "userName"
    FROM "PageComment" c
    LEFT JOIN "User" u ON u."id" = c."userId"
    WHERE c."pageId" = ${pageId}
    ORDER BY c."createdAt" ASC`
}

// Legacy thread shape: top-level comments newest-first, replies oldest-first.
export function threadComments(
  rows: Array<CommentRow>
): Array<ThreadedComment> {
  const replies = new Map<string, Array<CommentRow>>()
  for (const row of rows) {
    if (!row.parentId) continue
    const list = replies.get(row.parentId) ?? []
    list.push(row)
    replies.set(row.parentId, list)
  }
  return rows
    .filter((row) => row.parentId === null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({ ...row, replies: replies.get(row.id) ?? [] }))
}

export async function getComment(
  id: string
): Promise<{ id: string; pageId: string; userId: string } | null> {
  const rows = await sql<Array<{ id: string; pageId: string; userId: string }>>`
    SELECT "id", "pageId", "userId" FROM "PageComment" WHERE "id" = ${id}`
  return rows[0] ?? null
}

export async function addComment(
  pageId: string,
  userId: string,
  parentId: string | null,
  message: string
): Promise<{ error?: string }> {
  if (parentId) {
    // The reply target must be a comment on the SAME page — don't trust the
    // parentId from form data.
    const parent = await sql<Array<{ id: string }>>`
      SELECT "id" FROM "PageComment"
      WHERE "id" = ${parentId} AND "pageId" = ${pageId}`
    if (parent.length === 0) return { error: "Comment not found." }
  }
  await sql`
    INSERT INTO "PageComment" ("pageId", "userId", "parentId", "message")
    VALUES (${pageId}, ${userId}, ${parentId}, ${message})`
  return {}
}

export async function deleteComment(id: string): Promise<void> {
  await sql`DELETE FROM "PageComment" WHERE "id" = ${id}`
}

// ─── Tags ───────────────────────────────────────────────

export async function listTags(pageId: string): Promise<Array<TagRow>> {
  return sql<Array<TagRow>>`
    SELECT "id", "tag" FROM "PageTag"
    WHERE "pageId" = ${pageId}
    ORDER BY "tag" ASC`
}

export async function addTag(pageId: string, tag: string): Promise<void> {
  await sql`
    INSERT INTO "PageTag" ("pageId", "tag") VALUES (${pageId}, ${tag})
    ON CONFLICT ("pageId", "tag") DO NOTHING`
}

export async function removeTag(pageId: string, tag: string): Promise<void> {
  await sql`
    DELETE FROM "PageTag" WHERE "pageId" = ${pageId} AND "tag" = ${tag}`
}

// ─── Shares ─────────────────────────────────────────────

export async function listShares(pageId: string): Promise<Array<ShareRow>> {
  return sql<Array<ShareRow>>`
    SELECT s."id", s."householdId", s."permission",
           h."name" AS "householdName"
    FROM "PageShare" s
    JOIN "Household" h ON h."id" = s."householdId"
    WHERE s."pageId" = ${pageId}
    ORDER BY h."name" ASC`
}

// Households the page can still be shared with (everyone except the owning
// household and existing grantees).
export async function listShareCandidates(
  pageId: string,
  excludeHouseholdId: string
): Promise<Array<HouseholdOption>> {
  return sql<Array<HouseholdOption>>`
    SELECT h."id", h."name"
    FROM "Household" h
    WHERE h."id" <> ${excludeHouseholdId}
      AND NOT EXISTS (
        SELECT 1 FROM "PageShare" s
        WHERE s."pageId" = ${pageId} AND s."householdId" = h."id"
      )
    ORDER BY h."name" ASC`
}

export async function householdExists(id: string): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "Household" WHERE "id" = ${id}`
  return rows.length > 0
}

export async function upsertShare(
  pageId: string,
  householdId: string,
  permission: WikiSharePermission,
  grantedById: string
): Promise<void> {
  await sql`
    INSERT INTO "PageShare" ("pageId", "householdId", "permission", "grantedById")
    VALUES (${pageId}, ${householdId},
            ${permission}::"WikiSharePermission", ${grantedById})
    ON CONFLICT ("pageId", "householdId")
    DO UPDATE SET "permission" = EXCLUDED."permission"`
}

// Legacy rule: granting a share flips a HOUSEHOLD page to SHARED visibility.
// (PRIVATE pages are rejected before this point — the 0007 CHECK constraint
// ties PRIVATE to ownerUserId, so they cannot silently become SHARED.)
export async function markPageShared(pageId: string): Promise<void> {
  await sql`
    UPDATE "WikiPage"
    SET "visibility" = 'SHARED', "updatedAt" = now()
    WHERE "id" = ${pageId} AND "visibility" = 'HOUSEHOLD'`
}

export async function removeShare(
  pageId: string,
  householdId: string
): Promise<void> {
  await sql`
    DELETE FROM "PageShare"
    WHERE "pageId" = ${pageId} AND "householdId" = ${householdId}`
}

// ─── Versions (list-only; legacy had no restore) ────────

export async function listVersions(
  pageId: string,
  limit = 10
): Promise<Array<VersionRow>> {
  return sql<Array<VersionRow>>`
    SELECT v."id", v."version", v."title", v."wordCount", v."createdAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "editedByName"
    FROM "PageVersion" v
    LEFT JOIN "User" u ON u."id" = v."editedById"
    WHERE v."pageId" = ${pageId}
    ORDER BY v."version" DESC
    LIMIT ${limit}`
}
