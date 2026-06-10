import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Pause, Play, Plus, SkipForward, Trash2, Zap } from "lucide-react"
import {
  createRecurringFn,
  deleteRecurringFn,
  getRecurringPageFn,
  processDueRecurringFn,
  skipNextOccurrenceFn,
  toggleRecurringActiveFn,
} from "@/server/finance/fns.recurring"
import { RECURRENCE_FREQUENCIES } from "@/lib/finance-constants"
import type { RecurringRow } from "@/server/finance/recurring"
import type { TransactionType } from "@/server/finance/transactions"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_authed/finance/recurring")({
  loader: () => getRecurringPageFn(),
  component: RecurringPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function typeBadgeVariant(
  type: TransactionType
): "default" | "destructive" | "secondary" {
  if (type === "INCOME") return "default"
  if (type === "EXPENSE") return "destructive"
  return "secondary"
}

function RecurringPage() {
  const { recurrings, accounts, categories } = Route.useLoaderData()
  const router = useRouter()
  const [processing, setProcessing] = useState(false)

  const active = recurrings.filter((r) => r.isActive)
  const inactive = recurrings.filter((r) => !r.isActive)

  const today = toDateInputValue(new Date())
  const isDue = (r: RecurringRow) =>
    r.autoCreate && r.nextOccurrence !== null && r.nextOccurrence <= today
  const dueCount = active.filter(isDue).length

  function refresh() {
    router.invalidate()
  }

  async function onProcessDue() {
    setProcessing(true)
    try {
      await processDueRecurringFn()
      refresh()
    } finally {
      setProcessing(false)
    }
  }

  async function onSkip(id: string) {
    await skipNextOccurrenceFn({ data: { id } })
    refresh()
  }

  async function onToggle(id: string) {
    await toggleRecurringActiveFn({ data: { id } })
    refresh()
  }

  async function onDelete(id: string) {
    await deleteRecurringFn({ data: { id } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recurring Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active · {inactive.length} paused
          </p>
        </div>
        {dueCount > 0 && (
          <Button onClick={onProcessDue} disabled={processing}>
            <Zap className="size-4" />
            {processing ? "Processing…" : `Process ${dueCount} Due`}
          </Button>
        )}
      </div>

      <AddRecurringCard
        accounts={accounts}
        categories={categories}
        onSaved={refresh}
      />

      {recurrings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No recurring transactions yet. Add one above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Active</h2>
              {active.map((r) => (
                <Card
                  key={r.id}
                  className={
                    isDue(r)
                      ? "border-orange-300 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20"
                      : ""
                  }
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{r.name}</span>
                          <Badge
                            variant={typeBadgeVariant(r.type)}
                            className="text-xs"
                          >
                            {r.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {
                              RECURRENCE_FREQUENCIES.find(
                                (f) => f.value === r.frequency
                              )?.label
                            }
                          </Badge>
                          {isDue(r) && (
                            <Badge className="bg-orange-500 text-xs">Due</Badge>
                          )}
                          {r.autoCreate && (
                            <Badge variant="outline" className="text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {r.accountName}
                          {r.type === "TRANSFER" &&
                            r.transferToAccountName &&
                            ` → ${r.transferToAccountName}`}
                          {r.categoryName && ` · ${r.categoryName}`}
                          {r.payee && ` · ${r.payee}`}
                          {r.nextOccurrence &&
                            ` · Next: ${formatDate(r.nextOccurrence)}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`text-lg font-bold tabular-nums ${
                            r.type === "INCOME"
                              ? "text-green-600"
                              : r.type === "EXPENSE"
                                ? "text-red-600"
                                : ""
                          }`}
                        >
                          {r.type === "INCOME"
                            ? "+"
                            : r.type === "EXPENSE"
                              ? "-"
                              : ""}
                          {formatCurrency(r.amount)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Skip next"
                          onClick={() => onSkip(r.id)}
                        >
                          <SkipForward className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Pause"
                          onClick={() => onToggle(r.id)}
                        >
                          <Pause className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {inactive.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-muted-foreground">
                Paused
              </h2>
              {inactive.map((r) => (
                <Card key={r.id} className="opacity-60">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{r.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {r.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Paused
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {r.accountName} · {formatCurrency(r.amount)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Resume"
                          onClick={() => onToggle(r.id)}
                        >
                          <Play className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddRecurringCard({
  accounts,
  categories,
  onSaved,
}: {
  accounts: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string; type: string }>
  onSaved: () => void
}) {
  const [txType, setTxType] = useState<TransactionType>("EXPENSE")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const filteredCategories = categories.filter((c) => c.type === txType)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const dayOfPeriod = String(f.get("dayOfPeriod") ?? "").trim()
    try {
      const result = await createRecurringFn({
        data: {
          name: String(f.get("name") ?? ""),
          type: txType,
          accountId: String(f.get("accountId") ?? ""),
          categoryId:
            txType === "TRANSFER"
              ? null
              : String(f.get("categoryId") ?? "") || null,
          transferToAccountId:
            txType === "TRANSFER"
              ? String(f.get("transferToAccountId") ?? "") || null
              : null,
          amount: Number(f.get("amount")),
          payee: String(f.get("payee") ?? ""),
          frequency: String(f.get("frequency") ?? "MONTHLY") as
            | "DAILY"
            | "WEEKLY"
            | "BI_WEEKLY"
            | "MONTHLY"
            | "QUARTERLY"
            | "YEARLY",
          dayOfPeriod: dayOfPeriod ? Number(dayOfPeriod) : null,
          startDate: String(f.get("startDate") ?? ""),
          autoCreate: f.get("autoCreate") === "on",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      form.reset()
      setTxType("EXPENSE")
      onSaved()
    } catch {
      setError("Could not add recurring transaction.")
    } finally {
      setPending(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Create an account first before adding recurring transactions.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Recurring Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="rec-name">Name</Label>
            <Input
              id="rec-name"
              name="name"
              placeholder="e.g. Netflix, Rent"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-type">Type</Label>
            <select
              id="rec-type"
              name="type"
              className={selectClass}
              value={txType}
              onChange={(e) => setTxType(e.target.value as TransactionType)}
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-account">Account</Label>
            <select
              id="rec-account"
              name="accountId"
              className={selectClass}
              defaultValue={accounts[0]?.id}
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
            <div className="space-y-1">
              <Label htmlFor="rec-transfer-to">Transfer To</Label>
              <select
                id="rec-transfer-to"
                name="transferToAccountId"
                className={selectClass}
              >
                <option value="">Optional</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="rec-category">Category</Label>
              <select
                id="rec-category"
                name="categoryId"
                className={selectClass}
              >
                <option value="">Optional</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="rec-amount">Amount</Label>
            <Input
              id="rec-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-payee">Payee</Label>
            <Input id="rec-payee" name="payee" placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-frequency">Frequency</Label>
            <select
              id="rec-frequency"
              name="frequency"
              className={selectClass}
              defaultValue="MONTHLY"
            >
              {RECURRENCE_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-dayOfPeriod">Day of Period</Label>
            <Input
              id="rec-dayOfPeriod"
              name="dayOfPeriod"
              type="number"
              min="1"
              max="31"
              placeholder="e.g. 15"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-startDate">Start Date</Label>
            <Input
              id="rec-startDate"
              name="startDate"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              name="autoCreate"
              id="rec-autoCreate"
              defaultChecked
              className="size-4 accent-primary"
            />
            <Label htmlFor="rec-autoCreate" className="text-sm">
              Auto-create when due
            </Label>
          </div>
          <Button type="submit" disabled={pending} className="lg:col-span-2">
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Recurring"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
