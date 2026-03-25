const CLAUDE_API_URL = process.env.CLAUDE_API_URL;
const SERVICE_SECRET = process.env.CLAUDE_API_SERVICE_SECRET;

export type ReceiptData = {
  store: string;
  date: string;
  items: { name: string; price: number; category: string }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
};

export type MealSuggestion = {
  recipeName: string;
  reasoning: string;
  missingIngredients: string[];
  difficulty: string;
  estimatedTime: string;
};

export type ShoppingOptimizeResult = {
  items: {
    name: string;
    quantity: number | string;
    unit: string | null;
    category: string;
    notes: string | null;
  }[];
  tips: string[];
};

export type CategorizeResult = {
  category: string;
  confidence: number;
  reasoning: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

async function callClaudeApi<T>(endpoint: string, body: Record<string, unknown>): Promise<ApiResponse<T>> {
  if (!CLAUDE_API_URL || !SERVICE_SECRET) {
    return { success: false, error: "Claude API not configured", code: "NOT_CONFIGURED" };
  }

  const res = await fetch(`${CLAUDE_API_URL}/api/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_SECRET}`,
      "X-Requesting-App": "meal_prep",
    },
    body: JSON.stringify(body),
  });

  return res.json();
}

export async function parseReceipt(imageBase64: string, mimeType: string): Promise<ApiResponse<ReceiptData>> {
  return callClaudeApi<ReceiptData>("receipt-parse", { image: imageBase64, mimeType });
}

export async function suggestMeals(
  ingredients: string[],
  preferences?: string,
  count?: number
): Promise<ApiResponse<{ suggestions: MealSuggestion[] }>> {
  return callClaudeApi<{ suggestions: MealSuggestion[] }>("meal-suggest", {
    ingredients,
    preferences,
    count: count ?? 5,
  });
}

export async function optimizeShoppingList(
  recipes: { name: string; ingredients: string[] }[],
  pantryItems: { name: string; quantity: number; unit: string | null }[],
  stores?: string[]
): Promise<ApiResponse<ShoppingOptimizeResult>> {
  return callClaudeApi<ShoppingOptimizeResult>("shopping-optimize", {
    recipes,
    pantryItems,
    stores,
  });
}

export async function categorizeProduct(
  productName: string,
  categories?: string[]
): Promise<ApiResponse<CategorizeResult>> {
  return callClaudeApi<CategorizeResult>("categorize", {
    description: productName,
    categories: categories ?? [
      "Produce", "Dairy", "Meat & Seafood", "Bakery", "Frozen",
      "Canned Goods", "Snacks", "Beverages", "Condiments & Sauces",
      "Grains & Pasta", "Baking", "Spices", "Household", "Personal Care", "Other",
    ],
  });
}
