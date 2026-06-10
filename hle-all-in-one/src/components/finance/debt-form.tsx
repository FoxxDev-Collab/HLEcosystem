// Create/edit debt dialog (legacy debts page inline form + DebtEditDialog).
// Interest rate is entered as a percentage; the server stores a decimal.
import { useState } from "react"
import { createDebtFn, updateDebtFn } from "@/server/finance/fns.debts"
import type { DebtRow, DebtType } from "@/server/finance/debts"
import { DEBT_TYPES, DEBT_TYPE_LABELS } from "@/lib/finance-constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

function numOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? Number(v) : null
}

export function DebtFormDialog({
  debt,
  onClose,
  onSaved,
}: {
  debt?: DebtRow
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const base = {
      name: String(f.get("name") ?? ""),
      type: String(f.get("type") ?? "OTHER") as DebtType,
      lender: String(f.get("lender") ?? ""),
      originalPrincipal: numOrNull(f.get("originalPrincipal")) ?? 0,
      currentBalance: numOrNull(f.get("currentBalance")) ?? 0,
      interestRatePercent: numOrNull(f.get("interestRatePercent")) ?? 0,
      termMonths: numOrNull(f.get("termMonths")),
      minimumPayment: numOrNull(f.get("minimumPayment")),
      notes: String(f.get("notes") ?? ""),
    }
    try {
      const result = debt
        ? await updateDebtFn({ data: { ...base, id: debt.id } })
        : await createDebtFn({ data: base })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not save debt.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{debt ? "Edit Debt" : "Add Debt"}</DialogTitle>
          <DialogDescription>
            {debt
              ? "Update the details for this debt."
              : "Track a mortgage, loan, or other liability."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="debt-name">Name</Label>
              <Input
                id="debt-name"
                name="name"
                defaultValue={debt?.name}
                placeholder="e.g. Home Mortgage"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-type">Type</Label>
              <select
                id="debt-type"
                name="type"
                className={selectClass}
                defaultValue={debt?.type ?? "OTHER"}
              >
                {DEBT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DEBT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-originalPrincipal">Original Amount</Label>
              <Input
                id="debt-originalPrincipal"
                name="originalPrincipal"
                type="number"
                step="0.01"
                min="0"
                defaultValue={debt?.originalPrincipal ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-currentBalance">Current Balance</Label>
              <Input
                id="debt-currentBalance"
                name="currentBalance"
                type="number"
                step="0.01"
                min="0"
                defaultValue={debt?.currentBalance ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-interestRatePercent">
                Interest Rate (%)
              </Label>
              <Input
                id="debt-interestRatePercent"
                name="interestRatePercent"
                type="number"
                step="0.01"
                min="0"
                placeholder="6.5"
                defaultValue={debt ? debt.interestRate * 100 : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-minimumPayment">Min Payment</Label>
              <Input
                id="debt-minimumPayment"
                name="minimumPayment"
                type="number"
                step="0.01"
                min="0"
                defaultValue={debt?.minimumPayment ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-termMonths">Term (months)</Label>
              <Input
                id="debt-termMonths"
                name="termMonths"
                type="number"
                min="1"
                placeholder="e.g. 360"
                defaultValue={debt?.termMonths ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-lender">Lender</Label>
              <Input
                id="debt-lender"
                name="lender"
                defaultValue={debt?.lender ?? ""}
                placeholder="e.g. Wells Fargo"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debt-notes">Notes</Label>
            <Textarea
              id="debt-notes"
              name="notes"
              rows={2}
              defaultValue={debt?.notes ?? ""}
              placeholder="Optional"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : debt ? "Save Changes" : "Add Debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
