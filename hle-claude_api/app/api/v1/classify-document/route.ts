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
  const { text, image, filename } = body as { text?: string; image?: string; filename?: string };

  if (!text && !image) {
    return NextResponse.json(
      { success: false, error: "Provide text or image", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const model = await getDefaultModel();
  const startTime = Date.now();

  try {
    const client = getClient();
    const content: Parameters<typeof client.messages.create>[0]["messages"][0]["content"] = [];

    if (image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: image },
      });
    }

    content.push({
      type: "text",
      text: `Classify this document. ${filename ? `Filename: ${filename}` : ""}
${text ? `\nContent:\n${text.substring(0, 3000)}` : ""}

Return a JSON object:
{
  "type": "invoice|contract|letter|receipt|medical|tax|insurance|bank_statement|identity|certificate|warranty|manual|report|legal|correspondence|other",
  "confidence": 0.95,
  "subtypes": ["utility_bill", "electric"]
}

Return ONLY valid JSON.`,
    });

    const response = await client.messages.create({
      model,
      max_tokens: 512,
      messages: [{ role: "user", content }],
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
        requestingApp: auth.app, endpoint: "/api/v1/classify-document", model,
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        durationMs, statusCode: 422, errorMessage: "Failed to parse classification response",
      });
      return NextResponse.json({ success: false, error: "Failed to parse response", code: "PARSE_ERROR" }, { status: 422 });
    }

    await logUsage({
      requestingApp: auth.app, endpoint: "/api/v1/classify-document", model,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
      durationMs, statusCode: 200,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await logUsage({
      requestingApp: auth.app, endpoint: "/api/v1/classify-document", model,
      inputTokens: 0, outputTokens: 0, durationMs: Date.now() - startTime,
      statusCode: 500, errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
