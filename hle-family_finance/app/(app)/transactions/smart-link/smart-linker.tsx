"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X, Loader2, Link2, CreditCard, FileText, Repeat, Zap, Plus } from "lucide-react";
import type { SmartLinkMatch, SuggestedBill, SuggestedRecurring } from "@/lib/claude-api";
import {
  analyzeTransactionsAction,
  acceptDebtLinkAction,
  acceptBillLinkAction,
  acceptRecurringLinkAction,
  autoLinkTransactionsAction,
  createBillFromSuggestionAction,
  createRecurringFromSuggestionAction,
} from "./actions";

type TransactionRow = {
  id: string;
  payee: string | null;
  description: string | null;
  amount: number;
  date: string;
  accountName: string;
  accountId: string;
  type: string;
};

type MatchRow = SmartLinkMatch & { applied?: boolean; dismissed?: boolean };
type BillRow = SuggestedBill & { created?: boolean; dismissed?: boolean };
type RecurringRow = SuggestedRecurring & { created?: boolean; dismissed?: boolean };

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
  const [suggestedBills, setSuggestedBills] = useState<BillRow[]>([]);
  const [suggestedRecurring, setSuggestedRecurring] = useState<RecurringRow[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const router = useRouter();

  function handleAnalyze() {
    startTransition(async () => {
      setStatusMsg(null);
      const result = await analyzeTransactionsAction(transactions.map((t) => t.id));
      if ("error" in result) {
        setStatusMsg(result.error);
        return;
      }
      setMatches(result.matches.map((m) => ({ ...m, applied: false, dismissed: false })));
      setSuggestedBills((result.suggestedBills || []).map((b) => ({ ...b, created: false, dismissed: false })));
      setSuggestedRecurring((result.suggestedRecurring || []).map((r) => ({ ...r, created: false, dismissed: false })));
      setAnalyzed(true);
    });
  }

  function handleAutoLink() {
    startTransition(async () => {
      const result = await autoLinkTransactionsAction();
      if (result.error) {
        setStatusMsg(result.error);
      } else {
        setStatusMsg(`Auto-linked ${result.linked} transaction${result.linked !== 1 ? "s" : ""} using saved patterns.`);
        router.refresh();
      }
    });
  }

  async function handleAcceptMatch(match: MatchRow) {
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

  async function handleCreateBill(bill: BillRow) {
    const result = await createBillFromSuggestionAction(
      bill.name, bill.payee, bill.category, bill.expectedAmount,
      bill.dueDayOfMonth, bill.transactionIds
    );
    if (!result.error) {
      setSuggestedBills((prev) => prev.map((b) => b.name === bill.name ? { ...b, created: true } : b));
    }
  }

  async function handleCreateRecurring(rec: RecurringRow) {
    // Use the account from the first matching transaction
    const firstTx = transactions.find((t) => rec.transactionIds.includes(t.id));
    const accountId = firstTx?.accountId || transactions[0]?.accountId;
    if (!accountId) return;

    const result = await createRecurringFromSuggestionAction(
      rec.name, rec.payee, rec.amount, rec.frequency, accountId, rec.transactionIds
    );
    if (!result.error) {
      setSuggestedRecurring((prev) => prev.map((r) => r.name === rec.name ? { ...r, created: true } : r));
    }
  }

  function handleAcceptAllMatches() {
    startTransition(async () => {
      const highConf = matches.filter((m) => m.confidence >= 0.8 && !m.applied && !m.dismissed);
      for (const match of highConf) {
        await handleAcceptMatch(match);
      }
      router.refresh();
    });
  }

  const activeMatches = matches.filter((m) => !m.applied && !m.dismissed);
  const appliedCount = matches.filter((m) => m.applied).length;
  const highConfCount = activeMatches.filter((m) => m.confidence >= 0.8).length;
  const activeBills = suggestedBills.filter((b) => !b.created && !b.dismissed);
  const activeRecurring = suggestedRecurring.filter((r) => !r.created && !r.dismissed);
  const totalDiscoveries = activeBills.length + activeRecurring.length;

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
                  {matches.length} match{matches.length !== 1 ? "es" : ""} · {totalDiscoveries} new pattern{totalDiscoveries !== 1 ? "s" : ""} discovered · {appliedCount} applied
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
                <Button variant="outline" onClick={handleAcceptAllMatches} disabled={isPending}>
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
          {statusMsg && (
            <p className="text-sm text-muted-foreground mt-3 p-2 rounded bg-muted">{statusMsg}</p>
          )}
        </CardContent>
      </Card>

      {/* Discovered Bills */}
      {suggestedBills.filter((b) => !b.dismissed).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-blue-500" />
            <h2 className="text-sm font-semibold">Discovered Bills</h2>
            <Badge variant="secondary" className="text-xs">{activeBills.length} new</Badge>
          </div>
          {suggestedBills.filter((b) => !b.dismissed).map((bill) => (
            <Card key={bill.name} className={bill.created ? "opacity-60 border-green-300" : "border-blue-200"}>
              <CardContent className="pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-blue-500 shrink-0" />
                      <span className="text-sm font-medium">{bill.name}</span>
                      <Badge variant="outline" className="text-xs">{bill.category}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmt.format(bill.expectedAmount)}/mo · Due day {bill.dueDayOfMonth} · {bill.transactionIds.length} transaction{bill.transactionIds.length !== 1 ? "s" : ""} found
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="size-3" />{bill.reasoning}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceBadge confidence={bill.confidence} />
                    {bill.created ? (
                      <Badge className="bg-green-600 text-white"><Check className="size-3 mr-1" />Created</Badge>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => handleCreateBill(bill)} disabled={isPending}>
                          <Plus className="size-4 mr-1" />Create Bill
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSuggestedBills((prev) => prev.map((b) => b.name === bill.name ? { ...b, dismissed: true } : b))}>
                          <X className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Discovered Recurring */}
      {suggestedRecurring.filter((r) => !r.dismissed).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-purple-500" />
            <h2 className="text-sm font-semibold">Discovered Recurring Payments</h2>
            <Badge variant="secondary" className="text-xs">{activeRecurring.length} new</Badge>
          </div>
          {suggestedRecurring.filter((r) => !r.dismissed).map((rec) => (
            <Card key={rec.name} className={rec.created ? "opacity-60 border-green-300" : "border-purple-200"}>
              <CardContent className="pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Repeat className="size-4 text-purple-500 shrink-0" />
                      <span className="text-sm font-medium">{rec.name}</span>
                      <Badge variant="outline" className="text-xs">{rec.frequency}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmt.format(rec.amount)} · {rec.transactionIds.length} transaction{rec.transactionIds.length !== 1 ? "s" : ""} found
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="size-3" />{rec.reasoning}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceBadge confidence={rec.confidence} />
                    {rec.created ? (
                      <Badge className="bg-green-600 text-white"><Check className="size-3 mr-1" />Created</Badge>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => handleCreateRecurring(rec)} disabled={isPending}>
                          <Plus className="size-4 mr-1" />Create Recurring
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSuggestedRecurring((prev) => prev.map((r) => r.name === rec.name ? { ...r, dismissed: true } : r))}>
                          <X className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Existing Match Results */}
      {matches.filter((m) => !m.dismissed).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Matched to Existing</h2>
          </div>
          {matches.filter((m) => !m.dismissed).map((match) => {
            const tx = transactions.find((t) => t.id === match.transactionId);
            if (!tx) return null;

            return (
              <Card key={match.transactionId} className={match.applied ? "opacity-60 border-green-300" : ""}>
                <CardContent className="pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{tx.payee || tx.description || "Unknown"}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{tx.accountName}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(tx.date))} · {fmt.format(Math.abs(tx.amount))}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center px-3">
                      <Link2 className="size-4 text-muted-foreground" />
                    </div>
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
                          {match.matchType === "debt" ? "Debt" : match.matchType === "bill" ? "Bill" : "Recurring"}
                        </Badge>
                      </div>
                      {match.matchType === "debt" && match.suggestedPrincipal != null && (
                        <div className="text-xs text-muted-foreground">
                          P: {fmt.format(match.suggestedPrincipal)} · I: {fmt.format(match.suggestedInterest || 0)}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sparkles className="size-3 shrink-0" />{match.reasoning}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ConfidenceBadge confidence={match.confidence} />
                      {match.applied ? (
                        <Badge className="bg-green-600 text-white"><Check className="size-3 mr-1" />Linked</Badge>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => handleAcceptMatch(match)} disabled={isPending}>
                            <Check className="size-4 mr-1" />Accept
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setMatches((prev) => prev.map((m) => m.transactionId === match.transactionId ? { ...m, dismissed: true } : m))}>
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
        </div>
      )}

      {/* Empty state after analysis */}
      {analyzed && matches.length === 0 && suggestedBills.length === 0 && suggestedRecurring.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No matches or patterns found. Your transactions don&apos;t appear to match any debts, and no recurring patterns were detected.</p>
          </CardContent>
        </Card>
      )}

      {/* Pre-analysis transaction list */}
      {!analyzed && (
        <Card>
          <CardHeader>
            <CardTitle>Unlinked Transactions</CardTitle>
            <CardDescription>Claude will match these to debts and bills, and discover new recurring payments</CardDescription>
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
