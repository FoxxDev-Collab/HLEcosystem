// Wiki pages query layer — ported from hle-family_wiki/app/(app)/wiki/actions.ts
// and the legacy layout/sidebar tree queries.
//
// Ownership model (see migrations/0007_wiki.sql): "householdId" is the tenancy
// boundary on every page; "ownerUserId" is set only for PRIVATE pages. A
// PRIVATE page is NEVER visible to anyone but its owner — every query in this
// file enforces ("visibility" <> 'PRIVATE' OR "ownerUserId" = viewer) in SQL.
//
// Edit rule (legacy canEdit, scoped to the household): the page must belong to
// the viewer's household (PRIVATE pages additionally to the viewer), and the
// viewer must be the creator or an instance ADMIN. Cross-household shares with
// EDIT permission never granted actual edit rights in the legacy app either —
// preserved as-is.
import { sql } from "@/server/db"

export type PageVisibility = "PRIVATE" | "HOUSEHOLD" | "SHARED" | "PUBLIC"

export type WikiPageRow = {
  id: string
  householdId: string
  ownerUserId: string | null
  visibility: PageVisibility
  parentId: string | null
  title: string
  slug: string
  // JSONB selected ::text — a TipTap JSON document as a string. Kept textual
  // so server fn results stay serializable; parse where the editor needs it.
  content: string
  contentText: string
  pinned: boolean
  archived: boolean
  wordCount: number
  createdById: string | null
  updatedById: string | null
  createdAt: Date
  updatedAt: Date
}

export type PageListItem = {
  id: string
  title: string
  visibility: PageVisibility
  pinned: boolean
  contentText: string
  wordCount: number
  updatedAt: Date
  updatedByName: string | null
  childCount: number
  commentCount: number
  tags: Array<string>
  canEdit: boolean
}

export type SharedPageListItem = {
  id: string
  title: string
  contentText: string
  wordCount: number
  updatedAt: Date
  updatedByName: string | null
  permission: "VIEW" | "EDIT"
}

export type PageTreeLeaf = { id: string; title: string }
export type PageTreeChild = {
  id: string
  title: string
  children: Array<PageTreeLeaf>
}
export type PageTreeNode = {
  id: string
  title: string
  pinned: boolean
  visibility: PageVisibility
  children: Array<PageTreeChild>
}
export type PageTree = {
  household: Array<PageTreeNode>
  personal: Array<PageTreeNode>
  shared: Array<PageTreeNode>
}

export type EditPageData = {
  page: WikiPageRow
  createdByName: string | null
  updatedByName: string | null
  versionCount: number
  tags: Array<string>
}

// ─── Helpers (legacy slugify/countWords) ────────────────

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100) || "page"
  )
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ─── Page templates (TipTap ProseMirror JSON) ───────────
// contentText populates the search index, mirroring legacy.

type Template = { content: object; contentText: string }

const emptyParagraph = { type: "paragraph", content: [] }
const bullet = (items: Array<object>) => ({
  type: "bulletList",
  content: items.map((c) => ({ type: "listItem", content: [c] })),
})
const ordered = (count: number) => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: Array.from({ length: count }, () => ({
    type: "listItem",
    content: [emptyParagraph],
  })),
})
const heading = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
})
const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})
const headerCell = (text: string) => ({
  type: "tableHeader",
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [para(text)],
})
const emptyCell = () => ({
  type: "tableCell",
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [emptyParagraph],
})

export const TEMPLATES: Record<string, Template> = {
  "meeting-notes": {
    contentText: "Attendees Agenda Notes Action Items",
    content: {
      type: "doc",
      content: [
        heading("Attendees"),
        bullet([emptyParagraph]),
        heading("Agenda"),
        ordered(1),
        heading("Notes"),
        emptyParagraph,
        heading("Action Items"),
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [emptyParagraph],
            },
          ],
        },
      ],
    },
  },
  "how-to": {
    contentText: "Overview Prerequisites Steps Notes",
    content: {
      type: "doc",
      content: [
        heading("Overview"),
        emptyParagraph,
        heading("Prerequisites"),
        bullet([emptyParagraph]),
        heading("Steps"),
        ordered(3),
        heading("Notes"),
        emptyParagraph,
      ],
    },
  },
  emergency: {
    contentText: "Emergency Procedures Location Contacts Steps",
    content: {
      type: "doc",
      content: [
        heading("Location & Access"),
        emptyParagraph,
        heading("Emergency Contacts"),
        bullet([para("911 — Police / Fire / Medical"), emptyParagraph]),
        heading("Procedure"),
        ordered(3),
        heading("Important Locations"),
        bullet([
          para("Breaker panel: "),
          para("Water shutoff: "),
          para("Gas shutoff: "),
        ]),
      ],
    },
  },
  contacts: {
    contentText: "Name Role Phone Email Notes",
    content: {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: ["Name", "Role", "Phone", "Email", "Notes"].map(
                headerCell
              ),
            },
            {
              type: "tableRow",
              content: Array.from({ length: 5 }, emptyCell),
            },
          ],
        },
      ],
    },
  },
  recipe: {
    contentText: "Ingredients Instructions Notes",
    content: {
      type: "doc",
      content: [
        heading("Ingredients"),
        bullet([emptyParagraph, emptyParagraph, emptyParagraph]),
        heading("Instructions"),
        ordered(3),
        heading("Notes"),
        emptyParagraph,
      ],
    },
  },
}

// ─── Access checks ──────────────────────────────────────

// Edit access (legacy canEdit + household scoping). isAdmin is the instance
// ADMIN role, matching the legacy User.role check.
export async function getEditablePage(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string
): Promise<WikiPageRow | null> {
  const rows = await sql<Array<WikiPageRow>>`
    SELECT "id", "householdId", "ownerUserId", "visibility", "parentId",
           "title", "slug", "content"::text, "contentText", "pinned",
           "archived", "wordCount", "createdById", "updatedById", "createdAt",
           "updatedAt"
    FROM "WikiPage"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
      AND (
        ("visibility" = 'PRIVATE' AND "ownerUserId" = ${userId})
        OR ("visibility" <> 'PRIVATE'
            AND (${isAdmin} OR "createdById" = ${userId}))
      )`
  return rows[0] ?? null
}

// ─── Workspace list queries ─────────────────────────────

// "All pages" root list (legacy wiki index): my private pages, my household's
// pages, all public pages, and pages shared to my household.
export async function listRootPages(
  householdId: string,
  userId: string,
  isAdmin: boolean
): Promise<Array<PageListItem>> {
  return sql<Array<PageListItem>>`
    SELECT p."id", p."title", p."visibility", p."pinned", p."contentText",
           p."wordCount", p."updatedAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "updatedByName",
           (SELECT count(*)::int FROM "WikiPage" c
            WHERE c."parentId" = p."id" AND NOT c."archived") AS "childCount",
           (SELECT count(*)::int FROM "PageComment" pc
            WHERE pc."pageId" = p."id") AS "commentCount",
           COALESCE((SELECT array_agg(t."tag") FROM (
              SELECT "tag" FROM "PageTag"
              WHERE "pageId" = p."id" ORDER BY "tag" LIMIT 3) t),
            '{}') AS "tags",
           (p."householdId" = ${householdId}
            AND ((p."visibility" = 'PRIVATE' AND p."ownerUserId" = ${userId})
                 OR (p."visibility" <> 'PRIVATE'
                     AND (${isAdmin} OR p."createdById" = ${userId}))))
             AS "canEdit"
    FROM "WikiPage" p
    LEFT JOIN "User" u ON u."id" = p."updatedById"
    WHERE NOT p."archived" AND p."parentId" IS NULL
      AND (
        (p."householdId" = ${householdId}
          AND (p."visibility" <> 'PRIVATE' OR p."ownerUserId" = ${userId}))
        OR p."visibility" = 'PUBLIC'
        OR EXISTS (SELECT 1 FROM "PageShare" s
                   WHERE s."pageId" = p."id" AND s."householdId" = ${householdId})
      )
    ORDER BY p."pinned" DESC, p."updatedAt" DESC
    LIMIT 100`
}

// Personal workspace: PRIVATE pages owned by the viewer. The ownerUserId
// equality is the privacy boundary — never relax it.
export async function listPersonalPages(
  householdId: string,
  userId: string
): Promise<Array<PageListItem>> {
  return sql<Array<PageListItem>>`
    SELECT p."id", p."title", p."visibility", p."pinned", p."contentText",
           p."wordCount", p."updatedAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "updatedByName",
           (SELECT count(*)::int FROM "WikiPage" c
            WHERE c."parentId" = p."id" AND NOT c."archived") AS "childCount",
           0 AS "commentCount", '{}'::text[] AS "tags", true AS "canEdit"
    FROM "WikiPage" p
    LEFT JOIN "User" u ON u."id" = p."updatedById"
    WHERE p."householdId" = ${householdId}
      AND p."visibility" = 'PRIVATE' AND p."ownerUserId" = ${userId}
      AND NOT p."archived" AND p."parentId" IS NULL
    ORDER BY p."pinned" DESC, p."updatedAt" DESC`
}

// Shared workspace: root pages other households shared with mine.
export async function listSharedPages(
  householdId: string
): Promise<Array<SharedPageListItem>> {
  return sql<Array<SharedPageListItem>>`
    SELECT p."id", p."title", p."contentText", p."wordCount", p."updatedAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "updatedByName",
           s."permission"
    FROM "PageShare" s
    JOIN "WikiPage" p ON p."id" = s."pageId"
    LEFT JOIN "User" u ON u."id" = p."updatedById"
    WHERE s."householdId" = ${householdId}
      AND NOT p."archived" AND p."parentId" IS NULL
    ORDER BY p."updatedAt" DESC`
}

// Public workspace: every PUBLIC root page across all households (legacy
// semantics — PUBLIC means visible to all signed-in users).
export async function listPublicPages(
  householdId: string,
  userId: string,
  isAdmin: boolean
): Promise<Array<PageListItem>> {
  return sql<Array<PageListItem>>`
    SELECT p."id", p."title", p."visibility", p."pinned", p."contentText",
           p."wordCount", p."updatedAt",
           btrim(u."firstName" || ' ' || u."lastName") AS "updatedByName",
           (SELECT count(*)::int FROM "WikiPage" c
            WHERE c."parentId" = p."id" AND NOT c."archived") AS "childCount",
           0 AS "commentCount", '{}'::text[] AS "tags",
           (p."householdId" = ${householdId}
            AND (${isAdmin} OR p."createdById" = ${userId})) AS "canEdit"
    FROM "WikiPage" p
    LEFT JOIN "User" u ON u."id" = p."updatedById"
    WHERE p."visibility" = 'PUBLIC' AND NOT p."archived"
      AND p."parentId" IS NULL
    ORDER BY p."pinned" DESC, p."updatedAt" DESC`
}

// ─── 3-level tree (legacy sidebar) ──────────────────────

type TreePoolRow = {
  id: string
  title: string
  parentId: string | null
  visibility: PageVisibility
  pinned: boolean
  sortOrder: number
}

function buildTree(
  pool: Array<TreePoolRow>,
  rootFilter: (row: TreePoolRow) => boolean
): Array<PageTreeNode> {
  const byParent = new Map<string, Array<TreePoolRow>>()
  for (const row of pool) {
    if (!row.parentId) continue
    const list = byParent.get(row.parentId) ?? []
    list.push(row)
    byParent.set(row.parentId, list)
  }
  const childSort = (a: TreePoolRow, b: TreePoolRow) =>
    a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
  const roots = pool
    .filter((r) => r.parentId === null && rootFilter(r))
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title)
    )
  return roots.map((root) => ({
    id: root.id,
    title: root.title,
    pinned: root.pinned,
    visibility: root.visibility,
    children: (byParent.get(root.id) ?? []).sort(childSort).map((child) => ({
      id: child.id,
      title: child.title,
      children: (byParent.get(child.id) ?? []).sort(childSort).map((gc) => ({
        id: gc.id,
        title: gc.title,
      })),
    })),
  }))
}

export async function getPageTree(
  householdId: string,
  userId: string
): Promise<PageTree> {
  const [ownPool, sharedPool] = await Promise.all([
    // Everything in my household I'm allowed to see (private = mine only).
    sql<Array<TreePoolRow>>`
      SELECT "id", "title", "parentId", "visibility", "pinned", "sortOrder"
      FROM "WikiPage"
      WHERE "householdId" = ${householdId} AND NOT "archived"
        AND ("visibility" <> 'PRIVATE' OR "ownerUserId" = ${userId})`,
    // Roots shared to my household from other households + 2 levels of
    // children (depth-bounded recursive walk, never crossing into PRIVATE).
    sql<Array<TreePoolRow>>`
      WITH RECURSIVE shared_tree AS (
        SELECT p."id", p."title", p."parentId", p."visibility", p."pinned",
               p."sortOrder", 1 AS depth
        FROM "WikiPage" p
        JOIN "PageShare" s ON s."pageId" = p."id"
        WHERE s."householdId" = ${householdId}
          AND p."householdId" <> ${householdId}
          AND NOT p."archived" AND p."parentId" IS NULL
        UNION ALL
        SELECT c."id", c."title", c."parentId", c."visibility", c."pinned",
               c."sortOrder", st.depth + 1
        FROM "WikiPage" c
        JOIN shared_tree st ON c."parentId" = st."id"
        WHERE NOT c."archived" AND c."visibility" <> 'PRIVATE'
          AND st.depth < 3
      )
      SELECT "id", "title", "parentId", "visibility", "pinned", "sortOrder"
      FROM shared_tree`,
  ])
  return {
    household: buildTree(ownPool, (r) => r.visibility !== "PRIVATE"),
    personal: buildTree(ownPool, (r) => r.visibility === "PRIVATE"),
    shared: buildTree(sharedPool, () => true),
  }
}

// ─── Edit page data ─────────────────────────────────────

export async function getEditPageData(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string
): Promise<EditPageData | null> {
  const page = await getEditablePage(householdId, userId, isAdmin, id)
  if (!page) return null
  const [names, versions, tags] = await Promise.all([
    sql<Array<{ createdByName: string | null; updatedByName: string | null }>>`
      SELECT btrim(cu."firstName" || ' ' || cu."lastName") AS "createdByName",
             btrim(uu."firstName" || ' ' || uu."lastName") AS "updatedByName"
      FROM "WikiPage" p
      LEFT JOIN "User" cu ON cu."id" = p."createdById"
      LEFT JOIN "User" uu ON uu."id" = p."updatedById"
      WHERE p."id" = ${page.id}`,
    sql<Array<{ count: number }>>`
      SELECT count(*)::int AS "count" FROM "PageVersion"
      WHERE "pageId" = ${page.id}`,
    sql<Array<{ tag: string }>>`
      SELECT "tag" FROM "PageTag" WHERE "pageId" = ${page.id}
      ORDER BY "tag"`,
  ])
  return {
    page,
    createdByName: names[0]?.createdByName ?? null,
    updatedByName: names[0]?.updatedByName ?? null,
    versionCount: versions[0]?.count ?? 0,
    tags: tags.map((t) => t.tag),
  }
}

// ─── Mutations ──────────────────────────────────────────

// Slug dedupe within the unique scope (householdId, ownerUserId, parentId) —
// matches the NULLS NOT DISTINCT unique index; appends a suffix on collision
// like the legacy app.
async function dedupeSlug(
  householdId: string,
  ownerUserId: string | null,
  parentId: string | null,
  base: string
): Promise<string> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "WikiPage"
    WHERE "householdId" = ${householdId}
      AND "ownerUserId" IS NOT DISTINCT FROM ${ownerUserId}
      AND "parentId" IS NOT DISTINCT FROM ${parentId}
      AND "slug" = ${base}`
  return existing.length > 0 ? `${base}-${Date.now().toString(36)}` : base
}

export type CreatePageInput = {
  title: string
  visibility: "PRIVATE" | "HOUSEHOLD" | "PUBLIC"
  parentId: string | null
  template: string | null
}

export async function createPage(
  householdId: string,
  userId: string,
  input: CreatePageInput
): Promise<{ id: string } | { error: string }> {
  let visibility: PageVisibility = input.visibility
  let ownerUserId = visibility === "PRIVATE" ? userId : null

  if (input.parentId) {
    // Sub-pages inherit the parent's workspace (legacy passed the parent's
    // visibility along; here it is enforced server-side). The parent must be
    // visible to the creator within their own household.
    const parents = await sql<
      Array<{
        id: string
        parentId: string | null
        visibility: PageVisibility
        ownerUserId: string | null
      }>
    >`
      SELECT "id", "parentId", "visibility", "ownerUserId" FROM "WikiPage"
      WHERE "id" = ${input.parentId} AND "householdId" = ${householdId}
        AND ("visibility" <> 'PRIVATE' OR "ownerUserId" = ${userId})`
    const parent = parents[0]
    if (!parent) return { error: "Parent page not found." }
    if (parent.parentId) {
      const gps = await sql<Array<{ parentId: string | null }>>`
        SELECT "parentId" FROM "WikiPage" WHERE "id" = ${parent.parentId}`
      if (gps[0]?.parentId) {
        return { error: "Pages can only be nested 3 levels deep." }
      }
    }
    visibility = parent.visibility
    ownerUserId = parent.ownerUserId
  }

  const slug = await dedupeSlug(
    householdId,
    ownerUserId,
    input.parentId,
    slugify(input.title)
  )

  const tpl = input.template ? (TEMPLATES[input.template] ?? null) : null
  const content = JSON.stringify(tpl?.content ?? {})
  const contentText = tpl?.contentText ?? ""

  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "WikiPage" (
      "householdId", "ownerUserId", "visibility", "parentId", "title", "slug",
      "content", "contentText", "wordCount", "createdById", "updatedById"
    ) VALUES (
      ${householdId}, ${ownerUserId}, ${visibility}::"PageVisibility",
      ${input.parentId}, ${input.title}, ${slug}, ${content}::jsonb,
      ${contentText}, ${tpl ? countWords(tpl.contentText) : 0},
      ${userId}, ${userId}
    ) RETURNING "id"`
  return { id: rows[0].id }
}

// Snapshot the pre-update state into "PageVersion" on every save (legacy
// rule), then apply the update.
export async function updatePage(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string,
  title: string,
  content: object,
  contentText: string
): Promise<{ ok: true } | { error: string }> {
  const page = await getEditablePage(householdId, userId, isAdmin, id)
  if (!page) return { error: "Page not found." }

  const versionCount = await sql<Array<{ count: number }>>`
    SELECT count(*)::int AS "count" FROM "PageVersion"
    WHERE "pageId" = ${page.id}`
  await sql`
    INSERT INTO "PageVersion"
      ("pageId", "version", "title", "content", "editedById", "wordCount")
    VALUES (${page.id}, ${(versionCount[0]?.count ?? 0) + 1}, ${page.title},
            ${page.content}::jsonb,
            ${page.updatedById}, ${page.wordCount})`

  await sql`
    UPDATE "WikiPage" SET
      "title" = ${title},
      "content" = ${JSON.stringify(content)}::jsonb,
      "contentText" = ${contentText},
      "wordCount" = ${countWords(contentText)},
      "updatedById" = ${userId},
      "updatedAt" = now()
    WHERE "id" = ${page.id} AND "householdId" = ${householdId}`
  return { ok: true }
}

export async function deletePage(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string
): Promise<boolean> {
  // Edit conditions inlined into the DELETE itself (ADR-0005); children,
  // versions, comments, tags and shares cascade.
  const rows = await sql<Array<{ id: string }>>`
    DELETE FROM "WikiPage"
    WHERE "id" = ${id} AND "householdId" = ${householdId}
      AND (("visibility" = 'PRIVATE' AND "ownerUserId" = ${userId})
           OR ("visibility" <> 'PRIVATE'
               AND (${isAdmin} OR "createdById" = ${userId})))
    RETURNING "id"`
  return rows.length > 0
}

export async function togglePin(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "WikiPage"
    SET "pinned" = NOT "pinned", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
      AND (("visibility" = 'PRIVATE' AND "ownerUserId" = ${userId})
           OR ("visibility" <> 'PRIVATE'
               AND (${isAdmin} OR "createdById" = ${userId})))
    RETURNING "id"`
  return rows.length > 0
}

export async function toggleArchive(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    UPDATE "WikiPage"
    SET "archived" = NOT "archived", "updatedAt" = now()
    WHERE "id" = ${id} AND "householdId" = ${householdId}
      AND (("visibility" = 'PRIVATE' AND "ownerUserId" = ${userId})
           OR ("visibility" <> 'PRIVATE'
               AND (${isAdmin} OR "createdById" = ${userId})))
    RETURNING "id"`
  return rows.length > 0
}

// Re-parent a page. Validates edit rights, workspace compatibility, the
// 3-level depth bound (counting the page's own subtree height) and cycles,
// then re-dedupes the slug in the new scope.
export async function movePage(
  householdId: string,
  userId: string,
  isAdmin: boolean,
  id: string,
  newParentId: string | null
): Promise<{ ok: true } | { error: string }> {
  const page = await getEditablePage(householdId, userId, isAdmin, id)
  if (!page) return { error: "Page not found." }
  if (newParentId === page.parentId) return { ok: true }
  if (newParentId === page.id) {
    return { error: "A page cannot be its own parent." }
  }

  // Subtree height: 1 = leaf, 2 = has children, 3 = has grandchildren.
  const depthRows = await sql<
    Array<{ hasChildren: boolean; hasGrandchildren: boolean }>
  >`
    SELECT EXISTS (SELECT 1 FROM "WikiPage" c
                   WHERE c."parentId" = ${page.id}) AS "hasChildren",
           EXISTS (SELECT 1 FROM "WikiPage" gc
                   JOIN "WikiPage" c ON c."id" = gc."parentId"
                   WHERE c."parentId" = ${page.id}) AS "hasGrandchildren"`
  const subtreeHeight = depthRows[0]?.hasGrandchildren
    ? 3
    : depthRows[0]?.hasChildren
      ? 2
      : 1

  let parentDepth = 0
  if (newParentId) {
    const parents = await sql<
      Array<{
        id: string
        parentId: string | null
        visibility: PageVisibility
        ownerUserId: string | null
      }>
    >`
      SELECT "id", "parentId", "visibility", "ownerUserId" FROM "WikiPage"
      WHERE "id" = ${newParentId} AND "householdId" = ${householdId}
        AND ("visibility" <> 'PRIVATE' OR "ownerUserId" = ${userId})`
    const parent = parents[0]
    if (!parent) return { error: "Target page not found." }

    // A private page stays in the owner's private tree; a non-private page
    // cannot be nested under someone's private page.
    if (page.visibility === "PRIVATE") {
      if (parent.visibility !== "PRIVATE" || parent.ownerUserId !== userId) {
        return {
          error:
            "Private pages can only be nested under your own private pages.",
        }
      }
    } else if (parent.visibility === "PRIVATE") {
      return { error: "Cannot move a shared page under a private page." }
    }

    // Walk up the (≤3-level) ancestor chain: compute depth + detect cycles.
    parentDepth = 1
    let cursorParentId = parent.parentId
    if (cursorParentId === page.id) {
      return { error: "Cannot move a page into its own sub-pages." }
    }
    while (cursorParentId) {
      parentDepth += 1
      const next = await sql<Array<{ parentId: string | null }>>`
        SELECT "parentId" FROM "WikiPage" WHERE "id" = ${cursorParentId}`
      cursorParentId = next[0]?.parentId ?? null
      if (cursorParentId === page.id) {
        return { error: "Cannot move a page into its own sub-pages." }
      }
    }
  }

  if (parentDepth + subtreeHeight > 3) {
    return { error: "Pages can only be nested 3 levels deep." }
  }

  const slug = await dedupeSlug(
    householdId,
    page.ownerUserId,
    newParentId,
    page.slug
  )
  await sql`
    UPDATE "WikiPage"
    SET "parentId" = ${newParentId}, "slug" = ${slug}, "updatedAt" = now()
    WHERE "id" = ${page.id} AND "householdId" = ${householdId}`
  return { ok: true }
}
