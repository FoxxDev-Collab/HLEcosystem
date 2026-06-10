// Quick-add transaction form (legacy components/transaction-form.tsx).
// Type tabs switch the category list (and swap the category select for a
// destination-account select for transfers). The legacy AI category
// suggestion belongs to the categorize feature and is not wired here.
import { useState } from "react"
import { createTransactionFn } from "@/server/finance/fns.transactions"
import type { AccountPickerRow } from "@/server/finance/accounts"
import type { CategoryPickerRow } from "@/server/finance/categories"
import type { TransactionType } from "@/server/finance/transactions"
import { toDateInputValue } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const TYPE_TABS: Array<{
  value: TransactionType
  label: string
  color: string
}> = [
  { value: "EXPENSE", label: "Expense", color: "text-red-600" },
  { value: "INCOME", label: "Income", color: "text-green-600" },
  { value: "TRANSFER", label: "Transfer", color: "" },
]

export function TransactionForm({
  accounts,
  categories,
  defaultAccountId,
  onSaved,
}: {
  accounts: Array<AccountPickerRow>
  categories: Array<CategoryPickerRow>
  defaultAccountId?: string
  onSaved: () => void
}) {
  const [txType, setTxType] = useState<TransactionType>("EXPENSE")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const today = toDateInputValue(new Date())

  const filteredCategories = categories.filter((c) => c.type === txType)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createTransactionFn({
        data: {
          type: txType,
          accountId: String(f.get("accountId") ?? ""),
          categoryId:
            txType === "TRANSFER"
              ? null
              : String(f.get("categoryId") ?? "") || null,
          amount: Number(f.get("amount")),
          date: String(f.get("date") ?? ""),
          payee: String(f.get("payee") ?? ""),
          description: String(f.get("description") ?? ""),
          transferToAccountId:
            txType === "TRANSFER"
              ? String(f.get("transferToAccountId") ?? "") || null
              : null,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      onSaved()
    } catch {
      setError("Could not add transaction.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTxType(t.value)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              txType === t.value
                ? `bg-background shadow-sm ${t.color}`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tx-amount">Amount</Label>
          <Input
            id="tx-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            required
            className="text-lg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tx-date">Date</Label>
          <Input
            id="tx-date"
            name="date"
            type="date"
            defaultValue={today}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tx-account">Account</Label>
          <select
            id="tx-account"
            name="accountId"
            className={selectClass}
            defaultValue={defaultAccountId ?? accounts[0]?.id}
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {txType === "TRANSFER" ? (
          <div className="space-y-2">
            <Label htmlFor="tx-transfer-to">Transfer To</Label>
            <select
              id="tx-transfer-to"
              name="transferToAccountId"
              className={selectClass}
              required
            >
              <option value="">Select destination</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tx-category">Category</Label>
            <select id="tx-category" name="categoryId" className={selectClass}>
              <option value="">Uncategorized</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentCategoryId ? `— ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-payee">Payee</Label>
        <Input
          id="tx-payee"
          name="payee"
          placeholder="e.g. Walmart, Shell, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-description">Notes</Label>
        <Textarea
          id="tx-description"
          name="description"
          placeholder="Optional description"
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending
          ? "Adding…"
          : `Add ${txType === "EXPENSE" ? "Expense" : txType === "INCOME" ? "Income" : "Transfer"}`}
      </Button>
    </form>
  )
}
