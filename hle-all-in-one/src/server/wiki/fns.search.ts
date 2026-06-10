import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { listPopularTags, searchPages, searchPagesByTag } from "./search"
import type { WikiSearchResult } from "./search"

const searchSchema = z.object({
  q: z.string().max(200).optional(),
  tag: z.string().max(100).optional(),
})

export const getWikiSearchFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => searchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tag = data.tag?.trim().toLowerCase() || null
    const q = data.q?.trim() || null
    let results: Array<WikiSearchResult> = []
    if (tag) {
      results = await searchPagesByTag(
        context.householdId,
        context.user.id,
        tag
      )
    } else if (q) {
      results = await searchPages(context.householdId, context.user.id, q)
    }
    const popularTags = await listPopularTags(
      context.householdId,
      context.user.id
    )
    return { results, popularTags }
  })
