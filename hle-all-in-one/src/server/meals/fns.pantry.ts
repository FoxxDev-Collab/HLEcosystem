import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import { PRODUCT_UNITS, getProductBasic } from "./products"
import {
  addPantryItem,
  adjustPantryQuantity,
  countPantryItems,
  getPantryStats,
  listActiveListsWithChecked,
  listAvailableProducts,
  listPantryItems,
  removePantryItem,
  setPantryExpiration,
  setPantryMin,
  setPantryQuantity,
  stockFromList,
} from "./pantry"

// Empty form fields mean NULL.
const optDate = z
  .string()
  .max(10)
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Invalid date",
  })

const idSchema = z.object({ id: z.string().min(1) })

// ─── Pantry list (the legacy GET /api/pantry/list route) ─

const pantryQuerySchema = z.object({
  q: z
    .string()
    .max(200)
    .optional()
    .transform((v) => v?.trim() || null),
  filter: z
    .enum(["all", "in-stock", "low-stock", "out-of-stock", "expiring"])
    .default("all"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
  sort: z.enum(["name", "quantity", "expiration"]).default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
})

export const getPantryFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => pantryQuerySchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { q, filter, page, limit, sort, dir } = data
    const offset = (page - 1) * limit
    const [items, totalCount, stats, availableProducts, activeLists] =
      await Promise.all([
        listPantryItems(context.householdId, {
          q,
          filter,
          sort,
          dir,
          limit,
          offset,
        }),
        countPantryItems(context.householdId, { q, filter }),
        getPantryStats(context.householdId),
        listAvailableProducts(context.householdId),
        listActiveListsWithChecked(context.householdId),
      ])
    return {
      items,
      totalCount,
      page,
      pageCount: Math.max(1, Math.ceil(totalCount / limit)),
      stats,
      availableProducts,
      activeLists,
    }
  })

// ─── Pantry mutations ───────────────────────────────────

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().min(0).max(9999999),
  unit: z.enum(PRODUCT_UNITS).nullable(),
  minQuantity: z.number().min(0).max(9999999).nullable(),
  expiresAt: optDate,
})

export const addToPantryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    // PantryItem has its own householdId but productId comes from the client
    // — re-verify the product's ownership first (ADR-0005).
    const product = await getProductBasic(context.householdId, data.productId)
    if (!product) return { error: "Product not found." }
    const added = await addPantryItem(
      context.householdId,
      data.productId,
      data.quantity,
      data.unit ?? product.defaultUnit,
      data.minQuantity,
      data.expiresAt
    )
    // UNIQUE ("productId") — duplicate adds surface as { error }.
    if (!added) return { error: "That product is already in the pantry." }
    return { ok: true as const }
  })

export const setPantryQuantityFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    idSchema.extend({ quantity: z.number().min(0).max(9999999) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await setPantryQuantity(
      context.householdId,
      data.id,
      data.quantity
    )
    if (!updated) return { error: "Pantry item not found." }
    return { ok: true as const }
  })

export const adjustPantryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    idSchema.extend({ amount: z.number().min(-9999999).max(9999999) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await adjustPantryQuantity(
      context.householdId,
      data.id,
      data.amount
    )
    if (!updated) return { error: "Pantry item not found." }
    return { ok: true as const }
  })

export const setPantryMinFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    idSchema
      .extend({ minQuantity: z.number().min(0).max(9999999).nullable() })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await setPantryMin(
      context.householdId,
      data.id,
      data.minQuantity
    )
    if (!updated) return { error: "Pantry item not found." }
    return { ok: true as const }
  })

export const setPantryExpirationFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    idSchema.extend({ expiresAt: optDate }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await setPantryExpiration(
      context.householdId,
      data.id,
      data.expiresAt
    )
    if (!updated) return { error: "Pantry item not found." }
    return { ok: true as const }
  })

export const removeFromPantryFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const removed = await removePantryItem(context.householdId, data.id)
    if (!removed) return { error: "Pantry item not found." }
    return { ok: true as const }
  })

export const stockFromListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ listId: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const ok = await stockFromList(context.householdId, data.listId)
    if (!ok) return { error: "Shopping list not found." }
    return { ok: true as const }
  })
