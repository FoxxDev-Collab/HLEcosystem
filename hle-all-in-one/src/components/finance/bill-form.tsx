// Create/edit monthly bill dialog (legacy bills page inline form, extended
// with the schema fields the legacy UI never wired: autopay account picker,
// linked debt, default category, variable amount, notes).
import { useState } from "react"
import { createBillFn, updateBillFn } from "@/server/finance/fns.bills"
import type { BillCategory, BillRow } from "@/server/finance/bills"
import { BILL_CATEGORIES } from "@/lib/finance-constants"
import type { AccountPickerRow } from "@/server/finance/accounts"
import type { CategoryPickerRow } from "@/server/finance/categories"
import type { DebtPickerRow } from "@/server/finance/debts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function billCategoryLabel(category: string): string {
  return category.replace(/_/g, " ")
}

export function BillFormDialog({
  bill,
  accounts,
  categories,
  debts,
  onClose,
  onSaved,
}: {
  bill?: BillRow
  accounts: Array<AccountPickerRow>
  categories: Array<CategoryPickerRow>
  debts: Array<DebtPickerRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [autoPay, setAutoPay] = useState(bill?.autoPay ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const base = {
      name: String(f.get("name") ?? ""),
      payee: String(f.get("payee") ?? ""),
      category: String(f.get("category") ?? "OTHER") as BillCategory,
      expectedAmount: Number(f.get("expectedAmount") ?? 0),
      isVariableAmount: f.get("isVariableAmount") === "on",
      dueDayOfMonth: parseInt(String(f.get("dueDayOfMonth") ?? "1"), 10),
      autoPay,
      autoPayAccountId: autoPay
        ? String(f.get("autoPayAccountId") ?? "") || null
        : null,
      linkedDebtId: String(f.get("linkedDebtId") ?? "") || null,
      defaultCategoryId: String(f.get("defaultCategoryId") ?? "") || null,
      websiteUrl: String(f.get("websiteUrl") ?? ""),
      notes: String(f.get("notes") ?? ""),
    }
    try {
      const result = bill
        ? await updateBillFn({ data: { ...base, id: bill.id } })
        : await createBillFn({ data: base })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not save bill.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bill ? "Edit Bill" : "Add Bill"}</DialogTitle>
          <DialogDescription>
            {bill
              ? "Update this recurring monthly bill."
              : "Track a recurring monthly bill and its due day."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bill-name">Bill Name</Label>
              <Input
                id="bill-name"
                name="name"
                defaultValue={bill?.name}
                placeholder="e.g. Electric Bill"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-payee">Payee</Label>
              <Input
                id="bill-payee"
                name="payee"
                defaultValue={bill?.payee ?? ""}
                placeholder="e.g. City Power Co"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-category">Bill Category</Label>
              <select
                id="bill-category"
                name="category"
                className={selectClass}
                defaultValue={bill?.category ?? "OTHER"}
              >
                {BILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {billCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-dueDayOfMonth">Due Day of Month</Label>
              <Input
                id="bill-dueDayOfMonth"
                name="dueDayOfMonth"
                type="number"
                min="1"
                max="31"
                defaultValue={bill?.dueDayOfMonth ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-expectedAmount">Expected Amount</Label>
              <Input
                id="bill-expectedAmount"
                name="expectedAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={bill?.expectedAmount ?? ""}
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="bill-isVariableAmount"
                name="isVariableAmount"
                defaultChecked={bill?.isVariableAmount ?? false}
                className="size-4 accent-primary"
              />
              <Label htmlFor="bill-isVariableAmount" className="text-sm">
                Amount varies month to month
              </Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bill-autoPay"
                checked={autoPay}
                onChange={(e) => setAutoPay(e.target.checked)}
                className="size-4 accent-primary"
              />
              <Label htmlFor="bill-autoPay" className="text-sm">
                Auto-pay
              </Label>
            </div>
            {autoPay && (
              <div className="space-y-2">
                <Label htmlFor="bill-autoPayAccountId">Auto-pay Account</Label>
                <select
                  id="bill-autoPayAccountId"
                  name="autoPayAccountId"
                  className={selectClass}
                  defaultValue={bill?.autoPayAccountId ?? ""}
                >
                  <option value="">None</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bill-linkedDebtId">Linked Debt</Label>
              <select
                id="bill-linkedDebtId"
                name="linkedDebtId"
                className={selectClass}
                defaultValue={bill?.linkedDebtId ?? ""}
              >
                <option value="">None</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-defaultCategoryId">Default Category</Label>
              <select
                id="bill-defaultCategoryId"
                name="defaultCategoryId"
                className={selectClass}
                defaultValue={bill?.defaultCategoryId ?? ""}
              >
                <option value="">None</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentCategoryId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bill-websiteUrl">Payment Website</Label>
            <Input
              id="bill-websiteUrl"
              name="websiteUrl"
              type="url"
              defaultValue={bill?.websiteUrl ?? ""}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill-notes">Notes</Label>
            <Input
              id="bill-notes"
              name="notes"
              defaultValue={bill?.notes ?? ""}
              placeholder="Optional"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : bill ? "Save Changes" : "Add Bill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
