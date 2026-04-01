"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, AlertTriangle,
  CreditCard, Lightbulb, Target, DollarSign, ArrowRight,
  CheckCircle, Info, AlertCircle, Minus,
} from "lucide-react";
import type { AdvisorReport as ReportType } from "@/lib/claude-api";
import { generateInsightsAction } from "./actions";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function AdvisorReportView({ cachedReport }: { cachedReport: ReportType | null }) {
  const [report, setReport] = useState<ReportType | null>(cachedReport);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    startTransition(async () => {
      setError(null);
      const result = await generateInsightsAction();
      if ("error" in result) {
        setError(result.error);
      } else {
        setReport(result.report);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Generate Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {report ? "Report generated" : "No report yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {report ? "Click refresh to generate a new analysis" : "Generate your first financial assessment"}
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={isPending} size="lg">
              {isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
              {report ? "Refresh Insights" : "Generate Insights"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          {isPending && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 text-center">
              <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your finances... this may take 15-30 seconds</p>
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <>
          {/* Health Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="relative size-24 shrink-0">
                  <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${(report.healthScore.score / 100) * 264} 264`}
                      className={
                        report.healthScore.score >= 80 ? "stroke-green-500" :
                        report.healthScore.score >= 60 ? "stroke-yellow-500" :
                        "stroke-red-500"
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{report.healthScore.score}</span>
                    <span className="text-xs text-muted-foreground">{report.healthScore.grade}</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Financial Health Score</h2>
                  <p className="text-sm text-muted-foreground mt-1">{report.healthScore.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Spending Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingDown className="size-4" />Spending Analysis</CardTitle>
                <CardDescription>{report.spendingAnalysis.monthOverMonth}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.spendingAnalysis.topCategories.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{cat.category}</span>
                        {cat.trend === "up" && <TrendingUp className="size-3 text-red-500" />}
                        {cat.trend === "down" && <TrendingDown className="size-3 text-green-500" />}
                        {cat.trend === "stable" && <Minus className="size-3 text-muted-foreground" />}
                      </div>
                      <span className="font-medium">{fmt.format(cat.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.note}</p>
                  </div>
                ))}
                {report.spendingAnalysis.anomalies.length > 0 && (
                  <>
                    <Separator />
                    {report.spendingAnalysis.anomalies.map((a, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {a.severity === "alert" ? <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" /> :
                         a.severity === "warning" ? <AlertTriangle className="size-4 text-yellow-500 shrink-0 mt-0.5" /> :
                         <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />}
                        <p className="text-xs">{a.description}</p>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Subscriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="size-4" />Detected Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {report.subscriptionDetection.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subscriptions detected</p>
                ) : (
                  <div className="space-y-2">
                    {report.subscriptionDetection.map((sub, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm truncate">{sub.name}</span>
                          <Badge variant={sub.suggestion === "cancel" ? "destructive" : sub.suggestion === "review" ? "secondary" : "outline"} className="text-xs shrink-0">
                            {sub.suggestion}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium shrink-0 ml-2">{fmt.format(sub.estimatedMonthly)}/mo</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between text-sm font-medium">
                      <span>Total Monthly</span>
                      <span>{fmt.format(report.subscriptionDetection.reduce((s, sub) => s + sub.estimatedMonthly, 0))}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Debt Strategy */}
            {report.debtStrategy && report.debtStrategy.totalDebt > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="size-4" />Debt Payoff Strategy</CardTitle>
                  <CardDescription>
                    Recommended: <strong className="text-foreground capitalize">{report.debtStrategy.recommendation}</strong> method — {report.debtStrategy.reasoning}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3 mb-4">
                    <div className="text-center p-3 rounded-lg border">
                      <div className="text-2xl font-bold text-red-600">{fmt.format(report.debtStrategy.totalDebt)}</div>
                      <div className="text-xs text-muted-foreground">Total Debt</div>
                    </div>
                    <div className="text-center p-3 rounded-lg border">
                      <div className="text-2xl font-bold">{report.debtStrategy.estimatedPayoffMonths} mo</div>
                      <div className="text-xs text-muted-foreground">Est. Payoff Time</div>
                    </div>
                    <div className="text-center p-3 rounded-lg border">
                      <div className="text-2xl font-bold text-green-600">{fmt.format(report.debtStrategy.totalInterestSaved)}</div>
                      <div className="text-xs text-muted-foreground">Interest Savings</div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Avalanche Order (highest rate first)</p>
                      {report.debtStrategy.avalancheOrder.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span>{i + 1}. {d.name}</span>
                          <span className="text-muted-foreground">{(d.rate * 100).toFixed(1)}% · {fmt.format(d.balance)}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Snowball Order (smallest balance first)</p>
                      {report.debtStrategy.snowballOrder.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span>{i + 1}. {d.name}</span>
                          <span className="text-muted-foreground">{(d.rate * 100).toFixed(1)}% · {fmt.format(d.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Budget Recommendations */}
            {report.budgetRecommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Target className="size-4" />Budget Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.budgetRecommendations.map((rec, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{rec.category}</span>
                        <span>
                          {fmt.format(rec.current)} <ArrowRight className="size-3 inline" /> {fmt.format(rec.suggested)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reasoning}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Savings Opportunities */}
            {report.savingsOpportunities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Lightbulb className="size-4" />Savings Opportunities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.savingsOpportunities.map((opp, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{opp.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={opp.difficulty === "easy" ? "default" : opp.difficulty === "moderate" ? "secondary" : "destructive"} className="text-xs">
                          {opp.difficulty}
                        </Badge>
                        <span className="text-sm font-medium text-green-600">
                          {fmt.format(opp.estimatedMonthlySavings)}/mo
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Items */}
          {report.actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="size-4" />Action Items</CardTitle>
                <CardDescription>Prioritized steps to improve your finances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.actionItems
                    .sort((a, b) => a.priority - b.priority)
                    .map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">{item.priority}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.title}</span>
                            <Badge variant={item.impact === "high" ? "default" : item.impact === "medium" ? "secondary" : "outline"} className="text-xs">
                              {item.impact} impact
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unlinked Transaction Check */}
          {report.unlinkedTransactionCheck?.hasUnlinkedPayments && (
            <Card className="border-yellow-300">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Unlinked Payments Detected</p>
                    <p className="text-xs text-muted-foreground mt-1">{report.unlinkedTransactionCheck.message}</p>
                    <Button variant="outline" size="sm" className="mt-2" asChild>
                      <a href="/transactions/smart-link">
                        Run AI Smart Link <ArrowRight className="size-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
