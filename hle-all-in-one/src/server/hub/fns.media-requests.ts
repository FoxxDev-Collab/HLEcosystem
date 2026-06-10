import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { authMiddleware } from "@/server/middleware"
import {
  addMediaRequestComment,
  createMediaRequest,
  deleteMediaRequest,
  getMediaRequestRequesterId,
  listMediaRequestComments,
  listMediaRequests,
  setMediaRequestStatus,
} from "./media-requests"

// Media requests are cross-household by design (any authenticated user sees
// and can act on all requests) — authMiddleware, NOT householdMiddleware.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const id = z.string().regex(UUID_RE)
const optionalText = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null)

export const getMediaRequestsPageFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [requests, comments] = await Promise.all([
      listMediaRequests(),
      listMediaRequestComments(),
    ])
    return {
      requests: requests.map((r) => ({
        ...r,
        comments: comments.filter((c) => c.requestId === r.id),
      })),
      currentUserId: context.user.id,
      isAdmin: context.user.role === "ADMIN",
    }
  })

const createSchema = z.object({
  mediaType: z.enum(["MOVIE", "TV_SHOW", "MUSIC"]),
  title: z.string().trim().min(1).max(300),
  artist: optionalText,
  year: z.number().int().min(1900).max(2099).nullable(),
  notes: optionalText,
})

export const createMediaRequestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await createMediaRequest(context.user.id, data)
    return { ok: true as const }
  })

// Legacy rule: every authenticated user can complete or reopen a request.
export const updateMediaRequestStatusFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id, status: z.enum(["REQUESTED", "COMPLETED"]) }).parse(d)
  )
  .handler(async ({ data }) => {
    await setMediaRequestStatus(data.id, data.status)
    return { ok: true as const }
  })

export const addMediaCommentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ requestId: id, message: z.string().trim().min(1).max(2000) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const ok = await addMediaRequestComment(
      data.requestId,
      context.user.id,
      data.message
    )
    if (!ok) return { error: "Request not found." }
    return { ok: true as const }
  })

// Legacy rule: only the requester or an instance admin can delete.
export const deleteMediaRequestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const requesterId = await getMediaRequestRequesterId(data.id)
    if (!requesterId) return { error: "Request not found." }
    if (requesterId !== context.user.id && context.user.role !== "ADMIN") {
      return { error: "Only the requester or an admin can delete a request." }
    }
    await deleteMediaRequest(data.id)
    return { ok: true as const }
  })
