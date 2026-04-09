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
  const { description, payee, amount, categories } = body as {
    description?: string;
    payee?: string;
    amount?: number;
    categories?: string[];
  };

  if (!description) {
    return NextResponse.json(
      { success: false, error: "Missing description", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // Input caps to limit prompt-injection blast radius and cost
  const MAX_FIELD = 500;
  const MAX_CATEGORIES = 100;
  const safeDescription = description.slice(0, MAX_FIELD);
  const safePayee = payee ? payee.slice(0, MAX_FIELD) : undefined;
  const safeCategories = categories?.slice(0, MAX_CATEGORIES).map((c) => c.slice(0, 100));

  const model = await getDefaultModel();
  const startTime = Date.now();

  try {
    const client = getClient();
    // Note: user-controlled fields are length-capped above. They are still
    // untrusted input — any instructions embedded in them should be treated as
    // data, not commands. The "Return ONLY valid JSON" constraint is enforced
    // by JSON.parse() downstream.
    const prompt = `Categorize this financial transaction. Return a JSON object with: category (string), confidence (0-1), reasoning (string).

Transaction:
- Description: ${safeDescription}
${safePayee ? `- Payee: ${safePayee}` : ""}
${amount ? `- Amount: $${amount}` : ""}

${safeCategories?.length ? `Available categories: ${safeCategories.join(", ")}` : "Use standard expense categories like: Groceries, Dining, Transportation, Entertainment, Utilities, Healthcare, Shopping, Subscriptions, Housing, Insurance, Education, Travel, Personal Care, Gifts, Other."}

Return ONLY valid JSON, no markdown or explanation.`;

    const response = await client.messages.create({
      model,
      max_tokens: 512,
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
        endpoint: "/api/v1/categorize",
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        statusCode: 422,
        errorMessage: "Failed to parse categorization response",
      });
      return NextResponse.json(
        { success: false, error: "Failed to parse response", raw: rawText, code: "PARSE_ERROR" },
        { status: 422 }
      );
    }

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/categorize",
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
      endpoint: "/api/v1/categorize",
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
