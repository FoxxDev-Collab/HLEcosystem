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

// ── Smart Link Types ────────────────────────────────────────────

export type SmartLinkMatch = {
  transactionId: string;
  matchType: "debt" | "bill" | "recurring";
  matchId: string;
  matchName: string;
  confidence: number;
  reasoning: string;
  suggestedPrincipal: number | null;
  suggestedInterest: number | null;
  payeePattern: string;
};

export type SuggestedBill = {
  name: string;
  payee: string;
  category: "UTILITIES" | "INSURANCE" | "SUBSCRIPTIONS" | "PHONE" | "INTERNET" | "RENT" | "MORTGAGE" | "CAR_PAYMENT" | "CHILD_CARE" | "STREAMING" | "OTHER";
  expectedAmount: number;
  dueDayOfMonth: number;
  transactionIds: string[];
  confidence: number;
  reasoning: string;
};

export type SuggestedRecurring = {
  name: string;
  payee: string;
  amount: number;
  frequency: "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  transactionIds: string[];
  confidence: number;
  reasoning: string;
};

export type SmartLinkResult = {
  matches: SmartLinkMatch[];
  suggestedBills: SuggestedBill[];
  suggestedRecurring: SuggestedRecurring[];
};

export async function smartLinkTransactions(payload: {
  transactions: Record<string, unknown>[];
  debts: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  recurring: Record<string, unknown>[];
}): Promise<ApiResponse<SmartLinkResult>> {
  return callClaudeApi<SmartLinkResult>("finance-smart-link", payload);
}

// ── Advisor Types ───────────────────────────────────────────────

export type AdvisorHealthScore = {
  score: number;
  grade: string;
  summary: string;
};

export type AdvisorSpendingAnalysis = {
  topCategories: Array<{ category: string; amount: number; trend: "up" | "down" | "stable"; note: string }>;
  anomalies: Array<{ description: string; amount: number; severity: "info" | "warning" | "alert" }>;
  monthOverMonth: string;
};

export type AdvisorReport = {
  healthScore: AdvisorHealthScore;
  spendingAnalysis: AdvisorSpendingAnalysis;
  subscriptionDetection: Array<{ name: string; estimatedMonthly: number; confidence: number; suggestion: "keep" | "review" | "cancel" }>;
  debtStrategy: {
    totalDebt: number;
    avalancheOrder: Array<{ name: string; rate: number; balance: number }>;
    snowballOrder: Array<{ name: string; rate: number; balance: number }>;
    recommendation: "avalanche" | "snowball";
    reasoning: string;
    estimatedPayoffMonths: number;
    totalInterestSaved: number;
  };
  budgetRecommendations: Array<{ category: string; current: number; suggested: number; reasoning: string }>;
  savingsOpportunities: Array<{ description: string; estimatedMonthlySavings: number; difficulty: "easy" | "moderate" | "hard" }>;
  actionItems: Array<{ priority: number; title: string; description: string; impact: "high" | "medium" | "low" }>;
  unlinkedTransactionCheck: { hasUnlinkedPayments: boolean; message: string };
};

export async function generateAdvisorReport(
  snapshot: Record<string, unknown>
): Promise<ApiResponse<AdvisorReport>> {
  return callClaudeApi<AdvisorReport>("finance-advisor", snapshot);
}
