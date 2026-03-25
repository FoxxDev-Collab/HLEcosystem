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
  const { image, mimeType } = body as { image?: string; mimeType?: string };

  if (!image || !mimeType) {
    return NextResponse.json(
      { success: false, error: "Missing image or mimeType", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();
  let statusCode = 200;
  let errorMessage: string | undefined;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: image },
            },
            {
              type: "text",
              text: `Extract all information from this receipt. Return a JSON object with these fields:
- store: string (store name)
- date: string (YYYY-MM-DD format)
- items: array of { name: string, price: number, category: string }
- subtotal: number
- tax: number
- total: number
- paymentMethod: string or null

Categories for items should be one of: produce, meat, dairy, bakery, frozen, beverages, snacks, household, personal_care, other.

Return ONLY valid JSON, no markdown or explanation.`,
            },
          ],
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const textContent = response.content.find((c) => c.type === "text");
    const rawText = textContent?.type === "text" ? textContent.text : "";

    // Parse the JSON from Claude's response
    let data;
    try {
      // Strip markdown code fences if present
      const jsonStr = rawText.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
      data = JSON.parse(jsonStr);
    } catch {
      statusCode = 422;
      errorMessage = "Failed to parse receipt data from AI response";
      await logUsage({
        requestingApp: auth.app,
        endpoint: "/api/v1/receipt-parse",
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        durationMs,
        statusCode,
        errorMessage,
      });
      return NextResponse.json(
        { success: false, error: errorMessage, raw: rawText, code: "PARSE_ERROR" },
        { status: 422 }
      );
    }

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/receipt-parse",
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
      statusCode,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    statusCode = 500;
    errorMessage = err instanceof Error ? err.message : "Unknown error";

    await logUsage({
      requestingApp: auth.app,
      endpoint: "/api/v1/receipt-parse",
      model,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startTime,
      statusCode,
      errorMessage,
    });

    return NextResponse.json(
      { success: false, error: errorMessage, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
