import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  createCategory,
  createCategoryRule,
  deleteCategoryRule,
  listCategories,
  listCategoriesForPicker,
  listCategoryRules,
  seedDefaultCategories,
  setCategoryArchived,
  updateCategory,
} from "./categories"

const CATEGORY_TYPE = z.enum(["INCOME", "EXPENSE", "TRANSFER"])
const RULE_MATCH_TYPE = z.enum(["CONTAINS", "STARTS_WITH", "EXACT", "REGEX"])

const optText = z
  .string()
  .max(200)
  .transform((v) => v.trim() || null)

export const getCategoriesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const [categories, rules] = await Promise.all([
      listCategories(context.householdId),
      listCategoryRules(context.householdId),
    ])
    return { categories, rules }
  })

// Picker fn for other modules' forms (transactions, budgets, bills,
// categorize, import, bridges).
export const listCategoriesForPickerFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listCategoriesForPicker(context.householdId))

export const createCategoryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        type: CATEGORY_TYPE,
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable(),
        icon: optText,
        parentCategoryId: z.string().min(1).nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createCategory(context.householdId, data)
  )

export const updateCategoryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(100),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    updateCategory(context.householdId, data.id, data.name, data.color)
  )

export const toggleCategoryArchivedFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1), isArchived: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await setCategoryArchived(context.householdId, data.id, data.isArchived)
    return { ok: true as const }
  })

export const seedDefaultCategoriesFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => seedDefaultCategories(context.householdId))

export const createCategoryRuleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        pattern: z.string().trim().min(1).max(200),
        matchType: RULE_MATCH_TYPE,
        categoryId: z.string().min(1),
        assignPayee: optText,
        priority: z.number().int().min(0).max(1000),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) =>
    createCategoryRule(context.householdId, data)
  )

export const deleteCategoryRuleFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await deleteCategoryRule(context.householdId, data.id)
    return { ok: true as const }
  })
