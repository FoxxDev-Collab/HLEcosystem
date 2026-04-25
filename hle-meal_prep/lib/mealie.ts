import prisma from "./prisma";
import {
  getCachedRecipes,
  getCachedRecipeDetail,
  getCachedMealPlan,
  upsertCachedRecipes,
  upsertCachedRecipeDetail,
  upsertCachedMealPlan,
} from "./mealie-cache";

// ── Types ───────────────────────────────────────────────────────

export type MealieRecipeSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  totalTime: string | null;
  prepTime: string | null;
  performTime: string | null;
  recipeServings: number | null;
  rating: number | null;
  dateAdded: string | null;
  image: string | null;
  orgURL: string | null;
  recipeCategory: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
};

export type MealieIngredient = {
  quantity: number | null;
  unit: { id: string; name: string } | null;
  food: { id: string; name: string } | null;
  note: string;
  display: string;
  referenceId: string;
};

export type MealieInstruction = {
  id: string;
  title: string;
  text: string;
};

export type MealieNutrition = {
  calories?: string | null;
  fatContent?: string | null;
  proteinContent?: string | null;
  carbohydrateContent?: string | null;
  fiberContent?: string | null;
  sugarContent?: string | null;
  sodiumContent?: string | null;
};

export type MealieRecipe = MealieRecipeSummary & {
  recipeIngredient: MealieIngredient[];
  recipeInstructions: MealieInstruction[];
  nutrition: MealieNutrition | null;
  recipeCategory: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
};

export type MealieMealPlanEntry = {
  id: number;
  date: string;
  entryType: string;
  title: string | null;
  text: string | null;
  recipeId: string | null;
  recipe: MealieRecipeSummary | null;
};

export type MealieConfigData = {
  apiUrl: string;
  apiToken: string;
};

// ── Config ──────────────────────────────────────────────────────

export async function getMealieConfig(householdId: string): Promise<MealieConfigData | null> {
  const config = await prisma.mealieConfig.findUnique({
    where: { householdId },
  });
  if (!config || !config.isActive) return null;
  return { apiUrl: config.apiUrl, apiToken: config.apiToken };
}

// ── API Client ──────────────────────────────────────────────────

export async function mealieFetch<T>(config: MealieConfigData, path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Mealie API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Mealie request timed out — the server may be busy. Try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ──────────────────────────────────────────────────

export async function getTodaysMealPlan(householdId: string): Promise<MealieMealPlanEntry[]> {
  const today = new Date().toISOString().split("T")[0];
  return getMealPlan(householdId, today, today);
}

export async function getMealPlan(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<MealieMealPlanEntry[]> {
  const config = await getMealieConfig(householdId);
  if (!config) return [];

  // DB-first with 15-min hard TTL
  const cached = await getCachedMealPlan(householdId, startDate, endDate);
  if (cached !== null) return cached;

  try {
    const data = await mealieFetch<MealieMealPlanEntry[] | { items: MealieMealPlanEntry[] }>(
      config,
      `/api/households/mealplans?start_date=${startDate}&end_date=${endDate}`
    );
    const entries = Array.isArray(data) ? data : data.items;
    // Cache in background — don't block the response
    upsertCachedMealPlan(householdId, entries).catch(() => {});
    return entries;
  } catch {
    // Mealie unreachable — return whatever stale data we have
    const stale = await getCachedMealPlan(householdId, startDate, endDate).catch(() => null);
    return stale ?? [];
  }
}

export async function getRecipe(householdId: string, slugOrId: string): Promise<MealieRecipe> {
  const config = await getMealieConfig(householdId);
  if (!config) throw new Error("Mealie is not configured for this household");

  // DB-first for recipe detail (no TTL — fresh detail is populated by sync)
  const cached = await getCachedRecipeDetail(householdId, slugOrId);
  if (cached) return cached;

  const recipe = await mealieFetch<MealieRecipe>(config, `/api/recipes/${slugOrId}`);
  // Cache in background
  upsertCachedRecipeDetail(householdId, recipe).catch(() => {});
  return recipe;
}

export async function testMealieConnection(apiUrl: string, apiToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/households/mealplans/today`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `API returned ${res.status}: ${res.statusText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}

export function getMealieRecipeUrl(apiUrl: string, slug: string): string {
  return `${apiUrl}/g/home/r/${slug}`;
}

export type RecipeQueryOptions = {
  page?: number;
  perPage?: number;
  search?: string;
  categories?: string;
  tags?: string;
  foods?: string;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
};

export async function getRecipes(
  householdId: string,
  page: number,
  perPage: number,
  search?: string,
  options?: Omit<RecipeQueryOptions, "page" | "perPage" | "search">
): Promise<{ items: MealieRecipeSummary[]; total: number; totalPages: number }> {
  const config = await getMealieConfig(householdId);
  if (!config) return { items: [], total: 0, totalPages: 0 };

  // Serve from DB cache for unfiltered or name-search requests.
  // Category/tag/food filters require Mealie's server-side filtering — bypass cache.
  const canUseCache = !options?.categories && !options?.tags && !options?.foods;

  if (canUseCache) {
    const cached = await getCachedRecipes(householdId, search || undefined);
    if (cached) {
      const allItems = cached.recipes;
      const start = (page - 1) * perPage;
      const items = allItems.slice(start, start + perPage);
      return { items, total: allItems.length, totalPages: Math.ceil(allItems.length / perPage) };
    }
  }

  // Cache miss or filtered request — hit Mealie
  try {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (search) params.set("search", search);
    if (options?.categories) params.set("categories", options.categories);
    if (options?.tags) params.set("tags", options.tags);
    if (options?.foods) params.set("foods", options.foods);
    if (options?.orderBy) params.set("orderBy", options.orderBy);
    if (options?.orderDirection) params.set("orderDirection", options.orderDirection);

    const data = await mealieFetch<{
      items: MealieRecipeSummary[];
      total: number;
      total_pages: number;
    }>(config, `/api/recipes?${params.toString()}`);

    // Cache summaries in background (only for unfiltered page fetches)
    if (canUseCache) {
      upsertCachedRecipes(householdId, data.items).catch(() => {});
    }

    return { items: data.items, total: data.total, totalPages: data.total_pages };
  } catch {
    // Mealie unreachable — fall back to whatever is in DB
    if (canUseCache) {
      const fallback = await getCachedRecipes(householdId, search || undefined).catch(() => null);
      if (fallback) {
        const start = (page - 1) * perPage;
        const items = fallback.recipes.slice(start, start + perPage);
        return { items, total: fallback.recipes.length, totalPages: Math.ceil(fallback.recipes.length / perPage) };
      }
    }
    return { items: [], total: 0, totalPages: 0 };
  }
}

export async function getRecipeCategories(
  householdId: string
): Promise<{ name: string; slug: string }[]> {
  const config = await getMealieConfig(householdId);
  if (!config) return [];

  const data = await mealieFetch<{ items: { name: string; slug: string }[] }>(
    config,
    "/api/organizers/categories"
  );
  return data.items;
}

export async function getRecipeTags(
  householdId: string
): Promise<{ name: string; slug: string }[]> {
  const config = await getMealieConfig(householdId);
  if (!config) return [];

  const data = await mealieFetch<{ items: { name: string; slug: string }[] }>(
    config,
    "/api/organizers/tags"
  );
  return data.items;
}

export async function getRecipeFoods(
  householdId: string
): Promise<{ id: string; name: string }[]> {
  const config = await getMealieConfig(householdId);
  if (!config) return [];

  const data = await mealieFetch<{ items: { id: string; name: string }[] }>(
    config,
    "/api/foods?perPage=200&orderBy=name&orderDirection=asc"
  );
  return data.items;
}

export function getRecipeImageUrl(apiUrl: string, recipeId: string): string {
  return `${apiUrl}/api/media/recipes/${recipeId}/images/min-original.webp`;
}

// ── Shopping Lists ──────────────────────────────────────────────

export type MealieShoppingList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MealieShoppingListItem = {
  id: string;
  shoppingListId: string;
  quantity: number;
  unit: { id: string; name: string } | null;
  food: { id: string; name: string } | null;
  note: string;
  display: string;
  checked: boolean;
  position: number;
  label: { id: string; name: string } | null;
};

export type MealieShoppingListDetail = MealieShoppingList & {
  listItems: MealieShoppingListItem[];
};

export async function getMealieShoppingLists(
  householdId: string
): Promise<MealieShoppingList[]> {
  const config = await getMealieConfig(householdId);
  if (!config) return [];

  const data = await mealieFetch<{ items: MealieShoppingList[] }>(
    config,
    "/api/households/shopping/lists?perPage=100&orderBy=updated_at&orderDirection=desc"
  );
  return data.items;
}

export async function getMealieShoppingList(
  householdId: string,
  listId: string
): Promise<MealieShoppingListDetail | null> {
  const config = await getMealieConfig(householdId);
  if (!config) return null;

  return mealieFetch<MealieShoppingListDetail>(
    config,
    `/api/households/shopping/lists/${listId}`
  );
}

// ── Helpers ─────────────────────────────────────────────────────

export function getWeekRange(date: Date = new Date()): { startDate: string; endDate: string } {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day); // Sunday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Saturday

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function getMonthRange(date: Date = new Date()): {
  startDate: string;
  endDate: string;
  year: number;
  month: number;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of month

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    year,
    month,
  };
}

// ── Nutrition Helpers ────────────────────────────────────────────

export function parseNutritionAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

export function hasNutritionData(nutrition: MealieNutrition | null | undefined): boolean {
  if (!nutrition) return false;
  return !!(
    nutrition.calories ||
    nutrition.proteinContent ||
    nutrition.fatContent ||
    nutrition.carbohydrateContent
  );
}

// ── Ingredient Normalization ─────────────────────────────────────
// Mealie food names often contain container types ("can tomato sauce"),
// preparation notes ("freshly ground black pepper"), and units embedded
// in the name ("garlic cloves"). We need clean product names for shopping.

const CONTAINER_PREFIXES = /^(can|cans|bottle|bottles|bag|bags|box|boxes|bunch|bunches|head|heads|clove|cloves|jar|jars|package|packages|packet|packets|stick|sticks|sprig|sprigs|stalk|stalks|ear|ears|slice|slices|piece|pieces|cube|cubes|dash|dashes|pinch|pinches)\s+/i;

const PREP_DESCRIPTORS = /\b(freshly|finely|thinly|roughly|coarsely|minced|diced|chopped|sliced|grated|shredded|crushed|ground|melted|softened|cubed|julienned|peeled|seeded|trimmed|halved|quartered|divided|packed|sifted|beaten|whisked|room temperature|cold|warm|hot|frozen|thawed|drained|rinsed|toasted|roasted|dried|fresh|extra|virgin|light|lean|large|medium|small|thick|thin)\s*/gi;

const SIZE_QUALIFIERS = /\b(small|medium|large|extra-large|jumbo)\b\s*/gi;

const TRAILING_NOTES = /\s*[\(,].*$/; // Remove everything after ( or , — "onion, finely chopped" → "onion"

const PERCENTAGE = /\s*\d+%[-\s]*\d*%?\s*(lean|fat)?\s*/gi; // "85%-90% lean" → ""

export function normalizeIngredientName(ingredient: MealieIngredient): string {
  let name: string;

  if (ingredient.food?.name) {
    name = ingredient.food.name;
  } else {
    // Fallback: strip leading quantity/unit from display string
    name = ingredient.display
      .replace(/^[\d\s\/⅛⅙⅕¼⅓⅜½⅝⅔¾⅞]+/, "") // leading fractions/numbers
      .replace(/^(oz|lb|lbs|cup|cups|tsp|tbsp|tablespoon|tablespoons|teaspoon|teaspoons|pound|pounds|ounce|ounces|gallon|quart|liter|ml|g|kg)\.?\s+/i, "")
      .trim();
  }

  // Clean up the name
  name = name
    .replace(TRAILING_NOTES, "")
    .replace(PERCENTAGE, " ")
    .replace(CONTAINER_PREFIXES, "")
    .replace(SIZE_QUALIFIERS, "")
    .replace(PREP_DESCRIPTORS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Remove "or ..." alternatives: "yellow mustard or to taste" → "yellow mustard"
  name = name.replace(/\s+or\s+.*$/i, "").trim();

  // Remove trailing "to taste", "as needed", "if desired" etc.
  name = name.replace(/\s+(to taste|as needed|if desired|if needed|optional|for serving|for garnish|for topping)$/i, "").trim();

  return name;
}

export function cleanProductDisplayName(ingredient: MealieIngredient): string {
  const normalized = normalizeIngredientName(ingredient);
  if (!normalized) return "";

  // Title case
  return normalized
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type ParsedIngredient = {
  productName: string;       // Clean product name for DB ("Tomato Sauce")
  normalizedKey: string;     // Lowercase key for matching ("tomato sauce")
  quantity: number;          // Numeric quantity (15)
  unit: string | null;       // Unit from Mealie ("oz", "cup", "lb")
  recipeNote: string;        // Original display for context ("15 oz can tomato sauce")
};

export function parseIngredient(ingredient: MealieIngredient): ParsedIngredient | null {
  const normalizedKey = normalizeIngredientName(ingredient);
  if (!normalizedKey || normalizedKey.length < 2) return null;

  const productName = cleanProductDisplayName(ingredient);

  return {
    productName,
    normalizedKey,
    quantity: ingredient.quantity || 1,
    unit: ingredient.unit?.name || null,
    recipeNote: ingredient.display,
  };
}
