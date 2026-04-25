const CLAUDE_API_URL = process.env.CLAUDE_API_URL;
const SERVICE_SECRET = process.env.CLAUDE_API_SERVICE_SECRET;

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

async function callClaudeApi<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  if (!CLAUDE_API_URL || !SERVICE_SECRET) {
    return { success: false, error: "Claude API not configured", code: "NOT_CONFIGURED" };
  }

  try {
    const res = await fetch(`${CLAUDE_API_URL}/api/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_SECRET}`,
        "X-Requesting-App": "file_server",
      },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<ApiResponse<T>>;
  } catch {
    return { success: false, error: "Failed to reach Claude API", code: "NETWORK_ERROR" };
  }
}

export type TagSuggestionResult = { tags: string[]; reasoning: string };
export type SummaryResult = { summary: string; keyPoints: string[] };
export type DocumentMetadata = {
  correspondent: string | null;
  date: string | null;
  title: string;
  referenceNumbers: string[];
};

export async function suggestTags(params: {
  text?: string;
  filename?: string;
  existingTags?: string[];
}): Promise<ApiResponse<TagSuggestionResult>> {
  return callClaudeApi<TagSuggestionResult>("tag-suggestions", params);
}

export async function summarizeText(
  text: string,
  maxLength?: number
): Promise<ApiResponse<SummaryResult>> {
  return callClaudeApi<SummaryResult>("summarize", { text, maxLength });
}

export async function extractMetadata(
  text: string
): Promise<ApiResponse<DocumentMetadata>> {
  return callClaudeApi<DocumentMetadata>("extract-metadata", { text });
}
