// Transaction link picker (legacy payment-transaction-link.tsx): searchable
// list of recent unlinked expense transactions, exact-amount matches first.
// Shared by the debt payment-history and bill mark-paid flows (named with
// the debt- prefix per the finance component convention; debts is its
// primary consumer).
import { useState } from "react"
import { Link2 } from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type LinkableTransaction = {
  id: string
  payee: string | null
  description: string | null
  amount: number
  date: string
}

export function TransactionLinkDialog({
  amount,
  transactions,
  error,
  onLink,
  onClose,
}: {
  amount: number
  transactions: Array<LinkableTransaction>
  error: string | null
  onLink: (transactionId: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")

  // Filter and sort: exact amount matches first, then most recent.
  const filtered = transactions
    .filter((t) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        t.payee?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        Math.abs(t.amount).toFixed(2).includes(q)
      )
    })
    .sort((a, b) => {
      const aMatch = Math.abs(Math.abs(a.amount) - amount) < 0.01 ? 0 : 1
      const bMatch = Math.abs(Math.abs(b.amount) - amount) < 0.01 ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return b.date.localeCompare(a.date)
    })

  const amountMatches = filtered.filter(
    (t) => Math.abs(Math.abs(t.amount) - amount) < 0.01
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Transaction</DialogTitle>
          <DialogDescription>
            Link this {formatCurrency(amount)} payment to a bank transaction.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by payee, description, or amount..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {amountMatches.length > 0 && !search && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-green-600">
              Suggested matches (same amount)
            </p>
            {amountMatches.map((t) => (
              <TransactionOption
                key={t.id}
                transaction={t}
                onLink={onLink}
                highlighted
              />
            ))}
          </div>
        )}

        <div className="max-h-[40vh] space-y-1 overflow-y-auto">
          {!search &&
            amountMatches.length > 0 &&
            filtered.length > amountMatches.length && (
              <p className="pt-2 text-xs font-medium text-muted-foreground">
                All recent transactions
              </p>
            )}
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching transactions found.
            </p>
          ) : (
            filtered
              .filter(
                (t) => search || !amountMatches.some((m) => m.id === t.id)
              )
              .slice(0, 20)
              .map((t) => (
                <TransactionOption key={t.id} transaction={t} onLink={onLink} />
              ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransactionOption({
  transaction,
  onLink,
  highlighted,
}: {
  transaction: LinkableTransaction
  onLink: (id: string) => void
  highlighted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onLink(transaction.id)}
      className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-colors hover:bg-accent/50 ${
        highlighted
          ? "border-green-300 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
          : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium">
          <Link2 className="size-3 shrink-0 text-muted-foreground" />
          {transaction.payee || transaction.description || "Unknown"}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDateShort(transaction.date)}
          {transaction.description && transaction.payee && (
            <> · {transaction.description}</>
          )}
        </div>
      </div>
      <div className="ml-3 shrink-0 text-sm font-medium">
        {formatCurrency(Math.abs(transaction.amount))}
      </div>
    </button>
  )
}
