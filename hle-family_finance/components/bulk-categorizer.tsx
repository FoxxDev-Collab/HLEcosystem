"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Check, CheckCheck, X } from "lucide-react";
import {
  bulkSuggestCategoriesAction,
  applyCategoryAction,
  bulkApplyCategoriesAction,
} from "@/app/(app)/transactions/categorize/actions";
import type { TransactionSuggestion, NewCategory } from "@/app/(app)/transactions/categorize/actions";

type Transaction = {
  id: string;
  payee: string | null;
  description: string | null;
  amount: number;
  date: string;
  accountName: string;
  type: string;
};

type Category = { id: string; name: string; color: string | null };

type SuggestionRow = TransactionSuggestion & {
  overrideCategoryId?: string;
  applied?: boolean;
  dismissed?: boolean;
};

export function BulkCategorizer({
  transactions,
  categories: initialCategories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [analyzing, startAnalyze] = useTransition();
  const [applying, startApply] = useTransition();
  const [analyzed, setAnalyzed] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [newCategoryCount, setNewCategoryCount] = useState(0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const confidenceBadge = (c: number) => {
    if (c >= 0.85) return <Badge variant="default" className="text-[10px]">{Math.round(c * 100)}%</Badge>;
    if (c >= 0.6) return <Badge variant="secondary" className="text-[10px]">{Math.round(c * 100)}%</Badge>;
    return <Badge variant="outline" className="text-[10px]">{Math.round(c * 100)}%</Badge>;
  };

  const handleAnalyze = () => {
    const ids = transactions.map((t) => t.id);
    startAnalyze(async () => {
      const result = await bulkSuggestCategoriesAction(ids);
      if ("suggestions" in result) {
        setSuggestions(result.suggestions);
        setAnalyzed(true);
        // Merge any newly created categories into the dropdown
        if (result.newCategories.length > 0) {
          setCategories((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const toAdd = result.newCategories.filter((c) => !existingIds.has(c.id));
            return [...prev, ...toAdd];
          });
          setNewCategoryCount(result.newCategories.length);
        }
      }
    });
  };

  const handleApplyOne = (suggestion: SuggestionRow) => {
    const categoryId = suggestion.overrideCategoryId || suggestion.suggestedCategoryId;
    if (!categoryId) return;

    startApply(async () => {
      const result = await applyCategoryAction(suggestion.id, categoryId);
      if (!result.error) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestion.id ? { ...s, applied: true } : s))
        );
        setAppliedCount((c) => c + 1);
      }
    });
  };

  const handleDismiss = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, dismissed: true } : s))
    );
  };

  const handleAcceptAll = () => {
    const highConfidence = suggestions.filter(
      (s) => !s.applied && !s.dismissed && s.confidence >= 0.8 && (s.overrideCategoryId || s.suggestedCategoryId)
    );

    const assignments = highConfidence.map((s) => ({
      transactionId: s.id,
      categoryId: (s.overrideCategoryId || s.suggestedCategoryId)!,
    }));

    startApply(async () => {
      const result = await bulkApplyCategoriesAction(assignments);
      setSuggestions((prev) =>
        prev.map((s) => {
          const matched = assignments.find((a) => a.transactionId === s.id);
          return matched ? { ...s, applied: true } : s;
        })
      );
      setAppliedCount((c) => c + result.applied);
    });
  };

  const pending = suggestions.filter((s) => !s.applied && !s.dismissed);
  const highConfidenceCount = pending.filter((s) => s.confidence >= 0.8 && (s.overrideCategoryId || s.suggestedCategoryId)).length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              {transactions.length} uncategorized transaction{transactions.length !== 1 ? "s" : ""} (showing up to 25)
              {analyzed && appliedCount > 0 && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  {appliedCount} applied
                </span>
              )}
              {analyzed && newCategoryCount > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  {newCategoryCount} new {newCategoryCount === 1 ? "category" : "categories"} created
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {analyzed && highConfidenceCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcceptAll}
                  disabled={applying}
                >
                  <CheckCheck className="size-3.5 mr-1.5" />
                  Accept All High Confidence ({highConfidenceCount})
                </Button>
              )}
              <Button onClick={handleAnalyze} disabled={analyzing} size="sm">
                {analyzing ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Analyzing...
                  </>
                ) : analyzed ? (
                  <>
                    <Sparkles className="size-3.5 mr-1.5" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 mr-1.5" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestion Results */}
      {analyzed && suggestions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No suggestions could be generated. Transactions may lack payee/description data.
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s) => {
            if (s.dismissed) return null;

            return (
              <Card
                key={s.id}
                className={s.applied ? "opacity-60" : ""}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">
                          {s.payee || s.description || "Transaction"}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatCurrency(s.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.date} &middot; {s.accountName}
                        {s.description && s.payee && <> &middot; {s.description}</>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Category selector */}
                      <div className="flex items-center gap-1.5">
                        {confidenceBadge(s.confidence)}
                        <Select
                          value={s.overrideCategoryId || s.suggestedCategoryId || ""}
                          onValueChange={(v) =>
                            setSuggestions((prev) =>
                              prev.map((x) =>
                                x.id === s.id ? { ...x, overrideCategoryId: v } : x
                              )
                            )
                          }
                          disabled={s.applied}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <span className="flex items-center gap-1.5">
                                  {c.color && (
                                    <span
                                      className="w-2 h-2 rounded-full inline-block"
                                      style={{ backgroundColor: c.color }}
                                    />
                                  )}
                                  {c.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {s.applied ? (
                        <Badge variant="default" className="text-xs">
                          <Check className="size-3 mr-1" />
                          Applied
                        </Badge>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleApplyOne(s)}
                            disabled={applying || !(s.overrideCategoryId || s.suggestedCategoryId)}
                            title="Apply category"
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDismiss(s.id)}
                            title="Dismiss"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {s.reasoning && !s.applied && (
                    <p className="text-[11px] text-muted-foreground mt-1 pl-0">
                      <Sparkles className="size-3 inline mr-1 text-primary" />
                      {s.reasoning}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pre-analysis list of uncategorized transactions */}
      {!analyzed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uncategorized Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {transactions.slice(0, 25).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">
                      {tx.payee || tx.description || "Transaction"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tx.date} &middot; {tx.accountName}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground shrink-0">
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
