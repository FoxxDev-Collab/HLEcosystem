// The ingredient pipeline: Mealie ingredient → normalized name → matched or
// created "Product" row. The legacy app duplicated parseIngredient /
// normalizeIngredientName / findOrCreateProduct across four actions files —
// this is the single shared port.
import { sql } from "@/server/db"
import type { MealieIngredient } from "./mealie"

export type ProductUnit =
  | "EACH"
  | "LB"
  | "OZ"
  | "GALLON"
  | "QUART"
  | "LITER"
  | "COUNT"
  | "PACK"
  | "BAG"
  | "BOX"
  | "CAN"
  | "BOTTLE"
  | "BUNCH"
  | "DOZEN"

export const PRODUCT_UNITS: Array<ProductUnit> = [
  "EACH",
  "LB",
  "OZ",
  "GALLON",
  "QUART",
  "LITER",
  "COUNT",
  "PACK",
  "BAG",
  "BOX",
  "CAN",
  "BOTTLE",
  "BUNCH",
  "DOZEN",
]

// ── Normalization ───────────────────────────────────────
// Mealie food names often contain container types ("can tomato sauce"),
// preparation notes ("freshly ground black pepper"), and units embedded in
// the name ("garlic cloves"). We need clean product names for shopping.

const CONTAINER_PREFIXES =
  /^(can|cans|bottle|bottles|bag|bags|box|boxes|bunch|bunches|head|heads|clove|cloves|jar|jars|package|packages|packet|packets|stick|sticks|sprig|sprigs|stalk|stalks|ear|ears|slice|slices|piece|pieces|cube|cubes|dash|dashes|pinch|pinches)\s+/i

const PREP_DESCRIPTORS =
  /\b(freshly|finely|thinly|roughly|coarsely|minced|diced|chopped|sliced|grated|shredded|crushed|ground|melted|softened|cubed|julienned|peeled|seeded|trimmed|halved|quartered|divided|packed|sifted|beaten|whisked|room temperature|cold|warm|hot|frozen|thawed|drained|rinsed|toasted|roasted|dried|fresh|extra|virgin|light|lean|large|medium|small|thick|thin)\s*/gi

const SIZE_QUALIFIERS = /\b(small|medium|large|extra-large|jumbo)\b\s*/gi

// Remove everything after ( or , — "onion, finely chopped" → "onion"
const TRAILING_NOTES = /\s*[(,].*$/

// "85%-90% lean" → ""
const PERCENTAGE = /\s*\d+%[-\s]*\d*%?\s*(lean|fat)?\s*/gi

export function normalizeIngredientName(ingredient: MealieIngredient): string {
  let name: string

  if (ingredient.food?.name) {
    name = ingredient.food.name
  } else {
    // Fallback: strip leading quantity/unit from the display string.
    name = ingredient.display
      .replace(/^[\d\s/⅛⅙⅕¼⅓⅜½⅝⅔¾⅞]+/, "")
      .replace(
        /^(oz|lb|lbs|cup|cups|tsp|tbsp|tablespoon|tablespoons|teaspoon|teaspoons|pound|pounds|ounce|ounces|gallon|quart|liter|ml|g|kg)\.?\s+/i,
        ""
      )
      .trim()
  }

  name = name
    .replace(TRAILING_NOTES, "")
    .replace(PERCENTAGE, " ")
    .replace(CONTAINER_PREFIXES, "")
    .replace(SIZE_QUALIFIERS, "")
    .replace(PREP_DESCRIPTORS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

  // Remove "or ..." alternatives: "yellow mustard or to taste" → "yellow mustard"
  name = name.replace(/\s+or\s+.*$/i, "").trim()

  // Remove trailing "to taste", "as needed", "if desired" etc.
  name = name
    .replace(
      /\s+(to taste|as needed|if desired|if needed|optional|for serving|for garnish|for topping)$/i,
      ""
    )
    .trim()

  return name
}

export function cleanProductDisplayName(ingredient: MealieIngredient): string {
  const normalized = normalizeIngredientName(ingredient)
  if (!normalized) return ""
  return titleCase(normalized)
}

export function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export type ParsedIngredient = {
  productName: string // Clean product name for the DB ("Tomato Sauce")
  normalizedKey: string // Lowercase key for matching ("tomato sauce")
  quantity: number // Numeric quantity (15)
  unit: string | null // Unit from Mealie ("oz", "cup", "lb")
  recipeNote: string // Original display for context ("15 oz can tomato sauce")
}

export function parseIngredient(
  ingredient: MealieIngredient
): ParsedIngredient | null {
  const normalizedKey = normalizeIngredientName(ingredient)
  if (!normalizedKey || normalizedKey.length < 2) return null
  return {
    productName: cleanProductDisplayName(ingredient),
    normalizedKey,
    quantity: ingredient.quantity || 1,
    unit: ingredient.unit?.name || null,
    recipeNote: ingredient.display,
  }
}

// ── Aggregation (merge duplicate ingredients, summed quantities) ──

export type AggregatedIngredient = {
  parsed: ParsedIngredient
  totalQuantity: number
  recipeNotes: Array<string>
}

export function aggregateIngredients(
  allIngredients: Array<ParsedIngredient>
): Map<string, AggregatedIngredient> {
  const aggregated = new Map<string, AggregatedIngredient>()
  for (const parsed of allIngredients) {
    const existing = aggregated.get(parsed.normalizedKey)
    if (existing) {
      existing.totalQuantity += parsed.quantity
      if (!existing.recipeNotes.includes(parsed.recipeNote)) {
        existing.recipeNotes.push(parsed.recipeNote)
      }
    } else {
      aggregated.set(parsed.normalizedKey, {
        parsed,
        totalQuantity: parsed.quantity,
        recipeNotes: [parsed.recipeNote],
      })
    }
  }
  return aggregated
}

// ── Mealie unit name → "ProductUnit" enum ───────────────

const UNIT_MAP: Record<string, ProductUnit> = {
  each: "EACH",
  lb: "LB",
  lbs: "LB",
  pound: "LB",
  pounds: "LB",
  oz: "OZ",
  ounce: "OZ",
  ounces: "OZ",
  gallon: "GALLON",
  gallons: "GALLON",
  quart: "QUART",
  quarts: "QUART",
  liter: "LITER",
  liters: "LITER",
  count: "COUNT",
  pack: "PACK",
  packs: "PACK",
  bag: "BAG",
  bags: "BAG",
  box: "BOX",
  boxes: "BOX",
  can: "CAN",
  cans: "CAN",
  bottle: "BOTTLE",
  bottles: "BOTTLE",
  bunch: "BUNCH",
  bunches: "BUNCH",
  dozen: "DOZEN",
  cup: "EACH",
  cups: "EACH",
  tablespoon: "EACH",
  tablespoons: "EACH",
  teaspoon: "EACH",
  teaspoons: "EACH",
  tbsp: "EACH",
  tsp: "EACH",
}

export function mapUnit(unitName: string | null): ProductUnit {
  if (!unitName) return "EACH"
  return UNIT_MAP[unitName.toLowerCase().trim()] ?? "EACH"
}

// ── Product matching ────────────────────────────────────

// All products of the household keyed by lowercased name.
export async function loadProductLookup(
  householdId: string
): Promise<Map<string, string>> {
  const rows = await sql<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "Product"
    WHERE "householdId" = ${householdId}`
  const lookup = new Map<string, string>()
  for (const p of rows) lookup.set(p.name.toLowerCase(), p.id)
  return lookup
}

// Find a product by normalized key in the lookup, or create it.
// Matching is exact on the lowercased name; keys shorter than 4 chars never
// fuzzy-match (avoids "oil" matching "olive oil") — legacy rule.
export async function findOrCreateProduct(
  householdId: string,
  productName: string,
  normalizedKey: string,
  lookup: Map<string, string>,
  options?: { defaultUnit?: ProductUnit; categoryId?: string | null }
): Promise<string> {
  const existing =
    lookup.get(normalizedKey) ?? lookup.get(productName.toLowerCase())
  if (existing) return existing

  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "Product" ("householdId", "name", "defaultUnit", "categoryId")
    VALUES (${householdId}, ${productName},
            ${options?.defaultUnit ?? "EACH"}::"ProductUnit",
            ${options?.categoryId ?? null})
    RETURNING "id"`
  const id = rows[0].id
  lookup.set(normalizedKey, id)
  lookup.set(productName.toLowerCase(), id)
  return id
}

// Case-insensitive product lookup straight from the DB (used by flows that
// don't preload the full lookup map).
export async function findProductByName(
  householdId: string,
  name: string
): Promise<{ id: string; name: string } | null> {
  const rows = await sql<Array<{ id: string; name: string }>>`
    SELECT "id", "name" FROM "Product"
    WHERE "householdId" = ${householdId} AND lower("name") = lower(${name})
    LIMIT 1`
  return rows[0] ?? null
}

// Find or create a "ProductCategory" by name (Mealie label → category).
export async function findOrCreateCategory(
  householdId: string,
  name: string
): Promise<string> {
  const existing = await sql<Array<{ id: string }>>`
    SELECT "id" FROM "ProductCategory"
    WHERE "householdId" = ${householdId} AND lower("name") = lower(${name})
    LIMIT 1`
  if (existing[0]) return existing[0].id
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO "ProductCategory" ("householdId", "name")
    VALUES (${householdId}, ${name})
    RETURNING "id"`
  return rows[0].id
}
