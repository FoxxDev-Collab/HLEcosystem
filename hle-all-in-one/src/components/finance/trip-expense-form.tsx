import { useRef, useState } from "react"
import { Plus } from "lucide-react"
import type { AccountPickerRow } from "@/server/finance/accounts"
import type { CategoryPickerRow } from "@/server/finance/categories"
import type { FinanceTripExpenseType } from "@/server/finance/trips"
import {
  TRIP_EXPENSE_TYPES,
  TRIP_EXPENSE_TYPE_LABELS,
} from "@/server/finance/trips"
import { addTripExpenseFn } from "@/server/finance/fns.trips"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function todayValue(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${m}-${d}`
}

// Legacy trips/[id] "Add Expense" form: creates a real EXPENSE transaction
// plus the linked trip expense, then uploads the optional receipt against
// the new expense id.
export function TripExpenseForm({
  tripId,
  accounts,
  categories,
  onAdded,
}: {
  tripId: string
  accounts: Array<AccountPickerRow>
  categories: Array<CategoryPickerRow>
  onAdded: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Legacy override picker: top-level expense categories only.
  const expenseCategories = categories.filter(
    (c) => c.type === "EXPENSE" && c.parentCategoryId === null
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await addTripExpenseFn({
        data: {
          tripId,
          expenseType: String(f.get("expenseType")) as FinanceTripExpenseType,
          date: String(f.get("date") ?? ""),
          amount: Number(f.get("amount")),
          payee: String(f.get("payee") ?? ""),
          description: String(f.get("description") ?? ""),
          accountId: String(f.get("accountId") ?? ""),
          categoryId: String(f.get("categoryId") ?? "").trim() || null,
        },
      })
      if ("error" in result) {
        setError(result.error)
        return
      }

      const receipt = fileRef.current?.files?.[0]
      if (receipt && receipt.size > 0) {
        const uploadData = new FormData()
        uploadData.set("expenseId", result.id)
        uploadData.set("file", receipt)
        const res = await fetch("/api/finance/trip-receipts/upload", {
          method: "POST",
          body: uploadData,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          setError(
            `Expense added, but the receipt upload failed${body?.error ? `: ${body.error}` : "."}`
          )
          onAdded()
          return
        }
      }

      form.reset()
      onAdded()
    } catch {
      setError("Could not add expense.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="trip-expense-type">Type</Label>
              <select
                id="trip-expense-type"
                name="expenseType"
                required
                className={selectClass}
              >
                {TRIP_EXPENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "TRANSPORT"
                      ? "Transport (parking, tolls, rideshare)"
                      : TRIP_EXPENSE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-expense-date">Date</Label>
              <Input
                id="trip-expense-date"
                name="date"
                type="date"
                defaultValue={todayValue()}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-expense-amount">Amount</Label>
              <Input
                id="trip-expense-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-expense-account">Account</Label>
              <select
                id="trip-expense-account"
                name="accountId"
                required
                className={selectClass}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="trip-expense-payee">Payee / Vendor</Label>
              <Input
                id="trip-expense-payee"
                name="payee"
                placeholder="e.g. Shell, Marriott"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-expense-description">Description</Label>
              <Input
                id="trip-expense-description"
                name="description"
                placeholder="Optional notes"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-expense-category">Category Override</Label>
              <select
                id="trip-expense-category"
                name="categoryId"
                className={selectClass}
              >
                <option value="">Auto (from type)</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="trip-expense-receipt">Receipt</Label>
              <Input
                id="trip-expense-receipt"
                ref={fileRef}
                name="receipt"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.heic"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" /> Add Expense
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
