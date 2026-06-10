import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import {
  applyCategoryFn,
  bulkApplyCategoriesFn,
  bulkSuggestCategoriesFn,
  getCategorizePageFn,
} from "@/server/finance/fns.categorize"
import type { TransactionSuggestion } from "@/server/finance/categorize"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute(
  "/_authed/finance/transactions/categorize"
)({
  loader: () => getCategorizePageFn(),
  component: CategorizePage,
})

const selectClass =
  "h-8 w-[160px] rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type CategoryOption = { id: string; name: string }

type SuggestionRow = TransactionSuggestion & {
  overrideCategoryId?: string
  applied?: boolean
  dismissed?: boolean
}

function confidenceBadge(c: number) {
  const pct = Math.round(c * 100)
  const variant = c >= 0.85 ? "default" : c >= 0.6 ? "secondary" : "outline"
  return (
    <Badge variant={variant} className="text-[10px]">
      {pct}%
    </Badge>
  )
}

function CategorizePage() {
  const {
    transactions,
    totalCount,
    categories: initialCategories,
    aiConfigured,
  } = Route.useLoaderData()
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Array<SuggestionRow>>([])
  const [categories, setCategories] = useState<Array<CategoryOption>>(
    initialCategories.map((c) => ({ id: c.id, name: c.name }))
  )
  const [analyzing, setAnalyzing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [appliedCount, setAppliedCount] = useState(0)
  const [newCategoryCount, setNewCategoryCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function onAnalyze() {
    setError(null)
    setAnalyzing(true)
    try {
      const result = await bulkSuggestCategoriesFn({
        data: { transactionIds: transactions.map((t) => t.id) },
      })
      if ("error" in result) {
        setError(result.error)
      } else {
        setSuggestions(result.suggestions)
        setAnalyzed(true)
        if (result.newCategories.length > 0) {
          setCategories((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const toAdd = result.newCategories.filter(
              (c) => !existingIds.has(c.id)
            )
            return [...prev, ...toAdd]
          })
          setNewCategoryCount(result.newCategories.length)
        }
      }
    } catch {
      setError("Analysis failed.")
    }
    setAnalyzing(false)
  }

  async function onApplyOne(suggestion: SuggestionRow) {
    const categoryId =
      suggestion.overrideCategoryId || suggestion.suggestedCategoryId
    if (!categoryId) return
    setApplying(true)
    try {
      const result = await applyCategoryFn({
        data: { transactionId: suggestion.id, categoryId },
      })
      if (!("error" in result)) {
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestion.id ? { ...s, applied: true } : s
          )
        )
        setAppliedCount((c) => c + 1)
        router.invalidate()
      }
    } catch {
      setError("Could not apply the category.")
    }
    setApplying(false)
  }

  function onDismiss(id: string) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, dismissed: true } : s))
    )
  }

  async function onAcceptAll() {
    const highConfidence = suggestions.filter(
      (s) =>
        !s.applied &&
        !s.dismissed &&
        s.confidence >= 0.8 &&
        (s.overrideCategoryId || s.suggestedCategoryId)
    )
    const assignments = highConfidence.flatMap((s) => {
      const categoryId = s.overrideCategoryId || s.suggestedCategoryId
      return categoryId ? [{ transactionId: s.id, categoryId }] : []
    })
    if (assignments.length === 0) return

    setApplying(true)
    try {
      const result = await bulkApplyCategoriesFn({ data: { assignments } })
      setSuggestions((prev) =>
        prev.map((s) =>
          assignments.some((a) => a.transactionId === s.id)
            ? { ...s, applied: true }
            : s
        )
      )
      setAppliedCount((c) => c + result.applied)
      router.invalidate()
    } catch {
      setError("Bulk apply failed.")
    }
    setApplying(false)
  }

  const pending = suggestions.filter((s) => !s.applied && !s.dismissed)
  const highConfidenceCount = pending.filter(
    (s) =>
      s.confidence >= 0.8 && (s.overrideCategoryId || s.suggestedCategoryId)
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/finance/transactions"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5 text-primary" />
            AI Categorize
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} uncategorized transaction{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              All transactions are categorized!
            </p>
            <Link
              to="/finance/transactions"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Back to Transactions
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {transactions.length} uncategorized transaction
                  {transactions.length !== 1 ? "s" : ""} (analyzing up to 25)
                  {analyzed && appliedCount > 0 && (
                    <span className="ml-2 text-green-600 dark:text-green-400">
                      {appliedCount} applied
                    </span>
                  )}
                  {analyzed && newCategoryCount > 0 && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400">
                      {newCategoryCount} new{" "}
                      {newCategoryCount === 1 ? "category" : "categories"}{" "}
                      created
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {analyzed && highConfidenceCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAcceptAll}
                      disabled={applying}
                    >
                      <CheckCheck className="size-3.5" />
                      Accept All High Confidence ({highConfidenceCount})
                    </Button>
                  )}
                  <Button onClick={onAnalyze} disabled={analyzing} size="sm">
                    {analyzing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" />
                        {analyzed ? "Re-analyze" : "Analyze with AI"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {!aiConfigured && (
                <p className="mt-3 rounded bg-muted p-2 text-sm text-muted-foreground">
                  AI gateway not configured — only saved category rules will be
                  applied (CLAUDE_API_URL / CLAUDE_API_SERVICE_SECRET).
                </p>
              )}
              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>

          {analyzed && suggestions.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No suggestions could be generated. Transactions may lack
                payee/description data.
              </CardContent>
            </Card>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s) => {
                if (s.dismissed) return null
                return (
                  <Card key={s.id} className={s.applied ? "opacity-60" : ""}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {s.payee || s.description || "Transaction"}
                            </span>
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {formatCurrency(s.amount)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(s.date)} · {s.accountName}
                            {s.description && s.payee && (
                              <> · {s.description}</>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {confidenceBadge(s.confidence)}
                            <select
                              className={selectClass}
                              value={
                                s.overrideCategoryId ||
                                s.suggestedCategoryId ||
                                ""
                              }
                              disabled={s.applied}
                              onChange={(e) =>
                                setSuggestions((prev) =>
                                  prev.map((x) =>
                                    x.id === s.id
                                      ? {
                                          ...x,
                                          overrideCategoryId: e.target.value,
                                        }
                                      : x
                                  )
                                )
                              }
                            >
                              <option value="">Category…</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {s.applied ? (
                            <Badge variant="default" className="text-xs">
                              <Check className="size-3" />
                              Applied
                            </Badge>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onApplyOne(s)}
                                disabled={
                                  applying ||
                                  !(
                                    s.overrideCategoryId ||
                                    s.suggestedCategoryId
                                  )
                                }
                                title="Apply category"
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => onDismiss(s.id)}
                                title="Dismiss"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {s.reasoning && !s.applied && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <Sparkles className="mr-1 inline size-3 text-primary" />
                          {s.reasoning}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {!analyzed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Uncategorized Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {transactions.slice(0, 25).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {tx.payee || tx.description || "Transaction"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {tx.accountName}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
