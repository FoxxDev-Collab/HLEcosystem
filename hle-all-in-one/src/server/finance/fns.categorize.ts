import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { isAiConfigured } from "./claude-api"
import { listCategoriesForPicker } from "./categories"
import {
  applyCategory,
  bulkApplyCategories,
  bulkSuggestCategories,
  listUncategorized,
} from "./categorize"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const getCategorizePageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [{ transactions, totalCount }, categories] = await Promise.all([
      listUncategorized(context.householdId),
      listCategoriesForPicker(context.householdId),
    ])
    return {
      transactions,
      totalCount,
      categories,
      aiConfigured: isAiConfigured(),
    }
  })

export const bulkSuggestCategoriesFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionIds: z.array(z.string().regex(UUID_RE)).max(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    bulkSuggestCategories(context.householdId, data.transactionIds)
  )

export const applyCategoryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().regex(UUID_RE),
        categoryId: z.string().regex(UUID_RE),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    applyCategory(context.householdId, data.transactionId, data.categoryId)
  )

export const bulkApplyCategoriesFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        assignments: z
          .array(
            z.object({
              transactionId: z.string().regex(UUID_RE),
              categoryId: z.string().regex(UUID_RE),
            })
          )
          .max(100),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    bulkApplyCategories(context.householdId, data.assignments)
  )
