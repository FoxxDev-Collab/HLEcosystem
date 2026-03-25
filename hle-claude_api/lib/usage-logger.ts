import prisma from "./prisma";
import { estimateCost } from "./cost-calculator";

type LogParams = {
  requestingApp: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export async function logUsage(params: LogParams): Promise<void> {
  const totalTokens = params.inputTokens + params.outputTokens;
  const cost = estimateCost(params.model, params.inputTokens, params.outputTokens);

  // Get the active API key for linking
  const activeKey = await prisma.apiKey.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  await prisma.usageLog.create({
    data: {
      apiKeyId: activeKey?.id ?? null,
      requestingApp: params.requestingApp,
      endpoint: params.endpoint,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      estimatedCostUsd: cost,
      durationMs: params.durationMs,
      statusCode: params.statusCode,
      errorMessage: params.errorMessage,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  // Update API key last used time
  if (activeKey) {
    await prisma.apiKey.update({
      where: { id: activeKey.id },
      data: { lastUsedAt: new Date() },
    });
  }
}
