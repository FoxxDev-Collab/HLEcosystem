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
  const { text } = body as { text?: string };

  if (!text) {
    return NextResponse.json(
      { success: false, error: "Missing text", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();

  try {
    const client = getClient();
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Extract metadata from this document text. Identify:
- Who sent it (correspondent/organization)
- Relevant dates
- A descriptive title
- Any reference numbers (account numbers, invoice numbers, policy numbers, etc.)

Document:
${text.substring(0, 4000)}

Return a JSON object:
{
  "correspondent": "Company or person name, or null",
  "date": "YYYY-MM-DD or null",
  "title": "Descriptive title for filing",
  "referenceNumbers": ["INV-12345", "ACC-67890"]
}

Return ONLY valid JSON.`,
      }],
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
        requestingApp: auth.app, endpoint: "/api/v1/extract-metadata", model,
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        durationMs, statusCode: 422, errorMessage: "Failed to parse metadata response",
      });
      return NextResponse.json({ success: false, error: "Failed to parse response", code: "PARSE_ERROR" }, { status: 422 });
    }

    await logUsage({
      requestingApp: auth.app, endpoint: "/api/v1/extract-metadata", model,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
      durationMs, statusCode: 200,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await logUsage({
      requestingApp: auth.app, endpoint: "/api/v1/extract-metadata", model,
      inputTokens: 0, outputTokens: 0, durationMs: Date.now() - startTime,
      statusCode: 500, errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
