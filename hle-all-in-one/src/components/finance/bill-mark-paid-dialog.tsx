// Mark-bill-paid dialog: amount paid (prefilled with the expected amount),
// optional confirmation number, and an optional link to a recent unlinked
// expense transaction (re-verified server-side, ADR-0005).
import { useState } from "react"
import { markBillPaidFn } from "@/server/finance/fns.bills"
import type { BillRow } from "@/server/finance/bills"
import type { LinkableTransaction } from "@/components/finance/debt-payment-link-dialog"
import { formatCurrency, formatDateShort } from "@/lib/format"
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

export function BillMarkPaidDialog({
  bill,
  transactions,
  onClose,
  onSaved,
}: {
  bill: BillRow
  transactions: Array<LinkableTransaction>
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
    try {
      const result = await markBillPaidFn({
        data: {
          billId: bill.id,
          amountPaid: Number(f.get("amountPaid") ?? 0),
          linkedTransactionId:
            String(f.get("linkedTransactionId") ?? "") || null,
          confirmationNumber: String(f.get("confirmationNumber") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not mark bill as paid.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark "{bill.name}" Paid</DialogTitle>
          <DialogDescription>
            Records this month's payment ({formatCurrency(bill.expectedAmount)}{" "}
            expected).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paid-amount">Amount Paid</Label>
            <Input
              id="paid-amount"
              name="amountPaid"
              type="number"
              step="0.01"
              min="0"
              defaultValue={bill.expectedAmount}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paid-transaction">
              Link Transaction (optional)
            </Label>
            <select
              id="paid-transaction"
              name="linkedTransactionId"
              className={selectClass}
              defaultValue=""
            >
              <option value="">No linked transaction</option>
              {transactions.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatDateShort(t.date)} ·{" "}
                  {t.payee || t.description || "Unknown"} ·{" "}
                  {formatCurrency(Math.abs(t.amount))}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paid-confirmation">Confirmation # (optional)</Label>
            <Input id="paid-confirmation" name="confirmationNumber" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Mark Paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
