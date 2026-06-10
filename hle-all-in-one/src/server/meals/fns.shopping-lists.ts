// Server fns for local shopping lists: index, detail (with the shopping
// strategy — best store per item, pantry coverage), item CRUD, pantry
// stocking, and the AI "smart list" generator.
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  addListItem,
  buildBestPriceMap,
  createShoppingList,
  deleteShoppingList,
  duplicateShoppingList,
  getShoppingList,
  latestPricesForList,
  listActiveProducts,
  listActiveStores,
  listItemsForList,
  listPantryItemsWithProduct,
  listShoppingLists,
  pantryQuantities,
  productBelongsToHousehold,
  removeListItem,
  stockPantryFromCheckedItems,
  toggleListItem,
  touchShoppingList,
  updateListStatus,
} from "./shopping-lists"
import {
  PRODUCT_UNITS,
  findOrCreateProduct,
  loadProductLookup,
  mapUnit,
} from "./ingredients"
import type { ProductUnit } from "./ingredients"
import { getMealPlan, getMealieConfig, getRecipe, getWeekRange } from "./mealie"
import { isAiConfigured, optimizeShoppingList } from "./claude-api"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idSchema = z.object({ id: z.string().regex(UUID_RE) })

const optText = z
  .string()
  .max(2000)
  .transform((v) => v.trim() || null)

const unitSchema = z
  .string()
  .transform((v) => v.trim() || null)
  .refine((v) => v === null || (PRODUCT_UNITS as Array<string>).includes(v), {
    message: "Invalid unit",
  })
  .transform((v) => v as ProductUnit | null)

// ── Index ───────────────────────────────────────────────

export const getShoppingListsPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => listShoppingLists(context.householdId))

export const createListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({ name: z.string().trim().min(1).max(200), notes: optText })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const id = await createShoppingList(
      context.householdId,
      data.name,
      "DRAFT",
      data.notes
    )
    return { ok: true as const, id }
  })

export const updateListStatusFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().regex(UUID_RE),
        status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const updated = await updateListStatus(
      context.householdId,
      data.id,
      data.status
    )
    if (!updated) return { error: "List not found." }
    return { ok: true as const }
  })

export const deleteListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const deleted = await deleteShoppingList(context.householdId, data.id)
    if (!deleted) return { error: "List not found." }
    return { ok: true as const }
  })

export const duplicateListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const newId = await duplicateShoppingList(context.householdId, data.id)
    if (!newId) return { error: "List not found." }
    return { ok: true as const, id: newId }
  })

// ── Detail ──────────────────────────────────────────────

export const getShoppingListPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const list = await getShoppingList(context.householdId, data.id)
    if (!list) return null
    const [items, products, stores, latestPrices, pantryMap] =
      await Promise.all([
        listItemsForList(context.householdId, data.id),
        listActiveProducts(context.householdId),
        listActiveStores(context.householdId),
        latestPricesForList(context.householdId, data.id),
        pantryQuantities(context.householdId),
      ])
    const bestPrices = Object.fromEntries(buildBestPriceMap(latestPrices))
    const pantry = Object.fromEntries(pantryMap)
    return { list, items, products, stores, bestPrices, pantry }
  })

export const addListItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        listId: z.string().regex(UUID_RE),
        productId: z.string().regex(UUID_RE),
        quantity: z.number().min(0).max(100000),
        unit: unitSchema,
        notes: optText,
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    // Re-verify ownership of both foreign ids (ADR-0005).
    const [list, productOwned] = await Promise.all([
      getShoppingList(context.householdId, data.listId),
      productBelongsToHousehold(context.householdId, data.productId),
    ])
    if (!list) return { error: "List not found." }
    if (!productOwned) return { error: "Product not found." }

    await addListItem(
      data.listId,
      data.productId,
      data.quantity || 1,
      data.unit,
      data.notes,
      list.itemCount
    )
    await touchShoppingList(data.listId)
    return { ok: true as const }
  })

export const toggleListItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const toggled = await toggleListItem(context.householdId, data.id)
    if (!toggled) return { error: "Item not found." }
    return { ok: true as const }
  })

export const removeListItemFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const removed = await removeListItem(context.householdId, data.id)
    if (!removed) return { error: "Item not found." }
    return { ok: true as const }
  })

// "Stock Pantry from Checked Items" — checked items top up the pantry.
export const stockPantryFromListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ listId: z.string().regex(UUID_RE) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const list = await getShoppingList(context.householdId, data.listId)
    if (!list) return { error: "List not found." }
    const stocked = await stockPantryFromCheckedItems(
      context.householdId,
      data.listId
    )
    return { ok: true as const, stocked }
  })

// ── AI smart list generator ─────────────────────────────

export const getGeneratePageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const config = await getMealieConfig(context.householdId)
    return { mealieConnected: !!config, aiConfigured: isAiConfigured() }
  })

// Fetches this week's meal plan, subtracts the pantry, and asks the AI
// gateway for an optimized list. Degrades gracefully when AI is unconfigured.
export const generateShoppingListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) {
      return { error: "Mealie is not connected. Configure it in Settings." }
    }
    if (!isAiConfigured()) {
      return { error: "AI features not configured" }
    }

    const { startDate, endDate } = getWeekRange()
    const mealPlan = await getMealPlan(context.householdId, startDate, endDate)
    if (mealPlan.length === 0) {
      return {
        error:
          "No meals planned for this week. Add recipes to your Mealie meal plan first.",
      }
    }

    const recipeIds = [
      ...new Set(
        mealPlan
          .map((m) => m.recipeId)
          .filter((id): id is string => id !== null)
      ),
    ]
    const recipes: Array<{ name: string; ingredients: Array<string> }> = []
    for (const recipeId of recipeIds) {
      try {
        const recipe = await getRecipe(context.householdId, recipeId)
        recipes.push({
          name: recipe.name,
          ingredients: recipe.recipeIngredient
            .map((i) => i.display)
            .filter((d) => d.trim().length > 0),
        })
      } catch {
        // Skip recipes that fail to load.
      }
    }
    if (recipes.length === 0) {
      return { error: "Could not load recipe details from Mealie." }
    }

    const [pantryItems, stores] = await Promise.all([
      listPantryItemsWithProduct(context.householdId, true),
      listActiveStores(context.householdId),
    ])

    const result = await optimizeShoppingList(
      recipes,
      pantryItems.map((p) => ({
        name: p.productName,
        quantity: p.quantity,
        unit: p.unit,
      })),
      stores.map((s) => s.name)
    )
    if (!result.success || !result.data) {
      return { error: result.error ?? "Failed to generate shopping list" }
    }

    return {
      items: result.data.items,
      tips: result.data.tips,
      recipesUsed: recipes.map((r) => r.name),
    }
  })

export const createListFromAiFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        items: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(300),
              quantity: z.union([z.number(), z.string().max(50)]),
              unit: z.string().max(100).nullable(),
            })
          )
          .min(1)
          .max(500),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const listId = await createShoppingList(
      context.householdId,
      data.name,
      "ACTIVE",
      null
    )
    const lookup = await loadProductLookup(context.householdId)
    let sortOrder = 0
    for (const item of data.items) {
      const productId = await findOrCreateProduct(
        context.householdId,
        item.name,
        item.name.toLowerCase(),
        lookup
      )
      const qty =
        typeof item.quantity === "string"
          ? parseFloat(item.quantity) || 1
          : item.quantity
      await addListItem(
        listId,
        productId,
        qty,
        item.unit ? mapUnit(item.unit) : null,
        null,
        sortOrder++
      )
    }
    return { ok: true as const, id: listId }
  })
