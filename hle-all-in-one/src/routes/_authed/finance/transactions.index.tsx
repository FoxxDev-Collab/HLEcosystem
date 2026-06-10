import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { z } from "zod"
import { Pencil, Search, Trash2, X } from "lucide-react"
import {
  deleteTransactionFn,
  getTransactionsPageFn,
  updateTransactionFn,
} from "@/server/finance/fns.transactions"
import type {
  TransactionRow,
  TransactionType,
} from "@/server/finance/transactions"
import type { CategoryPickerRow } from "@/server/finance/categories"
import { TransactionForm } from "@/components/finance/transaction-form"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Filters arrive as search params (legacy page behavior); anything malformed
// is dropped.
const searchSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional().catch(undefined),
  account: z.string().regex(UUID_RE).optional().catch(undefined),
  category: z.string().regex(UUID_RE).optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  from: z.string().regex(DATE_RE).optional().catch(undefined),
  to: z.string().regex(DATE_RE).optional().catch(undefined),
  minAmount: z.number().nonnegative().optional().catch(undefined),
  maxAmount: z.number().nonnegative().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
})

type SearchParams = z.infer<typeof searchSchema>

export const Route = createFileRoute("/_authed/finance/transactions/")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    type: search.type ?? null,
    accountId: search.account ?? null,
    categoryId: search.category ?? null,
    q: search.q ?? null,
    from: search.from ?? null,
    to: search.to ?? null,
    minAmount: search.minAmount ?? null,
    maxAmount: search.maxAmount ?? null,
    page: search.page ?? 1,
  }),
  loader: ({ deps }) => getTransactionsPageFn({ data: deps }),
  component: TransactionsPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const TYPE_FILTERS: Array<{
  value: TransactionType | undefined
  label: string
}> = [
  { value: undefined, label: "All" },
  { value: "EXPENSE", label: "Expenses" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfers" },
]

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

function TransactionsPage() {
  const { transactions, totalCount, pageSize, accounts, categories } =
    Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const [editTarget, setEditTarget] = useState<TransactionRow | null>(null)

  const page = search.page ?? 1
  const totalPages = Math.ceil(totalCount / pageSize)
  const hasFilters = Boolean(
    search.q ||
    search.from ||
    search.to ||
    search.minAmount !== undefined ||
    search.maxAmount !== undefined ||
    search.category ||
    search.account
  )

  function refresh() {
    router.invalidate()
  }

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const str = (name: string) => String(f.get(name) ?? "").trim() || undefined
    const num = (name: string) => {
      const v = String(f.get(name) ?? "").trim()
      return v ? Number(v) : undefined
    }
    navigate({
      search: (prev: SearchParams): SearchParams => ({
        type: prev.type,
        q: str("q"),
        from: str("from"),
        to: str("to"),
        account: str("account"),
        category: str("category"),
        minAmount: num("minAmount"),
        maxAmount: num("maxAmount"),
        page: undefined,
      }),
    })
  }

  async function onDelete(id: string) {
    await deleteTransactionFn({ data: { id } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} transaction{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Add</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create an account first before adding transactions.{" "}
              <Link to="/finance/accounts" className="underline">
                Go to accounts
              </Link>
            </p>
          ) : (
            <TransactionForm
              accounts={accounts}
              categories={categories}
              onSaved={refresh}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" />
            Search &amp; Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={applyFilters}
            className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs" htmlFor="f-q">
                Search payee / description
              </Label>
              <Input
                id="f-q"
                name="q"
                placeholder="Search..."
                defaultValue={search.q ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="f-from">
                From Date
              </Label>
              <Input
                id="f-from"
                name="from"
                type="date"
                defaultValue={search.from ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="f-to">
                To Date
              </Label>
              <Input
                id="f-to"
                name="to"
                type="date"
                defaultValue={search.to ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="f-account">
                Account
              </Label>
              <select
                id="f-account"
                name="account"
                className={selectClass}
                defaultValue={search.account ?? ""}
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="f-category">
                Category
              </Label>
              <select
                id="f-category"
                name="category"
                className={selectClass}
                defaultValue={search.category ?? ""}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentCategoryId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="f-min">
                Min Amount
              </Label>
              <Input
                id="f-min"
                name="minAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                defaultValue={search.minAmount ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="f-max">
                Max Amount
              </Label>
              <Input
                id="f-max"
                name="maxAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                defaultValue={search.maxAmount ?? ""}
              />
            </div>
            <div className="flex gap-2 lg:col-span-4">
              <Button type="submit" size="sm">
                <Search className="size-3.5" /> Search
              </Button>
              {hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ search: {} })}
                >
                  <X className="size-3.5" /> Clear
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((t) => (
          <Link
            key={t.label}
            to="/finance/transactions"
            search={{ ...search, type: t.value, page: undefined }}
          >
            <Badge
              variant={search.type === t.value ? "default" : "outline"}
              className="cursor-pointer"
            >
              {t.label}
            </Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>History</span>
            <span className="text-sm font-normal text-muted-foreground">
              {totalCount} transactions
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions found
            </p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {tx.payee ?? tx.description ?? "Transaction"}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {tx.type}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(tx.date)} · {tx.accountName}
                      {tx.type === "TRANSFER" && tx.transferToAccountName && (
                        <> → {tx.transferToAccountName}</>
                      )}
                      {tx.categoryName && (
                        <>
                          {" "}
                          ·{" "}
                          <span
                            style={{ color: tx.categoryColor ?? undefined }}
                          >
                            {tx.categoryName}
                          </span>
                        </>
                      )}
                      {tx.description && tx.payee && <> · {tx.description}</>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-medium tabular-nums ${amountClass(tx.type)}`}
                    >
                      {amountSign(tx.type)}
                      {formatCurrency(tx.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Edit"
                      onClick={() => setEditTarget(tx)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => onDelete(tx.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  navigate({
                    search: {
                      ...search,
                      page: page > 2 ? page - 1 : undefined,
                    },
                  })
                }
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  navigate({ search: { ...search, page: page + 1 } })
                }
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {editTarget && (
        <EditTransactionDialog
          transaction={editTarget}
          categories={categories}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

// Edit is server-side delete + re-insert (same id) so the balance trigger
// reverses the old amount and applies the new one.
function EditTransactionDialog({
  transaction,
  categories,
  onClose,
  onSaved,
}: {
  transaction: TransactionRow
  categories: Array<CategoryPickerRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filteredCategories = categories.filter(
    (c) => c.type === transaction.type
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await updateTransactionFn({
        data: {
          id: transaction.id,
          amount: Number(f.get("amount")),
          date: String(f.get("date") ?? ""),
          categoryId: String(f.get("categoryId") ?? "") || null,
          payee: String(f.get("payee") ?? ""),
          description: String(f.get("description") ?? ""),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not update transaction.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            {transaction.type} on {transaction.accountName}. Account balances
            update automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={transaction.amount}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                name="date"
                type="date"
                defaultValue={transaction.date}
                required
              />
            </div>
          </div>
          {transaction.type !== "TRANSFER" && (
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
                name="categoryId"
                className={selectClass}
                defaultValue={transaction.categoryId ?? ""}
              >
                <option value="">Uncategorized</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentCategoryId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-payee">Payee</Label>
            <Input
              id="edit-payee"
              name="payee"
              defaultValue={transaction.payee ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Notes</Label>
            <Textarea
              id="edit-description"
              name="description"
              rows={2}
              defaultValue={transaction.description ?? ""}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
