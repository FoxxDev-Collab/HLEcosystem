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
  const { recipes, pantryItems, stores } = body as {
    recipes?: { name: string; ingredients: string[] }[];
    pantryItems?: { name: string; quantity: number; unit: string | null }[];
    stores?: string[];
  };

  if (!recipes || recipes.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing recipes list", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();

  try {
    const client = getClient();
    const prompt = `You are a smart shopping list optimizer. Given planned recipes and current pantry inventory, generate an optimized shopping list of ONLY what needs to be purchased.

Planned recipes:
${recipes.map((r) => `- ${r.name}: ${r.ingredients.join(", ")}`).join("\n")}

Current pantry inventory:
${pantryItems && pantryItems.length > 0 ? pantryItems.map((p) => `- ${p.name}: ${p.quantity}${p.unit ? ` ${p.unit}` : ""}`).join("\n") : "Empty pantry"}

${stores && stores.length > 0 ? `Available stores: ${stores.join(", ")}` : ""}

Instructions:
1. Subtract pantry items from recipe requirements
2. Combine duplicate ingredients across recipes
3. Group items by grocery store aisle/category
4. Suggest reasonable quantities

Return a JSON object with:
- items: array of { name (string), quantity (number or string like "2-3"), unit (string or null), category (string - grocery aisle like "Produce", "Dairy", "Meat & Seafood", "Bakery", "Frozen", "Canned Goods", "Snacks", "Beverages", "Condiments & Sauces", "Grains & Pasta", "Baking", "Spices"), notes (string or null - e.g. "for Recipe X") }
- tips: array of strings (shopping tips, e.g. "Buy the larger bag of rice — you'll use it across 3 recipes")

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
        endpoint: "/api/v1/shopping-optimize",
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        statusCode: 422,
        errorMessage: "Failed to parse shopping optimization response",
      });
      return NextResponse.json(
        { success: false, error: "Failed to parse response", raw: rawText, code: "PARSE_ERROR" },
        { status: 422 }
      );
    }

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/shopping-optimize",
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
      endpoint: "/api/v1/shopping-optimize",
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
