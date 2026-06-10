import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  TEMPLATES,
  createPage,
  deletePage,
  getEditPageData,
  getPageTree,
  listPersonalPages,
  listPublicPages,
  listRootPages,
  listSharedPages,
  movePage,
  toggleArchive,
  togglePin,
  updatePage,
} from "./pages"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idSchema = z.object({ id: z.string().regex(UUID_RE) })

// ─── Page list / tree loaders ───────────────────────────

export const getPagesIndexFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const isAdmin = context.user.role === "ADMIN"
    const [pages, tree] = await Promise.all([
      listRootPages(context.householdId, context.user.id, isAdmin),
      getPageTree(context.householdId, context.user.id),
    ])
    return { pages, tree }
  })

export const getPersonalPagesFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) =>
    listPersonalPages(context.householdId, context.user.id)
  )

export const getSharedPagesFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listSharedPages(context.householdId))

export const getPublicPagesFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) =>
    listPublicPages(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN"
    )
  )

// ─── Edit page loader ───────────────────────────────────

export const getPageForEditFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    getEditPageData(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN",
      data.id
    )
  )

// ─── Mutations ──────────────────────────────────────────

const createSchema = z.object({
  title: z.string().trim().min(1).max(300),
  visibility: z.enum(["PRIVATE", "HOUSEHOLD", "PUBLIC"]),
  parentId: z.string().regex(UUID_RE).nullable(),
  template: z
    .string()
    .max(40)
    .nullable()
    .refine((v) => v === null || v in TEMPLATES, {
      message: "Unknown template",
    }),
})

export const createPageFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) =>
    createPage(context.householdId, context.user.id, data)
  )

// Content arrives as a JSON string (mirrors the legacy FormData flow) so its
// size can be bounded before parsing: 2 MB covers inline base64 images.
const MAX_CONTENT_BYTES = 2 * 1024 * 1024

const updateSchema = z.object({
  id: z.string().regex(UUID_RE),
  title: z.string().trim().min(1).max(300),
  content: z.string().max(MAX_CONTENT_BYTES),
  contentText: z.string().max(MAX_CONTENT_BYTES),
})

export const updatePageFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    let content: object
    try {
      const parsed: unknown = JSON.parse(data.content)
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return { error: "Invalid page content." }
      }
      content = parsed
    } catch {
      return { error: "Invalid page content." }
    }
    return updatePage(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN",
      data.id,
      data.title,
      content,
      data.contentText
    )
  })

export const deletePageFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deletePage(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN",
      data.id
    )
    if (!deleted) return { error: "Page not found." }
    return { ok: true as const }
  })

export const togglePinFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await togglePin(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN",
      data.id
    )
    if (!toggled) return { error: "Page not found." }
    return { ok: true as const }
  })

export const toggleArchiveFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleArchive(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN",
      data.id
    )
    if (!toggled) return { error: "Page not found." }
    return { ok: true as const }
  })

const moveSchema = z.object({
  id: z.string().regex(UUID_RE),
  parentId: z.string().regex(UUID_RE).nullable(),
})

export const movePageFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => moveSchema.parse(d))
  .handler(async ({ data, context }) =>
    movePage(
      context.householdId,
      context.user.id,
      context.user.role === "ADMIN",
      data.id,
      data.parentId
    )
  )
