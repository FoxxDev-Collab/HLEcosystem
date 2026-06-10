// Read-only rendering of an AdvisorReport JSONB payload (legacy
// advisor/advisor-report.tsx). The report is AI-generated and cached
// server-side; this component only displays it.
import { Link } from "@tanstack/react-router"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CreditCard,
  DollarSign,
  Info,
  Lightbulb,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import type { AdvisorReportData } from "@/server/finance/claude-api"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function AdvisorReportView({ report }: { report: AdvisorReportData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative size-24 shrink-0">
              <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(report.healthScore.score / 100) * 264} 264`}
                  className={
                    report.healthScore.score >= 80
                      ? "stroke-green-500"
                      : report.healthScore.score >= 60
                        ? "stroke-yellow-500"
                        : "stroke-red-500"
                  }
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">
                  {report.healthScore.score}
                </span>
                <span className="text-xs text-muted-foreground">
                  {report.healthScore.grade}
                </span>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Financial Health Score</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.healthScore.summary}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4" />
              Spending Analysis
            </CardTitle>
            <CardDescription>
              {report.spendingAnalysis.monthOverMonth}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.spendingAnalysis.topCategories.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{cat.category}</span>
                    {cat.trend === "up" && (
                      <TrendingUp className="size-3 text-red-500" />
                    )}
                    {cat.trend === "down" && (
                      <TrendingDown className="size-3 text-green-500" />
                    )}
                    {cat.trend === "stable" && (
                      <Minus className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="font-medium">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{cat.note}</p>
              </div>
            ))}
            {report.spendingAnalysis.anomalies.length > 0 && (
              <>
                <Separator />
                {report.spendingAnalysis.anomalies.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {a.severity === "alert" ? (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                    ) : a.severity === "warning" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-500" />
                    ) : (
                      <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
                    )}
                    <p className="text-xs">{a.description}</p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="size-4" />
              Detected Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.subscriptionDetection.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subscriptions detected
              </p>
            ) : (
              <div className="space-y-2">
                {report.subscriptionDetection.map((sub, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm">{sub.name}</span>
                      <Badge
                        variant={
                          sub.suggestion === "cancel"
                            ? "destructive"
                            : sub.suggestion === "review"
                              ? "secondary"
                              : "outline"
                        }
                        className="shrink-0 text-xs"
                      >
                        {sub.suggestion}
                      </Badge>
                    </div>
                    <span className="ml-2 shrink-0 text-sm font-medium">
                      {formatCurrency(sub.estimatedMonthly)}/mo
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Monthly</span>
                  <span>
                    {formatCurrency(
                      report.subscriptionDetection.reduce(
                        (s, sub) => s + sub.estimatedMonthly,
                        0
                      )
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {report.debtStrategy && report.debtStrategy.totalDebt > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4" />
                Debt Payoff Strategy
              </CardTitle>
              <CardDescription>
                Recommended:{" "}
                <strong className="text-foreground capitalize">
                  {report.debtStrategy.recommendation}
                </strong>{" "}
                method — {report.debtStrategy.reasoning}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(report.debtStrategy.totalDebt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Debt
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold">
                    {report.debtStrategy.estimatedPayoffMonths} mo
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Est. Payoff Time
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(report.debtStrategy.totalInterestSaved)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Interest Savings
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Avalanche Order (highest rate first)
                  </p>
                  {report.debtStrategy.avalancheOrder.map((d, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm">
                      <span>
                        {i + 1}. {d.name}
                      </span>
                      <span className="text-muted-foreground">
                        {(d.rate * 100).toFixed(1)}% ·{" "}
                        {formatCurrency(d.balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Snowball Order (smallest balance first)
                  </p>
                  {report.debtStrategy.snowballOrder.map((d, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm">
                      <span>
                        {i + 1}. {d.name}
                      </span>
                      <span className="text-muted-foreground">
                        {(d.rate * 100).toFixed(1)}% ·{" "}
                        {formatCurrency(d.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {report.budgetRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4" />
                Budget Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.budgetRecommendations.map((rec, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{rec.category}</span>
                    <span>
                      {formatCurrency(rec.current)}{" "}
                      <ArrowRight className="inline size-3" />{" "}
                      {formatCurrency(rec.suggested)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rec.reasoning}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {report.savingsOpportunities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4" />
                Savings Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.savingsOpportunities.map((opp, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{opp.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={
                        opp.difficulty === "easy"
                          ? "default"
                          : opp.difficulty === "moderate"
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-xs"
                    >
                      {opp.difficulty}
                    </Badge>
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(opp.estimatedMonthlySavings)}/mo
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {report.actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="size-4" />
              Action Items
            </CardTitle>
            <CardDescription>
              Prioritized steps to improve your finances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...report.actionItems]
                .sort((a, b) => a.priority - b.priority)
                .map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-xs font-bold text-primary">
                        {item.priority}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {item.title}
                        </span>
                        <Badge
                          variant={
                            item.impact === "high"
                              ? "default"
                              : item.impact === "medium"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {item.impact} impact
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report.unlinkedTransactionCheck?.hasUnlinkedPayments && (
        <Card className="border-yellow-300">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">
                  Unlinked Payments Detected
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.unlinkedTransactionCheck.message}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  render={<Link to="/finance/transactions/smart-link" />}
                >
                  Run AI Smart Link <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
