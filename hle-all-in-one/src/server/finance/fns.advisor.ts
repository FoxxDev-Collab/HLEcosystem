import { createServerFn } from "@tanstack/react-start"
import { householdMiddleware } from "@/server/middleware"
import { AI_NOT_CONFIGURED_ERROR, isAiConfigured } from "./claude-api"
import { generateInsights, getLatestReport } from "./advisor"

export const getAdvisorPageFn = createServerFn({ method: "GET" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    const cached = await getLatestReport(context.householdId)
    return { cached, aiConfigured: isAiConfigured() }
  })

export const generateInsightsFn = createServerFn({ method: "POST" })
  .middleware([householdMiddleware])
  .handler(async ({ context }) => {
    if (!isAiConfigured()) {
      return { error: AI_NOT_CONFIGURED_ERROR }
    }
    return generateInsights(context.householdId)
  })
