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
  const { ingredients, preferences, count } = body as {
    ingredients?: string[];
    preferences?: string;
    count?: number;
  };

  if (!ingredients || ingredients.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing ingredients list", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();
  const suggestionCount = Math.min(count ?? 5, 10);

  try {
    const client = getClient();
    const prompt = `You are a helpful meal planning assistant. Given the following pantry ingredients, suggest ${suggestionCount} meal ideas that prioritize using these items.

Available ingredients:
${ingredients.map((i) => `- ${i}`).join("\n")}

${preferences ? `Dietary preferences / notes: ${preferences}` : ""}

For each suggestion, return a JSON object with these fields:
- recipeName (string): The name of the dish
- reasoning (string): Brief explanation of why this recipe is a good fit (which ingredients it uses)
- missingIngredients (string[]): Any common ingredients NOT in the pantry list that would be needed
- difficulty (string): "easy", "medium", or "hard"
- estimatedTime (string): Approximate cook time like "30 min", "1 hour"

Return a JSON object: { "suggestions": [...] }

Prioritize recipes that:
1. Use the most pantry items possible (minimize waste)
2. Require few additional ingredients
3. Are practical everyday meals

Return ONLY valid JSON, no markdown or explanation.`;

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
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
        endpoint: "/api/v1/meal-suggest",
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        statusCode: 422,
        errorMessage: "Failed to parse meal suggestion response",
      });
      return NextResponse.json(
        { success: false, error: "Failed to parse response", raw: rawText, code: "PARSE_ERROR" },
        { status: 422 }
      );
    }

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/meal-suggest",
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
      endpoint: "/api/v1/meal-suggest",
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
