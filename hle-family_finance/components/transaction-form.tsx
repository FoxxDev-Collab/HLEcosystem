"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { suggestCategoryAction } from "@/app/(app)/transactions/actions";
import type { SuggestCategoryResult } from "@/app/(app)/transactions/actions";

type Account = { id: string; name: string; type: string };
type Category = { id: string; name: string; type: string; color: string | null };

type Props = {
  action: (formData: FormData) => Promise<void>;
  accounts: Account[];
  categories: Category[];
  defaultAccountId?: string;
};

export function TransactionForm({ action, accounts, categories, defaultAccountId }: Props) {
  const [txType, setTxType] = useState<string>("EXPENSE");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories.filter((c) => c.type === "EXPENSE")[0]?.id ?? ""
  );
  const [payee, setPayee] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [suggesting, startSuggest] = useTransition();
  const [suggestion, setSuggestion] = useState<SuggestCategoryResult>(null);
  const today = new Date().toISOString().split("T")[0];

  const filteredCategories = categories.filter(
    (c) => c.type === txType || (txType === "TRANSFER" && c.type === "TRANSFER")
  );

  const canSuggest = txType !== "TRANSFER" && (payee.trim() || description.trim());

  const handleSuggest = () => {
    const categoryNames = filteredCategories.map((c) => c.name);
    startSuggest(async () => {
      const result = await suggestCategoryAction(
        payee,
        description,
        amount ? parseFloat(amount) : undefined,
        categoryNames
      );
      setSuggestion(result);
      if (result && "categoryName" in result) {
        const match = filteredCategories.find(
          (c) => c.name.toLowerCase() === result.categoryName.toLowerCase()
        );
        if (match) setSelectedCategoryId(match.id);
      }
    });
  };

  const handleTypeChange = (newType: string) => {
    setTxType(newType);
    setSuggestion(null);
    const first = categories.filter((c) => c.type === newType)[0];
    if (first) setSelectedCategoryId(first.id);
  };

  const confidenceColor = (c: number) =>
    c >= 0.85 ? "text-green-600 dark:text-green-400" : c >= 0.6 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground";

  return (
    <form action={action} className="space-y-4">
      {/* Transaction Type Selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {[
          { value: "EXPENSE", label: "Expense", color: "text-red-600" },
          { value: "INCOME", label: "Income", color: "text-green-600" },
          { value: "TRANSFER", label: "Transfer", color: "" },
        ].map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => handleTypeChange(t.value)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              txType === t.value ? `bg-background shadow-sm ${t.color}` : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={txType} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            required
            autoFocus
            className="text-lg"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accountId">Account</Label>
          <Select name="accountId" defaultValue={defaultAccountId || accounts[0]?.id}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {txType === "TRANSFER" ? (
          <div className="space-y-2">
            <Label htmlFor="transferToAccountId">Transfer To</Label>
            <Select name="transferToAccountId">
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="categoryId" className="flex items-center gap-2">
              Category
              {canSuggest && (
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={suggesting}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  title="AI suggest category"
                >
                  {suggesting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  Suggest
                </button>
              )}
            </Label>
            <Select
              name="categoryId"
              value={selectedCategoryId}
              onValueChange={(v) => {
                setSelectedCategoryId(v);
                setSuggestion(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      {c.color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />}
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {suggestion && "categoryName" in suggestion && (
              <div className="flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3 text-primary" />
                <span className="text-muted-foreground">
                  <strong>{suggestion.categoryName}</strong>
                </span>
                <span className={confidenceColor(suggestion.confidence)}>
                  {Math.round(suggestion.confidence * 100)}%
                </span>
                {suggestion.reasoning && (
                  <span className="text-muted-foreground hidden sm:inline truncate max-w-[200px]">
                    &mdash; {suggestion.reasoning}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="payee">Payee</Label>
        <Input
          id="payee"
          name="payee"
          placeholder="e.g. Walmart, Shell, etc."
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notes</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Optional description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Add {txType === "EXPENSE" ? "Expense" : txType === "INCOME" ? "Income" : "Transfer"}
      </Button>
    </form>
  );
}
