import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { BrainCircuit, Loader2, Sparkles } from "lucide-react"
import {
  generateInsightsFn,
  getAdvisorPageFn,
} from "@/server/finance/fns.advisor"
import type { AdvisorReportData } from "@/server/finance/claude-api"
import { AdvisorReportView } from "@/components/finance/advisor-report"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute("/_authed/finance/advisor")({
  loader: () => getAdvisorPageFn(),
  component: AdvisorPage,
})

function AdvisorPage() {
  const { cached, aiConfigured } = Route.useLoaderData()
  const router = useRouter()
  const [report, setReport] = useState<AdvisorReportData | null>(
    cached?.report ?? null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function onGenerate() {
    setError(null)
    setIsPending(true)
    try {
      const result = await generateInsightsFn()
      if ("error" in result) {
        setError(result.error)
      } else {
        setReport(result.report)
        router.invalidate()
      }
    } catch {
      setError("Could not generate insights.")
    }
    setIsPending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <BrainCircuit className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Financial Advisor</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered analysis of your household finances
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {report ? "Report generated" : "No report yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {report
                  ? cached
                    ? `Last generated ${formatDateTime(cached.generatedAt)} — refresh for a new analysis`
                    : "Click refresh to generate a new analysis"
                  : "Generate your first financial assessment"}
              </p>
            </div>
            <Button
              onClick={onGenerate}
              disabled={isPending || !aiConfigured}
              size="lg"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {report ? "Refresh Insights" : "Generate Insights"}
            </Button>
          </div>
          {!aiConfigured && (
            <p className="mt-3 rounded bg-muted p-2 text-sm text-muted-foreground">
              AI gateway not configured — the advisor needs the internal AI
              gateway (CLAUDE_API_URL / CLAUDE_API_SERVICE_SECRET).
            </p>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          {isPending && (
            <div className="mt-4 rounded-lg bg-muted/50 p-4 text-center">
              <Loader2 className="mx-auto mb-2 size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Analyzing your finances… this may take 15-30 seconds
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {report && <AdvisorReportView report={report} />}
    </div>
  )
}
