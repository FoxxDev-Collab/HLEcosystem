import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  CreditCard,
  FileText,
  Link2,
  Loader2,
  Plus,
  Repeat,
  Sparkles,
  X,
  Zap,
} from "lucide-react"
import {
  acceptBillLinkFn,
  acceptDebtLinkFn,
  acceptRecurringLinkFn,
  analyzeTransactionsFn,
  autoLinkTransactionsFn,
  createBillFromSuggestionFn,
  createRecurringFromSuggestionFn,
  getSmartLinkPageFn,
} from "@/server/finance/fns.smart-link"
import type { SmartLinkMatch } from "@/server/finance/claude-api"
import {
  SmartLinkSuggestionCard,
  ConfidenceBadge,
} from "@/components/finance/smart-link-suggestion-card"
import type { EditableSuggestion } from "@/components/finance/smart-link-suggestion-card"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute(
  "/_authed/finance/transactions/smart-link"
)({
  loader: () => getSmartLinkPageFn(),
  component: SmartLinkPage,
})

type MatchRow = SmartLinkMatch & { applied?: boolean; dismissed?: boolean }

const BILL_CATEGORIES = new Set([
  "UTILITIES",
  "INSURANCE",
  "SUBSCRIPTIONS",
  "PHONE",
  "INTERNET",
  "RENT",
  "MORTGAGE",
  "CAR_PAYMENT",
  "CHILD_CARE",
  "STREAMING",
  "OTHER",
])

const FREQUENCIES = new Set([
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
])

function SmartLinkPage() {
  const { transactions, patternCount, aiConfigured } = Route.useLoaderData()
  const router = useRouter()
  const [matches, setMatches] = useState<Array<MatchRow>>([])
  const [suggestions, setSuggestions] = useState<Array<EditableSuggestion>>([])
  const [analyzed, setAnalyzed] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  async function onAnalyze() {
    setIsPending(true)
    setStatusMsg(null)
    try {
      const result = await analyzeTransactionsFn({
        data: { transactionIds: transactions.map((t) => t.id) },
      })
      if ("error" in result) {
        setStatusMsg(result.error)
        setIsPending(false)
        return
      }
      setMatches(
        result.matches.map((m) => ({ ...m, applied: false, dismissed: false }))
      )

      // Merge bills and recurring into unified editable suggestions.
      const billSuggestions: Array<EditableSuggestion> =
        result.suggestedBills.map((b, i) => ({
          key: `bill-${i}`,
          originalType: "bill",
          chosenType: "bill",
          name: b.name,
          payee: b.payee,
          amount: b.expectedAmount,
          category: BILL_CATEGORIES.has(b.category) ? b.category : "OTHER",
          dueDayOfMonth: Math.min(31, Math.max(1, b.dueDayOfMonth || 1)),
          frequency: "MONTHLY",
          transactionIds: b.transactionIds,
          confidence: b.confidence,
          reasoning: b.reasoning,
          created: false,
          dismissed: false,
          editing: false,
        }))
      const recSuggestions: Array<EditableSuggestion> =
        result.suggestedRecurring.map((r, i) => ({
          key: `rec-${i}`,
          originalType: "recurring",
          chosenType: "recurring",
          name: r.name,
          payee: r.payee,
          amount: r.amount,
          category: "OTHER",
          dueDayOfMonth: 1,
          frequency: FREQUENCIES.has(r.frequency) ? r.frequency : "MONTHLY",
          transactionIds: r.transactionIds,
          confidence: r.confidence,
          reasoning: r.reasoning,
          created: false,
          dismissed: false,
          editing: false,
        }))
      setSuggestions([...billSuggestions, ...recSuggestions])
      setAnalyzed(true)
    } catch {
      setStatusMsg("Analysis failed.")
    }
    setIsPending(false)
  }

  async function onAutoLink() {
    setIsPending(true)
    setStatusMsg(null)
    try {
      const result = await autoLinkTransactionsFn()
      setStatusMsg(
        `Auto-linked ${result.linked} transaction${result.linked !== 1 ? "s" : ""} using saved patterns.`
      )
      router.invalidate()
    } catch {
      setStatusMsg("Auto-link failed.")
    }
    setIsPending(false)
  }

  async function acceptMatch(match: MatchRow): Promise<boolean> {
    const tx = transactions.find((t) => t.id === match.transactionId)
    if (!tx) return false
    const amount = Math.abs(tx.amount)
    let result: { error: string } | { ok: true }

    if (match.matchType === "debt") {
      const principal = match.suggestedPrincipal ?? amount * 0.7
      const interest = match.suggestedInterest ?? amount - principal
      result = await acceptDebtLinkFn({
        data: {
          transactionId: match.transactionId,
          debtId: match.matchId,
          totalAmount: amount,
          principalAmount: Math.max(0, principal),
          interestAmount: Math.max(0, interest),
          payeePattern: match.payeePattern || null,
        },
      })
    } else if (match.matchType === "bill") {
      result = await acceptBillLinkFn({
        data: {
          transactionId: match.transactionId,
          billId: match.matchId,
          amountPaid: amount,
          payeePattern: match.payeePattern || null,
        },
      })
    } else {
      result = await acceptRecurringLinkFn({
        data: {
          transactionId: match.transactionId,
          recurringId: match.matchId,
          payeePattern: match.payeePattern || null,
        },
      })
    }
    if ("error" in result) {
      setStatusMsg(result.error)
      return false
    }
    setMatches((prev) =>
      prev.map((m) =>
        m.transactionId === match.transactionId ? { ...m, applied: true } : m
      )
    )
    return true
  }

  async function onAcceptMatch(match: MatchRow) {
    setIsPending(true)
    try {
      await acceptMatch(match)
    } catch {
      setStatusMsg("Could not accept the link.")
    }
    setIsPending(false)
  }

  async function onAcceptAllMatches() {
    setIsPending(true)
    try {
      for (const match of matches.filter(
        (m) => m.confidence >= 0.8 && !m.applied && !m.dismissed
      )) {
        await acceptMatch(match)
      }
      router.invalidate()
    } catch {
      setStatusMsg("Could not accept all links.")
    }
    setIsPending(false)
  }

  async function onCreateSuggestion(s: EditableSuggestion) {
    setIsPending(true)
    try {
      if (s.chosenType === "bill") {
        const result = await createBillFromSuggestionFn({
          data: {
            name: s.name,
            payee: s.payee,
            category: s.category as
              | "UTILITIES"
              | "INSURANCE"
              | "SUBSCRIPTIONS"
              | "PHONE"
              | "INTERNET"
              | "RENT"
              | "MORTGAGE"
              | "CAR_PAYMENT"
              | "CHILD_CARE"
              | "STREAMING"
              | "OTHER",
            expectedAmount: s.amount,
            dueDayOfMonth: s.dueDayOfMonth,
            transactionIds: s.transactionIds,
          },
        })
        if ("error" in result) {
          setStatusMsg(result.error)
        } else {
          updateSuggestion(s.key, { created: true })
          router.invalidate()
        }
      } else if (s.chosenType === "recurring") {
        const firstTx = transactions.find((t) =>
          s.transactionIds.includes(t.id)
        )
        const accountId = firstTx?.accountId || transactions[0]?.accountId
        if (!accountId) {
          setIsPending(false)
          return
        }
        const result = await createRecurringFromSuggestionFn({
          data: {
            name: s.name,
            payee: s.payee,
            amount: s.amount,
            frequency: s.frequency as
              "WEEKLY" | "BI_WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY",
            accountId,
            transactionIds: s.transactionIds,
          },
        })
        if ("error" in result) {
          setStatusMsg(result.error)
        } else {
          updateSuggestion(s.key, { created: true })
          router.invalidate()
        }
      }
    } catch {
      setStatusMsg("Could not create from the suggestion.")
    }
    setIsPending(false)
  }

  function updateSuggestion(key: string, updates: Partial<EditableSuggestion>) {
    setSuggestions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
    )
  }

  const activeMatches = matches.filter((m) => !m.applied && !m.dismissed)
  const appliedCount = matches.filter((m) => m.applied).length
  const highConfCount = activeMatches.filter((m) => m.confidence >= 0.8).length
  const activeSuggestions = suggestions.filter(
    (s) => !s.created && !s.dismissed && s.chosenType !== "skip"
  )

  return (
    <div className="space-y-6">
      <Link
        to="/finance/transactions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Transactions
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Link2 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">AI Smart Link</h1>
          <p className="text-sm text-muted-foreground">
            Automatically connect transactions to your debts, bills, and
            recurring payments
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              All recent transactions are already linked. Nice work!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {transactions.length} unlinked transaction
                    {transactions.length !== 1 ? "s" : ""} found
                  </p>
                  {analyzed && (
                    <p className="text-xs text-muted-foreground">
                      {matches.length} match{matches.length !== 1 ? "es" : ""} ·{" "}
                      {activeSuggestions.length} discovered · {appliedCount}{" "}
                      applied
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {patternCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={onAutoLink}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Zap className="size-4" />
                      )}
                      Auto-Link ({patternCount} pattern
                      {patternCount !== 1 ? "s" : ""})
                    </Button>
                  )}
                  {analyzed && highConfCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={onAcceptAllMatches}
                      disabled={isPending}
                    >
                      <Check className="size-4" />
                      Accept All High Confidence ({highConfCount})
                    </Button>
                  )}
                  <Button
                    onClick={onAnalyze}
                    disabled={isPending || !aiConfigured}
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {analyzed ? "Re-analyze" : "Analyze with AI"}
                  </Button>
                </div>
              </div>
              {!aiConfigured && (
                <p className="mt-3 rounded bg-muted p-2 text-sm text-muted-foreground">
                  AI gateway not configured — analysis is disabled, but saved
                  patterns can still auto-link (CLAUDE_API_URL /
                  CLAUDE_API_SERVICE_SECRET).
                </p>
              )}
              {statusMsg && (
                <p className="mt-3 rounded bg-muted p-2 text-sm text-muted-foreground">
                  {statusMsg}
                </p>
              )}
            </CardContent>
          </Card>

          {suggestions.filter((s) => !s.dismissed).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-blue-500" />
                <h2 className="text-sm font-semibold">Discovered Patterns</h2>
                <Badge variant="secondary" className="text-xs">
                  {activeSuggestions.length} to review
                </Badge>
              </div>
              {suggestions
                .filter((s) => !s.dismissed)
                .map((s) => (
                  <SmartLinkSuggestionCard
                    key={s.key}
                    suggestion={s}
                    transactions={transactions}
                    isPending={isPending}
                    onUpdate={(updates) => updateSuggestion(s.key, updates)}
                    onCreate={() => onCreateSuggestion(s)}
                    onDismiss={() =>
                      updateSuggestion(s.key, { dismissed: true })
                    }
                  />
                ))}
            </div>
          )}

          {matches.filter((m) => !m.dismissed).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Matched to Existing</h2>
              </div>
              {matches
                .filter((m) => !m.dismissed)
                .map((match) => {
                  const tx = transactions.find(
                    (t) => t.id === match.transactionId
                  )
                  if (!tx) return null
                  return (
                    <Card
                      key={match.transactionId}
                      className={
                        match.applied ? "border-green-300 opacity-60" : ""
                      }
                    >
                      <CardContent className="pt-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {tx.payee || tx.description || "Unknown"}
                              </span>
                              <Badge
                                variant="outline"
                                className="shrink-0 text-xs"
                              >
                                {tx.accountName}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(tx.date)} ·{" "}
                              {formatCurrency(Math.abs(tx.amount))}
                            </div>
                          </div>
                          <div className="hidden items-center px-3 sm:flex">
                            <Link2 className="size-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {match.matchType === "debt" && (
                                <CreditCard className="size-4 shrink-0 text-red-500" />
                              )}
                              {match.matchType === "bill" && (
                                <FileText className="size-4 shrink-0 text-blue-500" />
                              )}
                              {match.matchType === "recurring" && (
                                <Repeat className="size-4 shrink-0 text-purple-500" />
                              )}
                              <span className="truncate text-sm font-medium">
                                {match.matchName}
                              </span>
                              <Badge
                                variant={
                                  match.matchType === "debt"
                                    ? "destructive"
                                    : match.matchType === "bill"
                                      ? "secondary"
                                      : "outline"
                                }
                                className="shrink-0 text-xs"
                              >
                                {match.matchType === "debt"
                                  ? "Debt"
                                  : match.matchType === "bill"
                                    ? "Bill"
                                    : "Recurring"}
                              </Badge>
                            </div>
                            {match.matchType === "debt" &&
                              match.suggestedPrincipal != null && (
                                <div className="text-xs text-muted-foreground">
                                  P: {formatCurrency(match.suggestedPrincipal)}{" "}
                                  · I:{" "}
                                  {formatCurrency(match.suggestedInterest || 0)}
                                </div>
                              )}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Sparkles className="size-3 shrink-0" />
                              {match.reasoning}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <ConfidenceBadge confidence={match.confidence} />
                            {match.applied ? (
                              <Badge className="bg-green-600 text-white">
                                <Check className="size-3" />
                                Linked
                              </Badge>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => onAcceptMatch(match)}
                                  disabled={isPending}
                                >
                                  <Check className="size-4" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setMatches((prev) =>
                                      prev.map((m) =>
                                        m.transactionId === match.transactionId
                                          ? { ...m, dismissed: true }
                                          : m
                                      )
                                    )
                                  }
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          )}

          {analyzed && matches.length === 0 && suggestions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No matches or patterns found.
                </p>
              </CardContent>
            </Card>
          )}

          {!analyzed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Unlinked Transactions
                </CardTitle>
                <CardDescription>
                  Claude will match these to debts and bills, and discover new
                  recurring payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] divide-y overflow-y-auto">
                  {transactions.slice(0, 30).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {tx.payee || tx.description || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {tx.accountName}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 text-sm font-medium tabular-nums">
                        {formatCurrency(Math.abs(tx.amount))}
                      </div>
                    </div>
                  ))}
                  {transactions.length > 30 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      +{transactions.length - 30} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
