import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addComment,
  addTag,
  canEditPage,
  deleteComment,
  getAccessiblePage,
  getBreadcrumbs,
  getComment,
  getPageView,
  householdExists,
  listChildPages,
  listComments,
  listShareCandidates,
  listShares,
  listTags,
  listVersions,
  markPageShared,
  removeShare,
  removeTag,
  threadComments,
  upsertShare,
} from "./collab"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Page view (content + collaboration data) ───────────

export const getWikiPageViewFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1).max(64) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!UUID_RE.test(data.id)) return null
    // [security] Access check is inside getPageView's WHERE clause — a page
    // outside the caller's reach is indistinguishable from a missing one.
    const page = await getPageView(
      context.householdId,
      context.user.id,
      data.id
    )
    if (!page) return null
    const canEdit = canEditPage(
      page,
      context.user.id,
      context.user.role,
      context.householdId
    )
    const [crumbs, children, comments, tags, shares, versions, candidates] =
      await Promise.all([
        page.parentId ? getBreadcrumbs(page.parentId) : Promise.resolve([]),
        listChildPages(context.householdId, context.user.id, page.id),
        listComments(page.id),
        listTags(page.id),
        listShares(page.id),
        listVersions(page.id),
        listShareCandidates(page.id, context.householdId),
      ])
    return {
      page,
      crumbs,
      children,
      comments: threadComments(comments),
      tags,
      shares,
      versions,
      availableHouseholds: canEdit ? candidates : [],
      canEdit,
      viewer: {
        id: context.user.id,
        name: context.user.name,
        isAdmin: context.user.role === "ADMIN",
      },
    }
  })

// ─── Comments ───────────────────────────────────────────

const addCommentSchema = z.object({
  pageId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  parentId: z.string().uuid().nullable(),
})

export const addCommentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => addCommentSchema.parse(d))
  .handler(async ({ data, context }) => {
    // [security] Legacy addCommentAction had NO page-access check — any
    // authenticated user could comment on any pageId. Verify access first
    // (ADR-0005 tenancy invariant).
    const page = await getAccessiblePage(
      context.householdId,
      context.user.id,
      data.pageId
    )
    if (!page) return { error: "Page not found." }
    const result = await addComment(
      page.id,
      context.user.id,
      data.parentId,
      data.message
    )
    if (result.error) return { error: result.error }
    return { ok: true as const }
  })

export const deleteCommentFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const comment = await getComment(data.id)
    if (!comment) return { error: "Comment not found." }
    // [security] Verify the caller can access the comment's page before any
    // further reasoning about it (shared access-check invariant).
    const page = await getAccessiblePage(
      context.householdId,
      context.user.id,
      comment.pageId
    )
    if (!page) return { error: "Comment not found." }
    // Legacy rule: only the comment author or an instance ADMIN may delete.
    if (comment.userId !== context.user.id && context.user.role !== "ADMIN") {
      return { error: "You can only delete your own comments." }
    }
    await deleteComment(comment.id)
    return { ok: true as const }
  })

// ─── Tags ───────────────────────────────────────────────

const tagSchema = z.object({
  pageId: z.string().uuid(),
  tag: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .transform((v) => v.toLowerCase()),
})

export const addTagFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => tagSchema.parse(d))
  .handler(async ({ data, context }) => {
    // [security] Access + edit check before mutating tags (shared
    // access-check invariant; legacy only checked canEdit, which already
    // implied access — kept, plus the unified access gate).
    const page = await getAccessiblePage(
      context.householdId,
      context.user.id,
      data.pageId
    )
    if (!page) return { error: "Page not found." }
    if (
      !canEditPage(
        page,
        context.user.id,
        context.user.role,
        context.householdId
      )
    ) {
      return { error: "You don't have permission to edit this page." }
    }
    await addTag(page.id, data.tag)
    return { ok: true as const }
  })

export const removeTagFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => tagSchema.parse(d))
  .handler(async ({ data, context }) => {
    const page = await getAccessiblePage(
      context.householdId,
      context.user.id,
      data.pageId
    )
    if (!page) return { error: "Page not found." }
    if (
      !canEditPage(
        page,
        context.user.id,
        context.user.role,
        context.householdId
      )
    ) {
      return { error: "You don't have permission to edit this page." }
    }
    await removeTag(page.id, data.tag)
    return { ok: true as const }
  })

// ─── Shares ─────────────────────────────────────────────

const shareSchema = z.object({
  pageId: z.string().uuid(),
  householdId: z.string().uuid(),
  permission: z.enum(["VIEW", "EDIT"]),
})

export const sharePageFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => shareSchema.parse(d))
  .handler(async ({ data, context }) => {
    const page = await getAccessiblePage(
      context.householdId,
      context.user.id,
      data.pageId
    )
    if (!page) return { error: "Page not found." }
    if (
      !canEditPage(
        page,
        context.user.id,
        context.user.role,
        context.householdId
      )
    ) {
      return { error: "You don't have permission to share this page." }
    }
    if (page.visibility === "PRIVATE") {
      return { error: "Private pages cannot be shared." }
    }
    if (data.householdId === page.householdId) {
      return { error: "That household already owns this page." }
    }
    // [security] Legacy sharePageAction never validated the grantee household
    // existed — validate and return { error } instead of inserting a dangling
    // grant (the FK would reject it with an unhandled 500).
    if (!(await householdExists(data.householdId))) {
      return { error: "Household not found." }
    }
    await upsertShare(
      page.id,
      data.householdId,
      data.permission,
      context.user.id
    )
    await markPageShared(page.id)
    return { ok: true as const }
  })

export const removeShareFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ pageId: z.string().uuid(), householdId: z.string().uuid() })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    // [security] Legacy removeShareAction had NO ownership check — any
    // authenticated user could revoke any share. Require page access + edit
    // permission (shared access-check invariant).
    const page = await getAccessiblePage(
      context.householdId,
      context.user.id,
      data.pageId
    )
    if (!page) return { error: "Page not found." }
    if (
      !canEditPage(
        page,
        context.user.id,
        context.user.role,
        context.householdId
      )
    ) {
      return { error: "You don't have permission to manage sharing." }
    }
    await removeShare(page.id, data.householdId)
    return { ok: true as const }
  })
