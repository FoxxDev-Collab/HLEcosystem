const CLAUDE_API_URL = process.env.CLAUDE_API_URL;
const SERVICE_SECRET = process.env.CLAUDE_API_SERVICE_SECRET;

type ReceiptItem = {
  name: string;
  price: number;
  category: string;
};

export type ReceiptData = {
  store: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string | null;
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
      "X-Requesting-App": "family_finance",
    },
    body: JSON.stringify(body),
  });

  return res.json();
}

export async function parseReceipt(imageBase64: string, mimeType: string): Promise<ApiResponse<ReceiptData>> {
  return callClaudeApi<ReceiptData>("receipt-parse", { image: imageBase64, mimeType });
}

export async function categorizeTransaction(
  description: string,
  payee?: string,
  amount?: number,
  categories?: string[]
): Promise<ApiResponse<CategorizeResult>> {
  return callClaudeApi<CategorizeResult>("categorize", { description, payee, amount, categories });
}
