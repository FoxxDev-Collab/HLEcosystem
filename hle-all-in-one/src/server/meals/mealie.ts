// Mealie API client + per-household config. Ported from
// hle-meal_prep/lib/mealie.ts. The connection (URL + bearer token) lives in
// the "MealieConfig" table per household — never in env, never sent to the
// client. All fetches happen server-side with a 30s AbortController timeout.
import { sql } from "@/server/db"
import {
  getCachedMealPlan,
  getCachedRecipeDetail,
  getCachedRecipes,
  getStaleCachedMealPlan,
  isRecipeSyncNeeded,
  markRecipesSynced,
  upsertCachedMealPlan,
  upsertCachedRecipeDetail,
  upsertCachedRecipes,
} from "./mealie-cache"

// ── Types ───────────────────────────────────────────────

export type MealieRecipeSummary = {
  id: string
  name: string
  slug: string
  description: string | null
  totalTime: string | null
  prepTime: string | null
  performTime: string | null
  recipeServings: number | null
  rating: number | null
  dateAdded: string | null
  image: string | null
  orgURL: string | null
  recipeCategory: Array<{ name: string; slug: string }>
  tags: Array<{ name: string; slug: string }>
}

export type MealieIngredient = {
  quantity: number | null
  unit: { id: string; name: string } | null
  food: { id: string; name: string } | null
  note: string
  display: string
  referenceId: string
}

export type MealieInstruction = {
  id: string
  title: string
  text: string
}

export type MealieNutrition = {
  calories?: string | null
  fatContent?: string | null
  proteinContent?: string | null
  carbohydrateContent?: string | null
  fiberContent?: string | null
  sugarContent?: string | null
  sodiumContent?: string | null
}

export type MealieRecipe = MealieRecipeSummary & {
  recipeIngredient: Array<MealieIngredient>
  recipeInstructions: Array<MealieInstruction>
  nutrition: MealieNutrition | null
}

export type MealieMealPlanEntry = {
  id: number
  date: string
  entryType: string
  title: string | null
  text: string | null
  recipeId: string | null
  recipe: MealieRecipeSummary | null
}

export type MealieShoppingList = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type MealieShoppingListItem = {
  id: string
  shoppingListId: string
  quantity: number
  unit: { id: string; name: string } | null
  food: { id: string; name: string } | null
  note: string
  display: string
  checked: boolean
  position: number
  label: { id: string; name: string } | null
}

export type MealieShoppingListDetail = MealieShoppingList & {
  listItems: Array<MealieShoppingListItem>
}

export type MealieConfigData = {
  apiUrl: string
  apiToken: string
}

// ── Config ──────────────────────────────────────────────

export async function getMealieConfig(
  householdId: string
): Promise<MealieConfigData | null> {
  const rows = await sql<Array<MealieConfigData & { isActive: boolean }>>`
    SELECT "apiUrl", "apiToken", "isActive"
    FROM "MealieConfig"
    WHERE "householdId" = ${householdId}`
  const config = rows[0]
  if (!config || !config.isActive) return null
  return { apiUrl: config.apiUrl, apiToken: config.apiToken }
}

// ── API client ──────────────────────────────────────────

export async function mealieFetch<T>(
  config: MealieConfigData,
  path: string
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Mealie API error: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(
        "Mealie request timed out — the server may be busy. Try again."
      )
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

export async function testMealieConnection(
  apiUrl: string,
  apiToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(`${apiUrl}/api/households/mealplans/today`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return {
        ok: false,
        error: `API returned ${res.status}: ${res.statusText}`,
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Connection failed",
    }
  }
}

// ── Meal plans (DB-first, 15-min TTL, stale-serve on outage) ──

export async function getTodaysMealPlan(
  householdId: string
): Promise<Array<MealieMealPlanEntry>> {
  const today = new Date().toISOString().split("T")[0]
  return getMealPlan(householdId, today, today)
}

export async function getMealPlan(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<Array<MealieMealPlanEntry>> {
  const config = await getMealieConfig(householdId)
  if (!config) return []

  const cached = await getCachedMealPlan(householdId, startDate, endDate)
  if (cached !== null) return cached

  try {
    const data = await mealieFetch<
      Array<MealieMealPlanEntry> | { items: Array<MealieMealPlanEntry> }
    >(
      config,
      `/api/households/mealplans?start_date=${startDate}&end_date=${endDate}`
    )
    const entries = Array.isArray(data) ? data : data.items
    // Cache in background — don't block the response.
    upsertCachedMealPlan(householdId, entries).catch(() => {})
    return entries
  } catch {
    // Mealie unreachable — return whatever stale data we have.
    return getStaleCachedMealPlan(householdId, startDate, endDate).catch(
      () => [] as Array<MealieMealPlanEntry>
    )
  }
}

// ── Recipes ─────────────────────────────────────────────

export async function getRecipe(
  householdId: string,
  slugOrId: string
): Promise<MealieRecipe> {
  const config = await getMealieConfig(householdId)
  if (!config) throw new Error("Mealie is not configured for this household")

  // DB-first for recipe detail (no TTL — fresh detail is populated on fetch).
  const cached = await getCachedRecipeDetail(householdId, slugOrId)
  if (cached) return cached

  const recipe = await mealieFetch<MealieRecipe>(
    config,
    `/api/recipes/${slugOrId}`
  )
  upsertCachedRecipeDetail(householdId, recipe).catch(() => {})
  return recipe
}

export type RecipeQueryOptions = {
  categories?: string
  tags?: string
  foods?: string
  orderBy?: string
  orderDirection?: "asc" | "desc"
}

function sortSummaries(
  items: Array<MealieRecipeSummary>,
  orderBy: string,
  dir: "asc" | "desc"
): Array<MealieRecipeSummary> {
  const mul = dir === "asc" ? 1 : -1
  return [...items].sort((a, b) => {
    if (orderBy === "rating") return ((a.rating ?? 0) - (b.rating ?? 0)) * mul
    if (orderBy === "dateAdded") {
      return (a.dateAdded ?? "").localeCompare(b.dateAdded ?? "") * mul
    }
    if (orderBy === "totalTime") {
      return (a.totalTime ?? "").localeCompare(b.totalTime ?? "") * mul
    }
    return a.name.localeCompare(b.name) * mul
  })
}

export async function getRecipes(
  householdId: string,
  page: number,
  perPage: number,
  search?: string,
  options?: RecipeQueryOptions
): Promise<{
  items: Array<MealieRecipeSummary>
  total: number
  totalPages: number
}> {
  const config = await getMealieConfig(householdId)
  if (!config) return { items: [], total: 0, totalPages: 0 }

  // Serve from DB cache for unfiltered or name-search requests.
  // Category/tag/food filters require Mealie's server-side filtering.
  const canUseCache = !options?.categories && !options?.tags && !options?.foods

  if (canUseCache) {
    const cached = await getCachedRecipes(householdId, search || undefined)
    if (cached) {
      const allItems = options?.orderBy
        ? sortSummaries(
            cached.recipes,
            options.orderBy,
            options.orderDirection ?? "desc"
          )
        : cached.recipes
      const start = (page - 1) * perPage
      return {
        items: allItems.slice(start, start + perPage),
        total: allItems.length,
        totalPages: Math.ceil(allItems.length / perPage),
      }
    }
  }

  try {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    })
    if (search) params.set("search", search)
    if (options?.categories) params.set("categories", options.categories)
    if (options?.tags) params.set("tags", options.tags)
    if (options?.foods) params.set("foods", options.foods)
    if (options?.orderBy) params.set("orderBy", options.orderBy)
    if (options?.orderDirection) {
      params.set("orderDirection", options.orderDirection)
    }

    const data = await mealieFetch<{
      items: Array<MealieRecipeSummary>
      total: number
      total_pages: number
    }>(config, `/api/recipes?${params.toString()}`)

    if (canUseCache) {
      upsertCachedRecipes(householdId, data.items).catch(() => {})
    }
    return {
      items: data.items,
      total: data.total,
      totalPages: data.total_pages,
    }
  } catch {
    // Mealie unreachable — fall back to whatever is in the DB.
    if (canUseCache) {
      const fallback = await getCachedRecipes(
        householdId,
        search || undefined
      ).catch(() => null)
      if (fallback) {
        const start = (page - 1) * perPage
        return {
          items: fallback.recipes.slice(start, start + perPage),
          total: fallback.recipes.length,
          totalPages: Math.ceil(fallback.recipes.length / perPage),
        }
      }
    }
    return { items: [], total: 0, totalPages: 0 }
  }
}

export async function getRecipeCategories(
  householdId: string
): Promise<Array<{ name: string; slug: string }>> {
  const config = await getMealieConfig(householdId)
  if (!config) return []
  const data = await mealieFetch<{
    items: Array<{ name: string; slug: string }>
  }>(config, "/api/organizers/categories")
  return data.items
}

export async function getRecipeTags(
  householdId: string
): Promise<Array<{ name: string; slug: string }>> {
  const config = await getMealieConfig(householdId)
  if (!config) return []
  const data = await mealieFetch<{
    items: Array<{ name: string; slug: string }>
  }>(config, "/api/organizers/tags")
  return data.items
}

// ── Mealie shopping lists ───────────────────────────────

export async function getMealieShoppingLists(
  householdId: string
): Promise<Array<MealieShoppingList>> {
  const config = await getMealieConfig(householdId)
  if (!config) return []
  const data = await mealieFetch<{ items: Array<MealieShoppingList> }>(
    config,
    "/api/households/shopping/lists?perPage=100&orderBy=updated_at&orderDirection=desc"
  )
  return data.items
}

export async function getMealieShoppingList(
  householdId: string,
  listId: string
): Promise<MealieShoppingListDetail | null> {
  const config = await getMealieConfig(householdId)
  if (!config) return null
  return mealieFetch<MealieShoppingListDetail>(
    config,
    `/api/households/shopping/lists/${listId}`
  )
}

// ── Sync (recipes pagination + current/next week meal plan) ──

const RECIPES_PER_PAGE = 50

export type MealieSyncResult =
  | { skipped: true; reason: "no_config" | "fresh" }
  | { synced: true; recipes: number; planEntries: number }
  | { error: string }

export async function runMealieSync(
  householdId: string,
  force = false
): Promise<MealieSyncResult> {
  const config = await getMealieConfig(householdId)
  if (!config) return { skipped: true, reason: "no_config" }

  if (!force) {
    const syncNeeded = await isRecipeSyncNeeded(householdId)
    if (!syncNeeded) return { skipped: true, reason: "fresh" }
  }

  let totalSynced = 0
  try {
    // Sync all recipes, 50 per page.
    let page = 1
    for (;;) {
      const data = await mealieFetch<{
        items: Array<MealieRecipeSummary>
        total: number
        total_pages: number
      }>(
        config,
        `/api/recipes?page=${page}&perPage=${RECIPES_PER_PAGE}&orderBy=name&orderDirection=asc`
      )
      if (data.items.length > 0) {
        await upsertCachedRecipes(householdId, data.items)
        totalSynced += data.items.length
      }
      if (page >= data.total_pages || data.items.length < RECIPES_PER_PAGE) {
        break
      }
      page++
    }
    await markRecipesSynced(householdId, totalSynced)

    // Sync current week + next week's meal plan.
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { startDate } = getWeekRange(now)
    const { endDate } = getWeekRange(nextWeek)
    const planData = await mealieFetch<
      Array<MealieMealPlanEntry> | { items: Array<MealieMealPlanEntry> }
    >(
      config,
      `/api/households/mealplans?start_date=${startDate}&end_date=${endDate}`
    )
    const entries = Array.isArray(planData) ? planData : planData.items
    await upsertCachedMealPlan(householdId, entries)

    return { synced: true, recipes: totalSynced, planEntries: entries.length }
  } catch (e) {
    // Partial sync is fine — whatever succeeded is cached.
    return { error: e instanceof Error ? e.message : "Sync failed" }
  }
}

// ── Date range helpers ──────────────────────────────────

export function getWeekRange(date: Date = new Date()): {
  startDate: string
  endDate: string
} {
  const day = date.getDay()
  const start = new Date(date)
  start.setDate(date.getDate() - day) // Sunday
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Saturday
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  }
}

export function getMonthRange(date: Date = new Date()): {
  startDate: string
  endDate: string
  year: number
  month: number
} {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    year,
    month,
  }
}

// ── Favorite recipes (local table keyed by Mealie ids) ──

export type FavoriteRecipeRow = {
  id: string
  mealieRecipeId: string
  mealieSlug: string
  recipeName: string
}

export async function listFavoriteRecipes(
  householdId: string
): Promise<Array<FavoriteRecipeRow>> {
  return sql<Array<FavoriteRecipeRow>>`
    SELECT "id", "mealieRecipeId", "mealieSlug", "recipeName"
    FROM "FavoriteRecipe"
    WHERE "householdId" = ${householdId}
    ORDER BY "recipeName" ASC`
}

export async function toggleFavoriteRecipe(
  householdId: string,
  mealieRecipeId: string,
  mealieSlug: string,
  recipeName: string
): Promise<{ favorited: boolean }> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "FavoriteRecipe"
    WHERE "householdId" = ${householdId}
      AND "mealieRecipeId" = ${mealieRecipeId}`
  if (existing[0]) {
    await sql`
      DELETE FROM "FavoriteRecipe"
      WHERE "id" = ${existing[0].id} AND "householdId" = ${householdId}`
    return { favorited: false }
  }
  await sql`
    INSERT INTO "FavoriteRecipe"
      ("householdId", "mealieRecipeId", "mealieSlug", "recipeName")
    VALUES (${householdId}, ${mealieRecipeId}, ${mealieSlug}, ${recipeName})`
  return { favorited: true }
}

// ── Nutrition helpers ───────────────────────────────────

export function parseNutritionAmount(
  value: string | null | undefined
): number | null {
  if (!value) return null
  const match = value.match(/([\d.]+)/)
  return match ? parseFloat(match[1]) : null
}

export function hasNutritionData(
  nutrition: MealieNutrition | null | undefined
): boolean {
  if (!nutrition) return false
  return !!(
    nutrition.calories ||
    nutrition.proteinContent ||
    nutrition.fatContent ||
    nutrition.carbohydrateContent
  )
}
