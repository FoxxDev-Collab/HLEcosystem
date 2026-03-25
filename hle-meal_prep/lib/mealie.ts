import prisma from "./prisma";

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

export type MealieRecipe = MealieRecipeSummary & {
  recipeIngredient: MealieIngredient[];
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

async function mealieFetch<T>(config: MealieConfigData, path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 60 },
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
  const config = await getMealieConfig(householdId);
  if (!config) return [];
  return mealieFetch<MealieMealPlanEntry[]>(config, "/api/households/mealplans/today");
}

export async function getMealPlan(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<MealieMealPlanEntry[]> {
  const config = await getMealieConfig(householdId);
  if (!config) return [];

  const data = await mealieFetch<MealieMealPlanEntry[] | { items: MealieMealPlanEntry[] }>(
    config,
    `/api/households/mealplans?start_date=${startDate}&end_date=${endDate}`
  );
  return Array.isArray(data) ? data : data.items;
}

export async function getRecipe(householdId: string, slugOrId: string): Promise<MealieRecipe> {
  const config = await getMealieConfig(householdId);
  if (!config) throw new Error("Mealie is not configured for this household");
  return mealieFetch<MealieRecipe>(config, `/api/recipes/${slugOrId}`);
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

export async function getRecipes(
  householdId: string,
  page: number,
  perPage: number,
  search?: string
): Promise<{ items: MealieRecipeSummary[]; total: number; totalPages: number }> {
  const config = await getMealieConfig(householdId);
  if (!config) return { items: [], total: 0, totalPages: 0 };

  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });
  if (search) params.set("search", search);

  const data = await mealieFetch<{
    items: MealieRecipeSummary[];
    total: number;
    total_pages: number;
    page: number;
    per_page: number;
  }>(config, `/api/recipes?${params.toString()}`);

  return { items: data.items, total: data.total, totalPages: data.total_pages };
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
