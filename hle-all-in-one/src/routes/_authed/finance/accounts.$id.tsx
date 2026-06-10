import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  Archive,
  ArrowLeft,
  Calendar,
  Hash,
  Pencil,
  Scale,
  Trash2,
  Wallet,
} from "lucide-react"
import {
  adjustBalanceFn,
  deleteAccountFn,
  getAccountDetailFn,
  toggleAccountArchivedFn,
} from "@/server/finance/fns.accounts"
import { ACCOUNT_TYPE_LABELS } from "@/server/finance/accounts"
import { AccountFormDialog } from "@/components/finance/account-form"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export const Route = createFileRoute("/_authed/finance/accounts/$id")({
  loader: ({ params }) => getAccountDetailFn({ data: { id: params.id } }),
  component: AccountDetailPage,
})

function amountClass(type: string): string {
  if (type === "INCOME") return "text-green-600"
  if (type === "EXPENSE") return "text-red-600"
  return "text-muted-foreground"
}

function amountSign(type: string): string {
  if (type === "INCOME") return "+"
  if (type === "EXPENSE") return "-"
  return ""
}

function AccountDetailPage() {
  const { account, transactions } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!account) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/accounts"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Accounts
        </Link>
        <p className="text-sm text-muted-foreground">Account not found.</p>
      </div>
    )
  }

  function refresh() {
    router.invalidate()
  }

  async function onArchiveToggle() {
    if (!account) return
    await toggleAccountArchivedFn({
      data: { id: account.id, isArchived: !account.isArchived },
    })
    refresh()
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <Link
        to="/finance/accounts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Accounts
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="size-5 shrink-0 rounded-full"
            style={{ backgroundColor: account.color ?? "#6366f1" }}
          />
          <div>
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]}
              {account.institution ? ` at ${account.institution}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onArchiveToggle}>
            <Archive className="size-4" />
            {account.isArchived ? "Restore" : "Archive"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Transactions ({account.transactionCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No transactions yet
                </p>
              ) : (
                <div className="divide-y">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {tx.payee ?? tx.description ?? "Transaction"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(tx.date)} ·{" "}
                          {tx.categoryName ?? "Uncategorized"}
                        </p>
                      </div>
                      <span
                        className={`ml-3 shrink-0 text-sm font-semibold tabular-nums ${amountClass(tx.type)}`}
                      >
                        {amountSign(tx.type)}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="size-4" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className={`text-2xl font-bold tabular-nums ${account.currentBalance < 0 ? "text-red-600" : ""}`}
              >
                {formatCurrency(account.currentBalance)}
              </div>
              <AdjustBalanceForm
                accountId={account.id}
                currentBalance={account.currentBalance}
                onAdjusted={refresh}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="size-3.5 shrink-0" />
                <span>
                  Starting balance: {formatCurrency(account.initialBalance)}
                </span>
              </div>
              {account.creditLimit !== null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="size-3.5 shrink-0" />
                  <span>
                    Credit limit: {formatCurrency(account.creditLimit)}
                  </span>
                </div>
              )}
              {account.interestRate !== null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="size-3.5 shrink-0" />
                  <span>Interest rate: {account.interestRate}%</span>
                </div>
              )}
              {account.hsaAnnualLimit !== null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="size-3.5 shrink-0" />
                  <span>
                    HSA limit: {formatCurrency(account.hsaAnnualLimit)}
                    {account.hsaFamilyCoverage ? " (family)" : " (individual)"}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hash className="size-3.5 shrink-0" />
                <span>{account.transactionCount} transactions</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" />
                <span>Created {formatDate(account.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge
                  variant={account.isArchived ? "secondary" : "default"}
                  className="ml-auto"
                >
                  {account.isArchived ? "Archived" : "Active"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {editOpen && (
        <AccountFormDialog
          account={account}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            refresh()
          }}
        />
      )}

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the account and ALL of its
                transactions, recurring rules, import history, and linked
                bill/debt payment records. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  deleteAccountFn({ data: { id: account.id } }).then(() =>
                    navigate({ to: "/finance/accounts" })
                  )
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// Legacy adjust-balance-form.tsx: enter the correct balance; the server
// inserts an isBalanceAdjustment transaction for the difference.
function AdjustBalanceForm({
  accountId,
  currentBalance,
  onAdjusted,
}: {
  accountId: string
  currentBalance: number
  onAdjusted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await adjustBalanceFn({
        data: {
          accountId,
          targetBalance: Number(f.get("targetBalance")),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      onAdjusted()
    } catch {
      setError("Could not adjust balance.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1">
          <Label htmlFor="adjust-target" className="text-xs">
            Correct Balance
          </Label>
          <Input
            id="adjust-target"
            name="targetBalance"
            type="number"
            step="0.01"
            placeholder={currentBalance.toFixed(2)}
            required
          />
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <Scale className="size-3.5" /> Adjust
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
