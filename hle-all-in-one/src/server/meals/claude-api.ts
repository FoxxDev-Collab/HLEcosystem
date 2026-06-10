// Internal AI gateway client (hle-claude_api). Ported from
// hle-meal_prep/lib/claude-api.ts. Server-side only — the service secret
// never reaches the client. GRACEFUL DEGRADATION: when CLAUDE_API_URL /
// CLAUDE_API_SERVICE_SECRET are unset, every call resolves to
// { success: false, code: "NOT_CONFIGURED" } and callers surface
// "AI features not configured" to the UI.

export type ReceiptData = {
  store: string
  date: string
  items: Array<{ name: string; price: number; category: string }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
}

export type MealSuggestion = {
  recipeName: string
  reasoning: string
  missingIngredients: Array<string>
  difficulty: string
  estimatedTime: string
}

export type ShoppingOptimizeResult = {
  items: Array<{
    name: string
    quantity: number | string
    unit: string | null
    category: string
    notes: string | null
  }>
  tips: Array<string>
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export function isAiConfigured(): boolean {
  return !!(process.env.CLAUDE_API_URL && process.env.CLAUDE_API_SERVICE_SECRET)
}

async function callClaudeApi<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const apiUrl = process.env.CLAUDE_API_URL
  const serviceSecret = process.env.CLAUDE_API_SERVICE_SECRET
  if (!apiUrl || !serviceSecret) {
    return {
      success: false,
      error: "AI features not configured",
      code: "NOT_CONFIGURED",
    }
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceSecret}`,
        "X-Requesting-App": "meal_prep",
      },
      body: JSON.stringify(body),
    })
    return (await res.json()) as ApiResponse<T>
  } catch {
    return { success: false, error: "AI gateway unreachable" }
  }
}

export async function parseReceipt(
  imageBase64: string,
  mimeType: string
): Promise<ApiResponse<ReceiptData>> {
  return callClaudeApi<ReceiptData>("receipt-parse", {
    image: imageBase64,
    mimeType,
  })
}

export async function suggestMeals(
  ingredients: Array<string>,
  preferences?: string,
  count?: number
): Promise<ApiResponse<{ suggestions: Array<MealSuggestion> }>> {
  return callClaudeApi<{ suggestions: Array<MealSuggestion> }>("meal-suggest", {
    ingredients,
    preferences,
    count: count ?? 5,
  })
}

export async function optimizeShoppingList(
  recipes: Array<{ name: string; ingredients: Array<string> }>,
  pantryItems: Array<{ name: string; quantity: number; unit: string | null }>,
  stores?: Array<string>
): Promise<ApiResponse<ShoppingOptimizeResult>> {
  return callClaudeApi<ShoppingOptimizeResult>("shopping-optimize", {
    recipes,
    pantryItems,
    stores,
  })
}
