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
  const { transactions, debts, bills, recurring } = body as {
    transactions?: Array<{
      id: string; date: string; amount: number; payee: string | null;
      description: string | null; accountName: string; categoryName: string | null; type: string;
    }>;
    debts?: Array<{
      id: string; name: string; type: string; lender: string | null;
      currentBalance: number; interestRate: number; minimumPayment: number | null;
      paymentDayOfMonth: number | null;
    }>;
    bills?: Array<{
      id: string; name: string; payee: string | null; category: string;
      expectedAmount: number; dueDayOfMonth: number;
    }>;
    recurring?: Array<{
      id: string; name: string; payee: string | null; amount: number;
      frequency: string; type: string;
    }>;
  };

  if (!transactions?.length) {
    return NextResponse.json(
      { success: false, error: "Missing transactions", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();

  const debtsList = (debts || []).map(d =>
    `- [${d.id}] "${d.name}" (${d.type}) — Lender: ${d.lender || "N/A"}, Balance: $${d.currentBalance.toFixed(2)}, Rate: ${(d.interestRate * 100).toFixed(2)}%, Min: $${d.minimumPayment?.toFixed(2) || "N/A"}, Day: ${d.paymentDayOfMonth || "N/A"}`
  ).join("\n");

  const billsList = (bills || []).map(b =>
    `- [${b.id}] "${b.name}" — Payee: ${b.payee || "N/A"}, Category: ${b.category}, Expected: $${b.expectedAmount.toFixed(2)}, Due day: ${b.dueDayOfMonth}`
  ).join("\n");

  const recurringList = (recurring || []).map(r =>
    `- [${r.id}] "${r.name}" — Payee: ${r.payee || "N/A"}, Amount: $${r.amount.toFixed(2)}, Frequency: ${r.frequency}, Type: ${r.type}`
  ).join("\n");

  const txList = transactions.map(t =>
    `- [${t.id}] ${t.date} | ${t.type} | $${Math.abs(t.amount).toFixed(2)} | Payee: "${t.payee || ""}" | Desc: "${t.description || ""}" | Account: ${t.accountName} | Category: ${t.categoryName || "None"}`
  ).join("\n");

  const prompt = `You are a financial transaction analyst. Analyze unlinked bank transactions and match them to the household's known debts, bills, or recurring payment patterns.

DEBTS (loans/debts the household is paying off):
${debtsList || "None tracked"}

BILLS (monthly bills):
${billsList || "None tracked"}

RECURRING TRANSACTION PATTERNS:
${recurringList || "None tracked"}

UNLINKED TRANSACTIONS TO ANALYZE:
${txList}

For each transaction that matches a debt, bill, or recurring pattern, return a match. Consider:
- Payee name similarity (e.g., "Wells Fargo Mortgage" matches a Wells Fargo mortgage debt)
- Amount proximity (e.g., $2,450.00 near a $2,400 minimum payment)
- Timing patterns (payment on the 1st matches dueDayOfMonth=1)
- Transaction descriptions containing loan or account references
- Category hints (e.g., a transaction categorized as "Insurance" matching an insurance bill)

For debt payment matches, estimate the principal vs interest split using simple monthly amortization: monthly_interest = balance * (annual_rate / 12), principal = payment - monthly_interest.

Return ONLY valid JSON:
{
  "matches": [
    {
      "transactionId": "string",
      "matchType": "debt" | "bill" | "recurring",
      "matchId": "string (the debt/bill/recurring id)",
      "matchName": "string (name of matched item for display)",
      "confidence": 0.0 to 1.0,
      "reasoning": "brief explanation of why this matches",
      "suggestedPrincipal": number | null,
      "suggestedInterest": number | null,
      "payeePattern": "string (normalized payee pattern for auto-mapping, e.g. 'wells fargo mortgage')"
    }
  ]
}

Only include matches with confidence >= 0.5. Many transactions will be ordinary purchases — do NOT force-match everything.`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
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
        endpoint: "/api/v1/finance-smart-link",
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        statusCode: 422,
        errorMessage: "Failed to parse smart-link response",
      });
      return NextResponse.json(
        { success: false, error: "Failed to parse response", raw: rawText, code: "PARSE_ERROR" },
        { status: 422 }
      );
    }

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/finance-smart-link",
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
      endpoint: "/api/v1/finance-smart-link",
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
