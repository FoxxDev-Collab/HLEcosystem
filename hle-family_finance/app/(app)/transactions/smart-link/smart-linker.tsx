"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Check, X, Loader2, Link2, CreditCard, FileText, Repeat, Zap, Plus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
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

type EditableSuggestion = {
  key: string;
  originalType: "bill" | "recurring";
  chosenType: "bill" | "recurring" | "skip";
  name: string;
  payee: string;
  amount: number;
  // Bill fields
  category: string;
  dueDayOfMonth: number;
  // Recurring fields
  frequency: string;
  // Common
  transactionIds: string[];
  confidence: number;
  reasoning: string;
  created: boolean;
  dismissed: boolean;
  editing: boolean;
};

const BILL_CATEGORIES = [
  { value: "UTILITIES", label: "Utilities" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "SUBSCRIPTIONS", label: "Subscriptions" },
  { value: "PHONE", label: "Phone" },
  { value: "INTERNET", label: "Internet" },
  { value: "RENT", label: "Rent" },
  { value: "MORTGAGE", label: "Mortgage" },
  { value: "CAR_PAYMENT", label: "Car Payment" },
  { value: "CHILD_CARE", label: "Child Care" },
  { value: "STREAMING", label: "Streaming" },
  { value: "OTHER", label: "Other" },
];

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI_WEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

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
  const [suggestions, setSuggestions] = useState<EditableSuggestion[]>([]);
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

      // Merge bills and recurring into unified editable suggestions
      const billSuggestions: EditableSuggestion[] = (result.suggestedBills || []).map((b, i) => ({
        key: `bill-${i}`,
        originalType: "bill",
        chosenType: "bill",
        name: b.name,
        payee: b.payee,
        amount: b.expectedAmount,
        category: b.category,
        dueDayOfMonth: b.dueDayOfMonth,
        frequency: "MONTHLY",
        transactionIds: b.transactionIds,
        confidence: b.confidence,
        reasoning: b.reasoning,
        created: false,
        dismissed: false,
        editing: false,
      }));
      const recSuggestions: EditableSuggestion[] = (result.suggestedRecurring || []).map((r, i) => ({
        key: `rec-${i}`,
        originalType: "recurring",
        chosenType: "recurring",
        name: r.name,
        payee: r.payee,
        amount: r.amount,
        category: "OTHER",
        dueDayOfMonth: 1,
        frequency: r.frequency,
        transactionIds: r.transactionIds,
        confidence: r.confidence,
        reasoning: r.reasoning,
        created: false,
        dismissed: false,
        editing: false,
      }));
      setSuggestions([...billSuggestions, ...recSuggestions]);
      setAnalyzed(true);
    });
  }

  function handleAutoLink() {
    startTransition(async () => {
      const result = await autoLinkTransactionsAction();
      setStatusMsg(result.error || `Auto-linked ${result.linked} transaction${result.linked !== 1 ? "s" : ""} using saved patterns.`);
      if (!result.error) router.refresh();
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
      result = await acceptDebtLinkAction(match.transactionId, match.matchId, amount, principal, interest, match.payeePattern);
    } else if (match.matchType === "bill") {
      result = await acceptBillLinkAction(match.transactionId, match.matchId, amount, match.payeePattern);
    } else {
      result = await acceptRecurringLinkAction(match.transactionId, match.matchId, match.payeePattern);
    }
    if (!result.error) {
      setMatches((prev) => prev.map((m) => m.transactionId === match.transactionId ? { ...m, applied: true } : m));
    }
  }

  async function handleCreateSuggestion(s: EditableSuggestion) {
    if (s.chosenType === "bill") {
      const result = await createBillFromSuggestionAction(
        s.name, s.payee, s.category, s.amount, s.dueDayOfMonth, s.transactionIds
      );
      if (!result.error) {
        setSuggestions((prev) => prev.map((x) => x.key === s.key ? { ...x, created: true } : x));
      }
    } else if (s.chosenType === "recurring") {
      const firstTx = transactions.find((t) => s.transactionIds.includes(t.id));
      const accountId = firstTx?.accountId || transactions[0]?.accountId;
      if (!accountId) return;
      const result = await createRecurringFromSuggestionAction(
        s.name, s.payee, s.amount, s.frequency, accountId, s.transactionIds
      );
      if (!result.error) {
        setSuggestions((prev) => prev.map((x) => x.key === s.key ? { ...x, created: true } : x));
      }
    }
  }

  function updateSuggestion(key: string, updates: Partial<EditableSuggestion>) {
    setSuggestions((prev) => prev.map((s) => s.key === key ? { ...s, ...updates } : s));
  }

  function handleAcceptAllMatches() {
    startTransition(async () => {
      for (const match of matches.filter((m) => m.confidence >= 0.8 && !m.applied && !m.dismissed)) {
        await handleAcceptMatch(match);
      }
      router.refresh();
    });
  }

  const activeMatches = matches.filter((m) => !m.applied && !m.dismissed);
  const appliedCount = matches.filter((m) => m.applied).length;
  const highConfCount = activeMatches.filter((m) => m.confidence >= 0.8).length;
  const activeSuggestions = suggestions.filter((s) => !s.created && !s.dismissed && s.chosenType !== "skip");

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
                  {matches.length} match{matches.length !== 1 ? "es" : ""} · {activeSuggestions.length} discovered · {appliedCount} applied
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
                  <Check className="size-4 mr-2" />Accept All High Confidence ({highConfCount})
                </Button>
              )}
              <Button onClick={handleAnalyze} disabled={isPending}>
                {isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                {analyzed ? "Re-analyze" : "Analyze with AI"}
              </Button>
            </div>
          </div>
          {statusMsg && <p className="text-sm text-muted-foreground mt-3 p-2 rounded bg-muted">{statusMsg}</p>}
        </CardContent>
      </Card>

      {/* Discovered Patterns (editable) */}
      {suggestions.filter((s) => !s.dismissed).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-blue-500" />
            <h2 className="text-sm font-semibold">Discovered Patterns</h2>
            <Badge variant="secondary" className="text-xs">{activeSuggestions.length} to review</Badge>
          </div>
          {suggestions.filter((s) => !s.dismissed).map((s) => (
            <SuggestionCard
              key={s.key}
              suggestion={s}
              transactions={transactions}
              isPending={isPending}
              onUpdate={(updates) => updateSuggestion(s.key, updates)}
              onCreate={() => handleCreateSuggestion(s)}
              onDismiss={() => updateSuggestion(s.key, { dismissed: true })}
            />
          ))}
        </div>
      )}

      {/* Matched to Existing */}
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
                    <div className="hidden sm:flex items-center px-3"><Link2 className="size-4 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {match.matchType === "debt" && <CreditCard className="size-4 text-red-500 shrink-0" />}
                        {match.matchType === "bill" && <FileText className="size-4 text-blue-500 shrink-0" />}
                        {match.matchType === "recurring" && <Repeat className="size-4 text-purple-500 shrink-0" />}
                        <span className="text-sm font-medium truncate">{match.matchName}</span>
                        <Badge variant={match.matchType === "debt" ? "destructive" : match.matchType === "bill" ? "secondary" : "outline"} className="text-xs shrink-0">
                          {match.matchType === "debt" ? "Debt" : match.matchType === "bill" ? "Bill" : "Recurring"}
                        </Badge>
                      </div>
                      {match.matchType === "debt" && match.suggestedPrincipal != null && (
                        <div className="text-xs text-muted-foreground">P: {fmt.format(match.suggestedPrincipal)} · I: {fmt.format(match.suggestedInterest || 0)}</div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="size-3 shrink-0" />{match.reasoning}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ConfidenceBadge confidence={match.confidence} />
                      {match.applied ? (
                        <Badge className="bg-green-600 text-white"><Check className="size-3 mr-1" />Linked</Badge>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => handleAcceptMatch(match)} disabled={isPending}><Check className="size-4 mr-1" />Accept</Button>
                          <Button size="sm" variant="ghost" onClick={() => setMatches((prev) => prev.map((m) => m.transactionId === match.transactionId ? { ...m, dismissed: true } : m))}><X className="size-4" /></Button>
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

      {/* Empty state */}
      {analyzed && matches.length === 0 && suggestions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No matches or patterns found.</p>
          </CardContent>
        </Card>
      )}

      {/* Pre-analysis */}
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
                    <div className="text-xs text-muted-foreground">{dateFmt.format(new Date(tx.date))} · {tx.accountName}</div>
                  </div>
                  <div className="text-sm font-medium shrink-0 ml-3">{fmt.format(Math.abs(tx.amount))}</div>
                </div>
              ))}
              {transactions.length > 30 && <p className="text-xs text-muted-foreground text-center py-3">+{transactions.length - 30} more</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion: s,
  transactions,
  isPending,
  onUpdate,
  onCreate,
  onDismiss,
}: {
  suggestion: EditableSuggestion;
  transactions: TransactionRow[];
  isPending: boolean;
  onUpdate: (updates: Partial<EditableSuggestion>) => void;
  onCreate: () => void;
  onDismiss: () => void;
}) {
  const matchingTxs = transactions.filter((t) => s.transactionIds.includes(t.id));
  const borderColor = s.created ? "border-green-300 opacity-60"
    : s.chosenType === "bill" ? "border-blue-200"
    : s.chosenType === "recurring" ? "border-purple-200"
    : "border-muted opacity-50";

  return (
    <Card className={borderColor}>
      <CardContent className="pt-5 space-y-3">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {s.chosenType === "bill" ? <FileText className="size-4 text-blue-500 shrink-0" /> :
               s.chosenType === "recurring" ? <Repeat className="size-4 text-purple-500 shrink-0" /> :
               <X className="size-4 text-muted-foreground shrink-0" />}
              <span className="text-sm font-medium">{s.name}</span>
              <Badge variant="outline" className="text-xs">
                {s.chosenType === "bill" ? s.category : s.chosenType === "recurring" ? s.frequency : "Skipped"}
              </Badge>
              <span className="text-sm font-medium">{fmt.format(s.amount)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3 shrink-0" />{s.reasoning}
              <span className="mx-1">·</span>
              {matchingTxs.length} transaction{matchingTxs.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConfidenceBadge confidence={s.confidence} />
            {s.created ? (
              <Badge className="bg-green-600 text-white"><Check className="size-3 mr-1" />Created</Badge>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => onUpdate({ editing: !s.editing })}>
                  {s.editing ? <ChevronUp className="size-4 mr-1" /> : <Pencil className="size-4 mr-1" />}
                  {s.editing ? "Close" : "Edit"}
                </Button>
                {s.chosenType !== "skip" && (
                  <Button size="sm" onClick={onCreate} disabled={isPending}>
                    <Plus className="size-4 mr-1" />
                    {s.chosenType === "bill" ? "Create Bill" : "Create Recurring"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onDismiss}><X className="size-4" /></Button>
              </>
            )}
          </div>
        </div>

        {/* Edit form */}
        {s.editing && !s.created && (
          <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Type switcher */}
              <div className="space-y-1">
                <Label className="text-xs">Create as</Label>
                <Select value={s.chosenType} onValueChange={(v) => onUpdate({ chosenType: v as "bill" | "recurring" | "skip" })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bill">Monthly Bill</SelectItem>
                    <SelectItem value="recurring">Recurring Transaction</SelectItem>
                    <SelectItem value="skip">Skip (don&apos;t create)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input className="h-8 text-sm" value={s.name} onChange={(e) => onUpdate({ name: e.target.value })} />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input className="h-8 text-sm" type="number" step="0.01" value={s.amount} onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })} />
              </div>

              {/* Payee */}
              <div className="space-y-1">
                <Label className="text-xs">Payee</Label>
                <Input className="h-8 text-sm" value={s.payee} onChange={(e) => onUpdate({ payee: e.target.value })} />
              </div>

              {/* Bill-specific */}
              {s.chosenType === "bill" && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select value={s.category} onValueChange={(v) => onUpdate({ category: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BILL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due Day of Month</Label>
                    <Input className="h-8 text-sm" type="number" min={1} max={31} value={s.dueDayOfMonth} onChange={(e) => onUpdate({ dueDayOfMonth: parseInt(e.target.value) || 1 })} />
                  </div>
                </>
              )}

              {/* Recurring-specific */}
              {s.chosenType === "recurring" && (
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={s.frequency} onValueChange={(v) => onUpdate({ frequency: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Matching transactions preview */}
            {matchingTxs.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Matching transactions:</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {matchingTxs.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex justify-between">
                      <span>{tx.payee || tx.description} · {dateFmt.format(new Date(tx.date))}</span>
                      <span>{fmt.format(Math.abs(tx.amount))}</span>
                    </div>
                  ))}
                  {matchingTxs.length > 5 && <p>+{matchingTxs.length - 5} more</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const variant = pct >= 85 ? "default" : pct >= 60 ? "secondary" : "outline";
  return <Badge variant={variant}>{pct}%</Badge>;
}
