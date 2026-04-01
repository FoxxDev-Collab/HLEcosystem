import { NextRequest, NextResponse } from "next/server";
import { validateServiceAuth } from "@/lib/service-auth";
import { isServiceEnabled, getDefaultModel } from "@/lib/service-config";
import { getClient } from "@/lib/claude";
import { logUsage } from "@/lib/usage-logger";

export async function POST(request: NextRequest) {
  const auth = validateServiceAuth(request);
  if (!auth.valid) return auth.response;

  if (!(await isServiceEnabled())) {
    return NextResponse.json(
      { success: false, error: "Service is disabled", code: "SERVICE_DISABLED" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const {
    accounts, currentMonth, previousMonths, debts, bills,
    recurring, budgets, netWorth, totalAssets, totalDebts, totalCash,
  } = body as Record<string, unknown>;

  if (!accounts || !currentMonth) {
    return NextResponse.json(
      { success: false, error: "Missing financial data", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();

  const prompt = `You are a certified financial planner analyzing a household's finances. Provide a comprehensive, actionable financial assessment.

HOUSEHOLD FINANCIAL SNAPSHOT:

Accounts:
${JSON.stringify(accounts, null, 1)}

Net Worth: $${Number(netWorth || 0).toLocaleString()} (Assets: $${Number(totalAssets || 0).toLocaleString()}, Cash: $${Number(totalCash || 0).toLocaleString()}, Debts: $${Number(totalDebts || 0).toLocaleString()})

Current Month:
${JSON.stringify(currentMonth, null, 1)}

Previous Months:
${JSON.stringify(previousMonths || [], null, 1)}

Debts:
${JSON.stringify(debts || [], null, 1)}

Monthly Bills:
${JSON.stringify(bills || [], null, 1)}

Recurring Transactions:
${JSON.stringify(recurring || [], null, 1)}

Budget vs Actual:
${JSON.stringify(budgets || [], null, 1)}

Analyze this data and return ONLY valid JSON with this structure:
{
  "healthScore": {
    "score": 0-100,
    "grade": "A+" to "F",
    "summary": "1-2 sentence overall assessment"
  },
  "spendingAnalysis": {
    "topCategories": [{ "category": "string", "amount": number, "trend": "up" | "down" | "stable", "note": "string" }],
    "anomalies": [{ "description": "string", "amount": number, "severity": "info" | "warning" | "alert" }],
    "monthOverMonth": "1-2 sentence trend summary"
  },
  "subscriptionDetection": [
    { "name": "string", "estimatedMonthly": number, "confidence": 0-1, "suggestion": "keep" | "review" | "cancel" }
  ],
  "debtStrategy": {
    "totalDebt": number,
    "avalancheOrder": [{ "name": "string", "rate": number, "balance": number }],
    "snowballOrder": [{ "name": "string", "rate": number, "balance": number }],
    "recommendation": "avalanche" | "snowball",
    "reasoning": "string",
    "estimatedPayoffMonths": number,
    "totalInterestSaved": number
  },
  "budgetRecommendations": [
    { "category": "string", "current": number, "suggested": number, "reasoning": "string" }
  ],
  "savingsOpportunities": [
    { "description": "string", "estimatedMonthlySavings": number, "difficulty": "easy" | "moderate" | "hard" }
  ],
  "actionItems": [
    { "priority": 1-5, "title": "string", "description": "string", "impact": "high" | "medium" | "low" }
  ],
  "unlinkedTransactionCheck": {
    "hasUnlinkedPayments": true/false,
    "message": "string describing if there are likely debt/bill payments not yet linked"
  }
}

Be specific and actionable. Use actual numbers from the data. For health score: 80+ is good, 60-79 needs work, below 60 needs urgent attention. Consider debt-to-income ratio, savings rate, emergency fund coverage, and budget adherence.`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const durationMs = Date.now() - startTime;
    const textContent = response.content.find((c) => c.type === "text");
    const rawText = textContent?.type === "text" ? textContent.text : "";

    let data;
    try {
      const jsonStr = rawText.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
      data = JSON.parse(jsonStr);
    } catch {
      await logUsage({
        requestingApp: auth.app,
        endpoint: "/api/v1/finance-advisor",
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        statusCode: 422,
        errorMessage: "Failed to parse advisor response",
      });
      return NextResponse.json(
        { success: false, error: "Failed to parse response", raw: rawText, code: "PARSE_ERROR" },
        { status: 422 }
      );
    }

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/finance-advisor",
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      statusCode: 200,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/finance-advisor",
      model,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startTime,
      statusCode: 500,
      errorMessage,
    });
    return NextResponse.json(
      { success: false, error: errorMessage, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
