// Refinance dialog (legacy DebtRefinanceDialog): archives the old debt with
// its payment history and creates a new one chained via refinancedFromId,
// transferring linked assets/bills/link-patterns.
import { useState } from "react"
import { refinanceDebtFn } from "@/server/finance/fns.debts"
import type { DebtRow, DebtType } from "@/server/finance/debts"
import { DEBT_TYPES, DEBT_TYPE_LABELS } from "@/server/finance/debts"
import { formatCurrency, formatPercent } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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

export function DebtRefinanceDialog({
  debt,
  linkedAssetCount,
  linkedBillCount,
  onClose,
  onRefinanced,
}: {
  debt: DebtRow
  linkedAssetCount: number
  linkedBillCount: number
  onClose: () => void
  onRefinanced: (newDebtId: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await refinanceDebtFn({
        data: {
          oldDebtId: debt.id,
          name: String(f.get("name") ?? ""),
          type: String(f.get("type") ?? debt.type) as DebtType,
          lender: String(f.get("lender") ?? ""),
          newBalance: numOrNull(f.get("newBalance")) ?? 0,
          interestRatePercent: numOrNull(f.get("interestRatePercent")) ?? 0,
          termMonths: numOrNull(f.get("termMonths")),
          minimumPayment: numOrNull(f.get("minimumPayment")),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      if ("newDebtId" in result) {
        onRefinanced(result.newDebtId)
        return
      }
      setPending(false)
    } catch {
      setError("Could not refinance debt.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refinance Debt</DialogTitle>
          <DialogDescription>
            Enter the new loan terms. The current debt "{debt.name}" will be
            archived with its full payment history preserved.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Current Debt
            </p>
            <div className="flex justify-between text-sm">
              <span>Balance</span>
              <span className="font-medium text-red-600">
                {formatCurrency(debt.currentBalance)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Rate</span>
              <span className="font-medium">
                {formatPercent(debt.interestRate * 100, 2)}
              </span>
            </div>
            {debt.minimumPayment !== null && (
              <div className="flex justify-between text-sm">
                <span>Payment</span>
                <span className="font-medium">
                  {formatCurrency(debt.minimumPayment)}/mo
                </span>
              </div>
            )}
            {(linkedAssetCount > 0 || linkedBillCount > 0) && (
              <>
                <Separator className="my-1" />
                <p className="text-xs text-muted-foreground">
                  {linkedAssetCount > 0 &&
                    `${linkedAssetCount} linked asset${linkedAssetCount !== 1 ? "s" : ""}`}
                  {linkedAssetCount > 0 && linkedBillCount > 0 && " · "}
                  {linkedBillCount > 0 &&
                    `${linkedBillCount} linked bill${linkedBillCount !== 1 ? "s" : ""}`}
                  {" — will transfer to new debt"}
                </p>
              </>
            )}
          </div>

          <Separator />
          <p className="text-sm font-medium">New Loan Terms</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="refi-name">Name</Label>
              <Input
                id="refi-name"
                name="name"
                defaultValue={debt.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refi-type">Type</Label>
              <select
                id="refi-type"
                name="type"
                className={selectClass}
                defaultValue={debt.type}
              >
                {DEBT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DEBT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refi-newBalance">New Balance</Label>
              <Input
                id="refi-newBalance"
                name="newBalance"
                type="number"
                step="0.01"
                min="0"
                defaultValue={debt.currentBalance}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refi-rate">New Rate (%)</Label>
              <Input
                id="refi-rate"
                name="interestRatePercent"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 5.25"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refi-lender">New Lender</Label>
              <Input
                id="refi-lender"
                name="lender"
                defaultValue={debt.lender ?? ""}
                placeholder="e.g. Better Mortgage"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refi-minimumPayment">New Min Payment</Label>
              <Input
                id="refi-minimumPayment"
                name="minimumPayment"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refi-termMonths">Term (months)</Label>
              <Input
                id="refi-termMonths"
                name="termMonths"
                type="number"
                min="1"
                placeholder="e.g. 360"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Refinancing…" : "Refinance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
