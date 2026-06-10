// Internal AI gateway client (hle-claude_api). Ported from
// hle-family_finance/lib/claude-api.ts, shaped like src/server/meals/
// claude-api.ts. Server-side only — the service secret never reaches the
// client. GRACEFUL DEGRADATION: when CLAUDE_API_URL /
// CLAUDE_API_SERVICE_SECRET are unset, every call resolves to
// { success: false, code: "NOT_CONFIGURED" } and callers surface
// "AI gateway not configured" to the UI instead of crashing.

export type ReceiptData = {
  store: string
  date: string
  items: Array<{ name: string; price: number; category: string }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
}

export type CategorizeResult = {
  category: string
  confidence: number
  reasoning: string
}

export type SmartLinkMatch = {
  transactionId: string
  matchType: "debt" | "bill" | "recurring"
  matchId: string
  matchName: string
  confidence: number
  reasoning: string
  suggestedPrincipal: number | null
  suggestedInterest: number | null
  payeePattern: string
}

export type SuggestedBill = {
  name: string
  payee: string
  category:
    | "UTILITIES"
    | "INSURANCE"
    | "SUBSCRIPTIONS"
    | "PHONE"
    | "INTERNET"
    | "RENT"
    | "MORTGAGE"
    | "CAR_PAYMENT"
    | "CHILD_CARE"
    | "STREAMING"
    | "OTHER"
  expectedAmount: number
  dueDayOfMonth: number
  transactionIds: Array<string>
  confidence: number
  reasoning: string
}

export type SuggestedRecurring = {
  name: string
  payee: string
  amount: number
  frequency: "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
  transactionIds: Array<string>
  confidence: number
  reasoning: string
}

export type SmartLinkResult = {
  matches: Array<SmartLinkMatch>
  suggestedBills: Array<SuggestedBill>
  suggestedRecurring: Array<SuggestedRecurring>
}

export type AdvisorHealthScore = {
  score: number
  grade: string
  summary: string
}

export type AdvisorSpendingAnalysis = {
  topCategories: Array<{
    category: string
    amount: number
    trend: "up" | "down" | "stable"
    note: string
  }>
  anomalies: Array<{
    description: string
    amount: number
    severity: "info" | "warning" | "alert"
  }>
  monthOverMonth: string
}

export type AdvisorReportData = {
  healthScore: AdvisorHealthScore
  spendingAnalysis: AdvisorSpendingAnalysis
  subscriptionDetection: Array<{
    name: string
    estimatedMonthly: number
    confidence: number
    suggestion: "keep" | "review" | "cancel"
  }>
  debtStrategy: {
    totalDebt: number
    avalancheOrder: Array<{ name: string; rate: number; balance: number }>
    snowballOrder: Array<{ name: string; rate: number; balance: number }>
    recommendation: "avalanche" | "snowball"
    reasoning: string
    estimatedPayoffMonths: number
    totalInterestSaved: number
  }
  budgetRecommendations: Array<{
    category: string
    current: number
    suggested: number
    reasoning: string
  }>
  savingsOpportunities: Array<{
    description: string
    estimatedMonthlySavings: number
    difficulty: "easy" | "moderate" | "hard"
  }>
  actionItems: Array<{
    priority: number
    title: string
    description: string
    impact: "high" | "medium" | "low"
  }>
  unlinkedTransactionCheck: { hasUnlinkedPayments: boolean; message: string }
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export const AI_NOT_CONFIGURED_ERROR = "AI gateway not configured"

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
      error: AI_NOT_CONFIGURED_ERROR,
      code: "NOT_CONFIGURED",
    }
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceSecret}`,
        "X-Requesting-App": "family_finance",
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

export async function categorizeTransaction(
  description: string,
  payee?: string,
  amount?: number,
  categories?: Array<string>
): Promise<ApiResponse<CategorizeResult>> {
  return callClaudeApi<CategorizeResult>("categorize", {
    description,
    payee,
    amount,
    categories,
  })
}

export async function smartLinkTransactions(payload: {
  transactions: Array<Record<string, unknown>>
  debts: Array<Record<string, unknown>>
  bills: Array<Record<string, unknown>>
  recurring: Array<Record<string, unknown>>
}): Promise<ApiResponse<SmartLinkResult>> {
  return callClaudeApi<SmartLinkResult>("finance-smart-link", payload)
}

export async function generateAdvisorReport(
  snapshot: Record<string, unknown>
): Promise<ApiResponse<AdvisorReportData>> {
  return callClaudeApi<AdvisorReportData>("finance-advisor", snapshot)
}
