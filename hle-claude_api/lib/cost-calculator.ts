// Pricing per million tokens (update as Anthropic changes pricing)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-35-20241022": { input: 0.80, output: 4.0 },
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function getAvailableModels(): string[] {
  return Object.keys(PRICING);
}
