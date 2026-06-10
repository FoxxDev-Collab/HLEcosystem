// Server fns for the Mealie integration pages: meal-plan calendar, recipe
// browser/detail, "what can I cook", Mealie shopping lists + merge, and the
// interactive sync-review flow. The Mealie apiToken never leaves the server —
// pages only receive the apiUrl (needed for image/recipe deep links).
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { householdMiddleware } from "@/server/middleware"
import {
  getMealPlan,
  getMealieConfig,
  getMealieShoppingList,
  getMealieShoppingLists,
  getMonthRange,
  getRecipe,
  getRecipeCategories,
  getRecipeTags,
  getRecipes,
  listFavoriteRecipes,
  parseNutritionAmount,
  toggleFavoriteRecipe,
} from "./mealie"
import type {
  MealieMealPlanEntry,
  MealieRecipe,
  MealieShoppingList,
  MealieShoppingListDetail,
} from "./mealie"
import {
  aggregateIngredients,
  findOrCreateCategory,
  findOrCreateProduct,
  loadProductLookup,
  mapUnit,
  normalizeIngredientName,
  parseIngredient,
  titleCase,
} from "./ingredients"
import type { ParsedIngredient } from "./ingredients"
import {
  addListItem,
  createShoppingList,
  findListItemByProduct,
  getShoppingList,
  incrementListItem,
  latestPricePerProduct,
  listActiveProducts,
  listOpenShoppingLists,
  listPantryItemsWithProduct,
  pantryQuantities,
  touchShoppingList,
} from "./shopping-lists"

const RECIPES_PER_PAGE = 24

const dateRe = /^\d{4}-\d{2}-\d{2}$/

// ── Meal plan calendar ──────────────────────────────────

const planMonthSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const getMealPlanPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => planMonthSchema.parse(d))
  .handler(async ({ data, context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) {
      const empty: Record<string, number> = {}
      return {
        configured: false as const,
        apiUrl: null,
        entries: [] as Array<MealieMealPlanEntry>,
        calories: empty,
        error: null as string | null,
      }
    }

    const baseDate = data.month
      ? new Date(
          Number(data.month.slice(0, 4)),
          Number(data.month.slice(5, 7)) - 1,
          1
        )
      : new Date()
    const { startDate, endDate } = getMonthRange(baseDate)

    let entries: Array<MealieMealPlanEntry> = []
    let error: string | null = null
    try {
      entries = await getMealPlan(context.householdId, startDate, endDate)
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to connect to Mealie"
    }

    // Daily calorie totals need recipe nutrition — fetch details (cache-first)
    // for every unique recipe in the month; failures are skipped.
    const recipeIds = [
      ...new Set(
        entries.map((e) => e.recipeId).filter((id): id is string => id !== null)
      ),
    ]
    const calories: Record<string, number> = {}
    const results = await Promise.allSettled(
      recipeIds.map((id) => getRecipe(context.householdId, id))
    )
    for (const result of results) {
      if (result.status !== "fulfilled") continue
      const cal = parseNutritionAmount(result.value.nutrition?.calories)
      if (cal !== null) calories[result.value.id] = cal
    }

    return {
      configured: true as const,
      apiUrl: config.apiUrl,
      entries,
      calories,
      error,
    }
  })

// ── Recipe browser ──────────────────────────────────────

const recipesQuerySchema = z.object({
  page: z.number().int().min(1).max(10000).optional(),
  search: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  tag: z.string().max(200).optional(),
  sort: z.enum(["name", "rating", "dateAdded", "totalTime"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
})

export const getRecipesPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => recipesQuerySchema.parse(d))
  .handler(async ({ data, context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) {
      return {
        configured: false as const,
        apiUrl: null,
        items: [],
        total: 0,
        totalPages: 0,
        categories: [],
        tags: [],
        favorites: [],
      }
    }

    const [recipesData, categories, tags, favorites] = await Promise.all([
      getRecipes(
        context.householdId,
        data.page ?? 1,
        RECIPES_PER_PAGE,
        data.search || undefined,
        {
          categories: data.category || undefined,
          tags: data.tag || undefined,
          orderBy: data.sort || undefined,
          orderDirection: data.sort ? (data.dir ?? "desc") : undefined,
        }
      ),
      getRecipeCategories(context.householdId).catch(
        () => [] as Array<{ name: string; slug: string }>
      ),
      getRecipeTags(context.householdId).catch(
        () => [] as Array<{ name: string; slug: string }>
      ),
      listFavoriteRecipes(context.householdId),
    ])

    return {
      configured: true as const,
      apiUrl: config.apiUrl,
      items: recipesData.items,
      total: recipesData.total,
      totalPages: recipesData.totalPages,
      categories,
      tags,
      favorites,
    }
  })

export const toggleFavoriteRecipeFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z
      .object({
        mealieRecipeId: z.string().min(1).max(200),
        mealieSlug: z.string().min(1).max(300),
        recipeName: z.string().min(1).max(300),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const result = await toggleFavoriteRecipe(
      context.householdId,
      data.mealieRecipeId,
      data.mealieSlug,
      data.recipeName
    )
    return { ok: true as const, favorited: result.favorited }
  })

// ── Recipe detail ───────────────────────────────────────

export const getRecipeDetailFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(300) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) return null

    let recipe: MealieRecipe
    try {
      recipe = await getRecipe(context.householdId, data.slug)
    } catch {
      return null
    }

    const [favorites, productLookup, priceMap] = await Promise.all([
      listFavoriteRecipes(context.householdId),
      loadProductLookup(context.householdId),
      latestPricePerProduct(context.householdId),
    ])

    // Which ingredients match existing products (exact or partial name).
    const matches = recipe.recipeIngredient.map((ing) => {
      const name = normalizeIngredientName(ing)
      if (!name || name.length < 2) {
        return {
          matched: false,
          skipped: true,
          productId: null as string | null,
        }
      }
      let productId = productLookup.get(name) ?? null
      if (!productId) {
        for (const [existingName, id] of productLookup) {
          if (existingName.includes(name) || name.includes(existingName)) {
            productId = id
            break
          }
        }
      }
      return { matched: productId !== null, skipped: false, productId }
    })

    // Cost estimate from the latest observed price of each matched product.
    let totalCost = 0
    let pricedCount = 0
    const seenProducts = new Set<string>()
    for (const m of matches) {
      if (!m.productId || seenProducts.has(m.productId)) continue
      seenProducts.add(m.productId)
      const price = priceMap.get(m.productId)
      if (price !== undefined) {
        totalCost += price
        pricedCount++
      }
    }

    return {
      apiUrl: config.apiUrl,
      recipe,
      isFavorite: favorites.some((f) => f.mealieRecipeId === recipe.id),
      matches: matches.map((m) => ({ matched: m.matched, skipped: m.skipped })),
      matchedCount: matches.filter((m) => m.matched).length,
      newCount: matches.filter((m) => !m.matched && !m.skipped).length,
      totalCost,
      pricedCount,
      unpricedCount: recipe.recipeIngredient.length - pricedCount,
    }
  })

// "Import All as Products" — every parseable ingredient becomes a Product.
export const importRecipeProductsFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(300) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    let recipe: MealieRecipe
    try {
      recipe = await getRecipe(context.householdId, data.slug)
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Recipe not found." }
    }

    const lookup = await loadProductLookup(context.householdId)
    let imported = 0
    for (const ing of recipe.recipeIngredient) {
      const parsed = parseIngredient(ing)
      if (!parsed) continue
      await findOrCreateProduct(
        context.householdId,
        parsed.productName,
        parsed.normalizedKey,
        lookup
      )
      imported++
    }
    return { ok: true as const, imported }
  })

// ── What can I cook? ────────────────────────────────────

export const getWhatCanICookFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) {
      return {
        configured: false as const,
        apiUrl: null,
        pantryCount: 0,
        recipesScanned: 0,
        matches: [],
      }
    }

    const pantryItems = await listPantryItemsWithProduct(
      context.householdId,
      true
    )
    if (pantryItems.length === 0) {
      return {
        configured: true as const,
        apiUrl: config.apiUrl,
        pantryCount: 0,
        recipesScanned: 0,
        matches: [],
      }
    }

    const pantryNames = new Set(
      pantryItems.map((p) => p.productName.toLowerCase())
    )

    const recipeSummaries = await getRecipes(context.householdId, 1, 30)
    const recipeResults = await Promise.allSettled(
      recipeSummaries.items.map((r) => getRecipe(context.householdId, r.slug))
    )
    const fullRecipes = recipeResults
      .filter(
        (r): r is PromiseFulfilledResult<MealieRecipe> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)

    const matches: Array<{
      id: string
      slug: string
      name: string
      totalTime: string | null
      recipeServings: number | null
      matchedIngredients: Array<string>
      missingIngredients: Array<string>
      matchPercent: number
    }> = []

    for (const recipe of fullRecipes) {
      if (recipe.recipeIngredient.length === 0) continue
      const matched: Array<string> = []
      const missing: Array<string> = []

      for (const ing of recipe.recipeIngredient) {
        const name = normalizeIngredientName(ing)
        if (!name || name.length < 2) continue
        let found = pantryNames.has(name)
        if (!found) {
          for (const pantryName of pantryNames) {
            if (pantryName.includes(name) || name.includes(pantryName)) {
              found = true
              break
            }
          }
        }
        const displayName = ing.food?.name || ing.display || name
        if (found) matched.push(displayName)
        else missing.push(displayName)
      }

      const total = matched.length + missing.length
      if (total === 0) continue
      matches.push({
        id: recipe.id,
        slug: recipe.slug,
        name: recipe.name,
        totalTime: recipe.totalTime,
        recipeServings: recipe.recipeServings,
        matchedIngredients: matched,
        missingIngredients: missing,
        matchPercent: Math.round((matched.length / total) * 100),
      })
    }

    matches.sort((a, b) => {
      if (b.matchPercent !== a.matchPercent) {
        return b.matchPercent - a.matchPercent
      }
      return a.missingIngredients.length - b.missingIngredients.length
    })

    return {
      configured: true as const,
      apiUrl: config.apiUrl,
      pantryCount: pantryItems.length,
      recipesScanned: fullRecipes.length,
      matches,
    }
  })

// ── Mealie shopping lists ───────────────────────────────

export const getMealieShoppingListsFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) {
      return {
        configured: false as const,
        apiUrl: null,
        lists: [] as Array<MealieShoppingList>,
        error: null as string | null,
      }
    }
    let lists: Array<MealieShoppingList> = []
    let error: string | null = null
    try {
      lists = await getMealieShoppingLists(context.householdId)
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to fetch shopping lists"
    }
    return { configured: true as const, apiUrl: config.apiUrl, lists, error }
  })

export const getMealieShoppingListFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1).max(200) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) return { configured: false as const }

    let list: MealieShoppingListDetail | null = null
    let error: string | null = null
    try {
      list = await getMealieShoppingList(context.householdId, data.id)
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to fetch the list"
    }
    const localLists = await listOpenShoppingLists(context.householdId)
    return {
      configured: true as const,
      apiUrl: config.apiUrl,
      list,
      error,
      localLists: localLists.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
      })),
    }
  })

// Merge selected Mealie list items into a local list. Mealie unit names map
// to the "ProductUnit" enum; Mealie labels become "ProductCategory" rows
// (auto-created); duplicate products on the target list merge quantities.
const mergeItemSchema = z.object({
  foodName: z.string().min(1).max(300),
  quantity: z.number().min(0).max(100000),
  unitName: z.string().max(100).nullable(),
  note: z.string().max(1000),
  labelName: z.string().max(200).nullable(),
})

const mergeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("new"),
    newListName: z.string().trim().min(1).max(200),
    items: z.array(mergeItemSchema).min(1).max(500),
  }),
  z.object({
    mode: z.literal("existing"),
    targetListId: z.string().min(1),
    items: z.array(mergeItemSchema).min(1).max(500),
  }),
])

export const mergeMealieListFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => mergeSchema.parse(d))
  .handler(async ({ data, context }) => {
    let listId: string
    if (data.mode === "new") {
      listId = await createShoppingList(
        context.householdId,
        data.newListName,
        "DRAFT",
        null
      )
    } else {
      // Re-verify ownership of the target list (ADR-0005).
      const existing = await getShoppingList(
        context.householdId,
        data.targetListId
      )
      if (!existing) return { error: "Shopping list not found." }
      listId = existing.id
    }

    const lookup = await loadProductLookup(context.householdId)
    for (const item of data.items) {
      const displayName = titleCase(item.foodName)
      const categoryId = item.labelName
        ? await findOrCreateCategory(context.householdId, item.labelName)
        : null
      const productId = await findOrCreateProduct(
        context.householdId,
        displayName,
        displayName.toLowerCase(),
        lookup,
        { defaultUnit: mapUnit(item.unitName), categoryId }
      )

      const existingItem = await findListItemByProduct(listId, productId)
      if (existingItem) {
        const mergedNotes = item.note
          ? existingItem.notes
            ? `${existingItem.notes}; ${item.note}`
            : item.note
          : existingItem.notes
        await incrementListItem(
          existingItem.id,
          item.quantity || 1,
          mergedNotes
        )
      } else {
        await addListItem(
          listId,
          productId,
          item.quantity || 1,
          mapUnit(item.unitName),
          item.note || null
        )
      }
    }

    return { ok: true as const, listId }
  })

// ── Sync review (meal plan or single recipe → list) ─────

export type ReviewItem = {
  key: string
  recipeNote: string
  proposedName: string
  normalizedKey: string
  quantity: number
  unit: string | null
  matchedProductId: string | null
  matchedProductName: string | null
  pantryQty: number
}

const syncReviewSchema = z
  .object({
    startDate: z.string().regex(dateRe).optional(),
    endDate: z.string().regex(dateRe).optional(),
    recipeId: z.string().max(200).optional(),
    recipeName: z.string().max(300).optional(),
    listName: z.string().max(200).optional(),
  })
  .refine((d) => (d.startDate && d.endDate) || d.recipeId, {
    message: "Provide a date range or a recipe id",
  })

export const getSyncReviewFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => syncReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const config = await getMealieConfig(context.householdId)
    if (!config) return { error: "Mealie is not connected." }

    const allParsed: Array<ParsedIngredient> = []
    let sourceLabel = ""

    try {
      if (data.startDate && data.endDate) {
        const mealPlan = await getMealPlan(
          context.householdId,
          data.startDate,
          data.endDate
        )
        const recipeEntries = mealPlan.filter((e) => e.recipeId)
        if (recipeEntries.length === 0) {
          return { error: "No meals with recipes in that range." }
        }
        const uniqueRecipeIds = [
          ...new Set(recipeEntries.map((e) => e.recipeId as string)),
        ]
        const recipes = await Promise.all(
          uniqueRecipeIds.map((id) => getRecipe(context.householdId, id))
        )
        // Recipes planned multiple times multiply their ingredient quantities.
        const recipeCounts = new Map<string, number>()
        for (const entry of recipeEntries) {
          const id = entry.recipeId as string
          recipeCounts.set(id, (recipeCounts.get(id) || 0) + 1)
        }
        for (const recipe of recipes) {
          const multiplier = recipeCounts.get(recipe.id) || 1
          for (const ing of recipe.recipeIngredient) {
            const parsed = parseIngredient(ing)
            if (!parsed) continue
            allParsed.push({
              ...parsed,
              quantity: parsed.quantity * multiplier,
            })
          }
        }
        sourceLabel = `Meal Plan: ${data.startDate} to ${data.endDate} (${recipeEntries.length} meals)`
      } else {
        const recipe = await getRecipe(
          context.householdId,
          data.recipeId as string
        )
        for (const ing of recipe.recipeIngredient) {
          const parsed = parseIngredient(ing)
          if (parsed) allParsed.push(parsed)
        }
        sourceLabel = `Recipe: ${data.recipeName || recipe.name}`
      }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Failed to load from Mealie",
      }
    }

    const aggregated = aggregateIngredients(allParsed)

    const [products, lists, pantryMap] = await Promise.all([
      listActiveProducts(context.householdId),
      listOpenShoppingLists(context.householdId),
      pantryQuantities(context.householdId),
    ])
    const productByLowerName = new Map(
      products.map((p) => [p.name.toLowerCase(), p])
    )

    const sorted = [...aggregated.entries()].sort((a, b) =>
      a[1].parsed.productName.localeCompare(b[1].parsed.productName)
    )
    const items: Array<ReviewItem> = sorted.map(
      ([key, { parsed, totalQuantity, recipeNotes }]) => {
        const match = productByLowerName.get(parsed.normalizedKey) ?? null
        return {
          key,
          recipeNote: recipeNotes.join("; "),
          proposedName: parsed.productName,
          normalizedKey: parsed.normalizedKey,
          quantity: totalQuantity,
          unit: parsed.unit,
          matchedProductId: match?.id ?? null,
          matchedProductName: match?.name ?? null,
          pantryQty: match ? (pantryMap.get(match.id) ?? 0) : 0,
        }
      }
    )

    return {
      sourceLabel,
      items,
      existingProducts: products,
      existingLists: lists.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        itemCount: l.itemCount,
      })),
      defaultListName: data.listName || data.recipeName || "Shopping List",
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
    }
  })

const commitItemSchema = z.object({
  productName: z.string().trim().min(1).max(300),
  normalizedKey: z.string().min(1).max(300),
  quantity: z.number().min(0).max(100000),
  recipeNote: z.string().max(2000),
  existingProductId: z.string().nullable(),
})

const commitSchema = z.object({
  syncMode: z.enum(["new-list", "existing-list", "products-only"]),
  listName: z.string().trim().max(200).optional(),
  existingListId: z.string().max(100).optional(),
  startDate: z.string().regex(dateRe).nullable(),
  endDate: z.string().regex(dateRe).nullable(),
  items: z.array(commitItemSchema).min(1).max(500),
})

export const commitSyncFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .inputValidator((d: unknown) => commitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const lookup = await loadProductLookup(context.householdId)
    // Never trust product ids from the form — only accept ids that belong to
    // this household (ADR-0005; the legacy action skipped this check).
    const ownedProductIds = new Set(lookup.values())

    async function resolveProduct(item: z.infer<typeof commitItemSchema>) {
      if (
        item.existingProductId &&
        ownedProductIds.has(item.existingProductId)
      ) {
        return item.existingProductId
      }
      return findOrCreateProduct(
        context.householdId,
        item.productName,
        item.normalizedKey,
        lookup
      )
    }

    // Products only — import into the catalog, no list.
    if (data.syncMode === "products-only") {
      for (const item of data.items) await resolveProduct(item)
      return { ok: true as const, mode: data.syncMode, listId: null }
    }

    // Add to existing list — merge quantities for products already on it.
    if (data.syncMode === "existing-list") {
      if (!data.existingListId) return { error: "Choose a list to add to." }
      const list = await getShoppingList(
        context.householdId,
        data.existingListId
      )
      if (!list) return { error: "Shopping list not found." }

      let sortOrder = list.itemCount
      for (const item of data.items) {
        const productId = await resolveProduct(item)
        const existingItem = await findListItemByProduct(list.id, productId)
        if (existingItem) {
          await incrementListItem(
            existingItem.id,
            item.quantity,
            item.recipeNote
          )
        } else {
          await addListItem(
            list.id,
            productId,
            item.quantity,
            null,
            item.recipeNote,
            sortOrder++
          )
        }
      }
      await touchShoppingList(list.id)
      return { ok: true as const, mode: data.syncMode, listId: list.id }
    }

    // New list (default).
    if (!data.listName) return { error: "List name is required." }
    const notes =
      data.startDate && data.endDate
        ? `Synced from Mealie: ${data.startDate} to ${data.endDate}`
        : "Synced from Mealie recipe"
    const listId = await createShoppingList(
      context.householdId,
      data.listName,
      "DRAFT",
      notes
    )
    let sortOrder = 0
    for (const item of data.items) {
      const productId = await resolveProduct(item)
      await addListItem(
        listId,
        productId,
        item.quantity,
        null,
        item.recipeNote,
        sortOrder++
      )
    }
    return { ok: true as const, mode: data.syncMode, listId }
  })
