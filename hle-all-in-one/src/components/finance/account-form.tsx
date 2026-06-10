// Create/edit account dialog (legacy components/account-form.tsx + the
// /accounts/new and /accounts/[id]/edit pages, folded into one dialog).
// Includes the extended fields from the port plan: credit limit, interest
// rate, HSA annual limit + family coverage, notes.
import { useState } from "react"
import { createAccountFn, updateAccountFn } from "@/server/finance/fns.accounts"
import type { AccountRow, AccountType } from "@/server/finance/accounts"
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/server/finance/accounts"
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

const COLORS = [
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#8b5cf6",
  "#64748b",
  "#78716c",
]

function numOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? Number(v) : null
}

export function AccountFormDialog({
  account,
  onClose,
  onSaved,
}: {
  account?: AccountRow
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<AccountType>(account?.type ?? "CHECKING")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const base = {
      name: String(f.get("name") ?? ""),
      type,
      institution: String(f.get("institution") ?? ""),
      creditLimit:
        type === "CREDIT_CARD" ? numOrNull(f.get("creditLimit")) : null,
      interestRate: numOrNull(f.get("interestRate")),
      hsaAnnualLimit:
        type === "HSA" ? numOrNull(f.get("hsaAnnualLimit")) : null,
      hsaFamilyCoverage: type === "HSA" && f.get("hsaFamilyCoverage") === "on",
      color: String(f.get("color") ?? "#6366f1"),
      notes: String(f.get("notes") ?? ""),
    }
    try {
      const result = account
        ? await updateAccountFn({ data: { ...base, id: account.id } })
        : await createAccountFn({
            data: {
              ...base,
              initialBalance: numOrNull(f.get("initialBalance")) ?? 0,
            },
          })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not save account.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {account
              ? "Update account details. Balances are managed by transactions."
              : "Track a bank account, card, loan, or cash."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acct-name">Account Name</Label>
            <Input
              id="acct-name"
              name="name"
              defaultValue={account?.name}
              placeholder="e.g. Wells Fargo Checking"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acct-type">Account Type</Label>
              <select
                id="acct-type"
                name="type"
                className={selectClass}
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-institution">Institution</Label>
              <Input
                id="acct-institution"
                name="institution"
                defaultValue={account?.institution ?? ""}
                placeholder="e.g. Wells Fargo"
              />
            </div>
          </div>

          {!account && (
            <div className="space-y-2">
              <Label htmlFor="acct-initialBalance">Starting Balance</Label>
              <Input
                id="acct-initialBalance"
                name="initialBalance"
                type="number"
                step="0.01"
                defaultValue="0"
                placeholder="0.00"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {type === "CREDIT_CARD" && (
              <div className="space-y-2">
                <Label htmlFor="acct-creditLimit">Credit Limit</Label>
                <Input
                  id="acct-creditLimit"
                  name="creditLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={account?.creditLimit ?? ""}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="acct-interestRate">Interest Rate %</Label>
              <Input
                id="acct-interestRate"
                name="interestRate"
                type="number"
                step="0.001"
                min="0"
                defaultValue={account?.interestRate ?? ""}
              />
            </div>
          </div>

          {type === "HSA" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acct-hsaAnnualLimit">HSA Annual Limit</Label>
                <Input
                  id="acct-hsaAnnualLimit"
                  name="hsaAnnualLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={account?.hsaAnnualLimit ?? ""}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="acct-hsaFamilyCoverage"
                  name="hsaFamilyCoverage"
                  defaultChecked={account?.hsaFamilyCoverage ?? false}
                  className="size-4 accent-primary"
                />
                <Label htmlFor="acct-hsaFamilyCoverage" className="text-sm">
                  Family coverage
                </Label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={color}
                    defaultChecked={color === (account?.color ?? "#6366f1")}
                    className="peer sr-only"
                  />
                  <div
                    className="h-7 w-7 rounded-full border-2 border-transparent transition-all peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-foreground/20 peer-checked:ring-offset-2"
                    style={{ backgroundColor: color }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acct-notes">Notes</Label>
            <Input
              id="acct-notes"
              name="notes"
              defaultValue={account?.notes ?? ""}
              placeholder="Optional"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : account
                  ? "Save Changes"
                  : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
