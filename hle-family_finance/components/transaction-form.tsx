"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const today = new Date().toISOString().split("T")[0];

  const filteredCategories = categories.filter(
    (c) => c.type === txType || (txType === "TRANSFER" && c.type === "TRANSFER")
  );

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
            onClick={() => setTxType(t.value)}
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
            <Label htmlFor="categoryId">Category</Label>
            <Select name="categoryId" defaultValue={filteredCategories[0]?.id}>
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
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="payee">Payee</Label>
        <Input id="payee" name="payee" placeholder="e.g. Walmart, Shell, etc." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notes</Label>
        <Textarea id="description" name="description" placeholder="Optional description" rows={2} />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Add {txType === "EXPENSE" ? "Expense" : txType === "INCOME" ? "Income" : "Transfer"}
      </Button>
    </form>
  );
}
