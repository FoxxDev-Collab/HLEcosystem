"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Check, X, Loader2, Link2, CreditCard, FileText, Repeat, Zap } from "lucide-react";
import type { SmartLinkMatch } from "@/lib/claude-api";
import {
  analyzeTransactionsAction,
  acceptDebtLinkAction,
  acceptBillLinkAction,
  acceptRecurringLinkAction,
  autoLinkTransactionsAction,
} from "./actions";

type TransactionRow = {
  id: string;
  payee: string | null;
  description: string | null;
  amount: number;
  date: string;
  accountName: string;
  type: string;
};

type MatchRow = SmartLinkMatch & {
  applied?: boolean;
  dismissed?: boolean;
};

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function SmartLinker({
  transactions,
  patternCount,
}: {
  transactions: TransactionRow[];
  patternCount: number;
}) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [autoLinkResult, setAutoLinkResult] = useState<string | null>(null);
  const router = useRouter();

  function handleAnalyze() {
    startTransition(async () => {
      const result = await analyzeTransactionsAction(transactions.map((t) => t.id));
      if ("error" in result) {
        setAutoLinkResult(result.error);
        return;
      }
      setMatches(result.matches.map((m) => ({ ...m, applied: false, dismissed: false })));
      setAnalyzed(true);
    });
  }

  function handleAutoLink() {
    startTransition(async () => {
      const result = await autoLinkTransactionsAction();
      if (result.error) {
        setAutoLinkResult(result.error);
      } else {
        setAutoLinkResult(`Auto-linked ${result.linked} transaction${result.linked !== 1 ? "s" : ""} using saved patterns.`);
        router.refresh();
      }
    });
  }

  async function handleAccept(match: MatchRow) {
    const tx = transactions.find((t) => t.id === match.transactionId);
    if (!tx) return;

    const amount = Math.abs(tx.amount);
    let result: { error?: string };

    if (match.matchType === "debt") {
      const principal = match.suggestedPrincipal ?? amount * 0.7;
      const interest = match.suggestedInterest ?? amount - principal;
      result = await acceptDebtLinkAction(
        match.transactionId, match.matchId, amount, principal, interest, match.payeePattern
      );
    } else if (match.matchType === "bill") {
      result = await acceptBillLinkAction(match.transactionId, match.matchId, amount, match.payeePattern);
    } else {
      result = await acceptRecurringLinkAction(match.transactionId, match.matchId, match.payeePattern);
    }

    if (!result.error) {
      setMatches((prev) => prev.map((m) => m.transactionId === match.transactionId ? { ...m, applied: true } : m));
    }
  }

  function handleDismiss(transactionId: string) {
    setMatches((prev) => prev.map((m) => m.transactionId === transactionId ? { ...m, dismissed: true } : m));
  }

  function handleAcceptAll() {
    startTransition(async () => {
      const highConf = matches.filter((m) => m.confidence >= 0.8 && !m.applied && !m.dismissed);
      for (const match of highConf) {
        await handleAccept(match);
      }
      router.refresh();
    });
  }

  const activeMatches = matches.filter((m) => !m.applied && !m.dismissed);
  const appliedCount = matches.filter((m) => m.applied).length;
  const highConfCount = activeMatches.filter((m) => m.confidence >= 0.8).length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {transactions.length} unlinked transaction{transactions.length !== 1 ? "s" : ""} found
              </p>
              {analyzed && (
                <p className="text-xs text-muted-foreground">
                  {matches.length} match{matches.length !== 1 ? "es" : ""} found · {appliedCount} applied
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {patternCount > 0 && (
                <Button variant="outline" onClick={handleAutoLink} disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Zap className="size-4 mr-2" />}
                  Auto-Link ({patternCount} patterns)
                </Button>
              )}
              {analyzed && highConfCount > 0 && (
                <Button variant="outline" onClick={handleAcceptAll} disabled={isPending}>
                  <Check className="size-4 mr-2" />
                  Accept All High Confidence ({highConfCount})
                </Button>
              )}
              <Button onClick={handleAnalyze} disabled={isPending}>
                {isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                {analyzed ? "Re-analyze" : "Analyze with AI"}
              </Button>
            </div>
          </div>
          {autoLinkResult && (
            <p className="text-sm text-muted-foreground mt-3 p-2 rounded bg-muted">{autoLinkResult}</p>
          )}
        </CardContent>
      </Card>

      {/* Match Results */}
      {analyzed && matches.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No matches found. Your transactions don&apos;t appear to match any tracked debts, bills, or recurring patterns.</p>
          </CardContent>
        </Card>
      )}

      {matches.filter((m) => !m.dismissed).map((match) => {
        const tx = transactions.find((t) => t.id === match.transactionId);
        if (!tx) return null;

        return (
          <Card
            key={match.transactionId}
            className={match.applied ? "opacity-60 border-green-300" : ""}
          >
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Transaction info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{tx.payee || tx.description || "Unknown"}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{tx.accountName}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(tx.date))} · {fmt.format(Math.abs(tx.amount))}
                    {tx.description && tx.payee && <> · {tx.description}</>}
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden sm:flex items-center px-4">
                  <Link2 className="size-5 text-muted-foreground" />
                </div>

                {/* Match info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {match.matchType === "debt" && <CreditCard className="size-4 text-red-500 shrink-0" />}
                    {match.matchType === "bill" && <FileText className="size-4 text-blue-500 shrink-0" />}
                    {match.matchType === "recurring" && <Repeat className="size-4 text-purple-500 shrink-0" />}
                    <span className="text-sm font-medium truncate">{match.matchName}</span>
                    <Badge
                      variant={match.matchType === "debt" ? "destructive" : match.matchType === "bill" ? "secondary" : "outline"}
                      className="text-xs shrink-0"
                    >
                      {match.matchType === "debt" ? "Debt Payment" : match.matchType === "bill" ? "Bill Payment" : "Recurring"}
                    </Badge>
                  </div>
                  {match.matchType === "debt" && match.suggestedPrincipal != null && (
                    <div className="text-xs text-muted-foreground">
                      Principal: {fmt.format(match.suggestedPrincipal)} · Interest: {fmt.format(match.suggestedInterest || 0)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="size-3" />
                    {match.reasoning}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <ConfidenceBadge confidence={match.confidence} />
                  {match.applied ? (
                    <Badge className="bg-green-600 text-white">
                      <Check className="size-3 mr-1" />Linked
                    </Badge>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => handleAccept(match)} disabled={isPending}>
                        <Check className="size-4 mr-1" />Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDismiss(match.transactionId)}>
                        <X className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Pre-analysis transaction list */}
      {!analyzed && (
        <Card>
          <CardHeader>
            <CardTitle>Unlinked Transactions</CardTitle>
            <CardDescription>Click &quot;Analyze with AI&quot; to find matches to your debts, bills, and recurring payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {transactions.slice(0, 30).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{tx.payee || tx.description || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {dateFmt.format(new Date(tx.date))} · {tx.accountName}
                    </div>
                  </div>
                  <div className="text-sm font-medium shrink-0 ml-3">
                    {fmt.format(Math.abs(tx.amount))}
                  </div>
                </div>
              ))}
              {transactions.length > 30 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  +{transactions.length - 30} more transactions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const variant = pct >= 85 ? "default" : pct >= 60 ? "secondary" : "outline";
  return <Badge variant={variant}>{pct}%</Badge>;
}
