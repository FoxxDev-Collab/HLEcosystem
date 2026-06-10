import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import {
  ArrowLeft,
  Car,
  Fuel,
  Hotel,
  Landmark,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Receipt,
  ShoppingBag,
  Trash2,
  Utensils,
} from "lucide-react"
import type {
  FinanceTripExpenseType,
  FinanceTripStatus,
  TripDetailRow,
  TripExpenseRow,
} from "@/server/finance/trips"
import { TRIP_EXPENSE_TYPE_LABELS, TRIP_STATUSES } from "@/server/finance/trips"
import {
  deleteTripExpenseFn,
  deleteTripFn,
  getTripDetailFn,
  updateTripFn,
  updateTripStatusFn,
} from "@/server/finance/fns.trips"
import { TripExpenseForm } from "@/components/finance/trip-expense-form"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

export const Route = createFileRoute("/_authed/finance/trips/$id")({
  loader: ({ params }) => getTripDetailFn({ data: { id: params.id } }),
  component: TripDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const EXPENSE_TYPE_ICONS: Record<FinanceTripExpenseType, typeof Fuel> = {
  GAS: Fuel,
  FOOD: Utensils,
  LODGING: Hotel,
  TRANSPORT: Car,
  SUPPLIES: ShoppingBag,
  OTHER: MoreHorizontal,
}

const EXPENSE_TYPE_COLORS: Record<FinanceTripExpenseType, string> = {
  GAS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  FOOD: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  LODGING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  TRANSPORT: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  SUPPLIES:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

function TripDetailPage() {
  const { trip, expenses, accounts, categories, projects } =
    Route.useLoaderData()
  const router = useRouter()

  if (!trip) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/trips"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Trips
        </Link>
        <p className="text-sm text-muted-foreground">Trip not found.</p>
      </div>
    )
  }

  function refresh() {
    router.invalidate()
  }

  const totalSpent = trip.totalSpent

  const byType = expenses.reduce<
    Partial<Record<FinanceTripExpenseType, number>>
  >((acc, e) => {
    acc[e.expenseType] = (acc[e.expenseType] ?? 0) + e.amount
    return acc
  }, {})
  const byTypeEntries = (
    Object.entries(byType) as Array<[FinanceTripExpenseType, number]>
  ).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-6">
      <Link
        to="/finance/trips"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Trips
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{trip.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {trip.destination && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {trip.destination}
              </span>
            )}
            <span>
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TRIP_STATUSES.map((status: FinanceTripStatus) => (
            <Button
              key={status}
              variant={trip.status === status ? "default" : "outline"}
              size="sm"
              onClick={async () => {
                await updateTripStatusFn({ data: { id: trip.id, status } })
                refresh()
              }}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(totalSpent)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses.length}</div>
          </CardContent>
        </Card>
        {trip.isTaxDeductible ? (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1 text-sm">
                <Landmark className="size-3.5" /> Tax Deductible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {trip.taxPurpose || "Yes"}
              </div>
              <div className="mt-1 text-2xl font-bold text-green-600 tabular-nums">
                {formatCurrency(totalSpent)}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {trip.description || "No description"}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {byTypeEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {byTypeEntries.map(([type, amount]) => {
                const Icon = EXPENSE_TYPE_ICONS[type]
                const pct =
                  totalSpent > 0
                    ? ((amount / totalSpent) * 100).toFixed(0)
                    : "0"
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className={`flex size-8 items-center justify-center rounded ${EXPENSE_TYPE_COLORS[type]}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium tabular-nums">
                        {formatCurrency(amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {TRIP_EXPENSE_TYPE_LABELS[type]} ({pct}%)
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <TripExpenseForm
        tripId={trip.id}
        accounts={accounts}
        categories={categories}
        onAdded={refresh}
      />

      <ExpensesCard expenses={expenses} onChanged={refresh} />

      <TripDetailsCard trip={trip} projects={projects} onChanged={refresh} />

      {trip.budgetPlannerProjectId && trip.budgetPlannerProjectName && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Linked Budget Planner Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/finance/budget-planner/$id"
              params={{ id: trip.budgetPlannerProjectId }}
              className="text-sm text-blue-600 hover:underline"
            >
              {trip.budgetPlannerProjectName} →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ExpensesCard({
  expenses,
  onChanged,
}: {
  expenses: Array<TripExpenseRow>
  onChanged: () => void
}) {
  const [deleteTarget, setDeleteTarget] = useState<TripExpenseRow | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses ({expenses.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No expenses yet. Add your first receipt above.
          </p>
        ) : (
          <div className="divide-y">
            {expenses.map((expense) => {
              const Icon = EXPENSE_TYPE_ICONS[expense.expenseType]
              return (
                <div
                  key={expense.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded ${EXPENSE_TYPE_COLORS[expense.expenseType]}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {expense.payee ||
                          TRIP_EXPENSE_TYPE_LABELS[expense.expenseType]}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(expense.date)}</span>
                        <Badge
                          variant="outline"
                          className={`px-1.5 py-0 text-[10px] ${EXPENSE_TYPE_COLORS[expense.expenseType]}`}
                        >
                          {TRIP_EXPENSE_TYPE_LABELS[expense.expenseType]}
                        </Badge>
                        {expense.description && (
                          <span className="truncate">
                            {expense.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {expense.receiptFileName ? (
                      <a
                        href={`/api/finance/trip-receipts/serve/${expense.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                        title={expense.receiptFileName}
                      >
                        <Paperclip className="size-3" /> Receipt
                      </a>
                    ) : (
                      <span
                        className="text-xs text-muted-foreground"
                        title="No receipt"
                      >
                        <Receipt className="size-3.5" />
                      </span>
                    )}
                    <span className="w-24 text-right text-sm font-medium tabular-nums">
                      {formatCurrency(expense.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(expense)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {deleteTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the expense, its receipt, and the linked
                transaction (the account balance is restored).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  deleteTripExpenseFn({
                    data: { id: deleteTarget.id, deleteTransaction: true },
                  }).then(() => {
                    setDeleteTarget(null)
                    onChanged()
                  })
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  )
}

function TripDetailsCard({
  trip,
  projects,
  onChanged,
}: {
  trip: TripDetailRow
  projects: Array<{ id: string; name: string }>
  onChanged: () => void
}) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      await updateTripFn({
        data: {
          id: trip.id,
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
          destination: String(f.get("destination") ?? ""),
          startDate: String(f.get("startDate") ?? ""),
          endDate: String(f.get("endDate") ?? ""),
          isTaxDeductible: f.get("isTaxDeductible") === "on",
          taxPurpose: String(f.get("taxPurpose") ?? ""),
          budgetPlannerProjectId:
            String(f.get("budgetPlannerProjectId") ?? "").trim() || null,
          notes: String(f.get("notes") ?? ""),
        },
      })
      onChanged()
    } catch {
      setError("Could not save trip.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trip Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="edit-trip-name">Trip Name</Label>
              <Input
                id="edit-trip-name"
                name="name"
                defaultValue={trip.name}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-trip-destination">Destination</Label>
              <Input
                id="edit-trip-destination"
                name="destination"
                defaultValue={trip.destination ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-trip-start">Start Date</Label>
              <Input
                id="edit-trip-start"
                name="startDate"
                type="date"
                defaultValue={trip.startDate}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-trip-end">End Date</Label>
              <Input
                id="edit-trip-end"
                name="endDate"
                type="date"
                defaultValue={trip.endDate}
                required
              />
            </div>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="edit-trip-description">Description</Label>
              <Input
                id="edit-trip-description"
                name="description"
                defaultValue={trip.description ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-trip-project">Linked Project</Label>
              <select
                id="edit-trip-project"
                name="budgetPlannerProjectId"
                defaultValue={trip.budgetPlannerProjectId ?? ""}
                className={selectClass}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                name="isTaxDeductible"
                id="edit-trip-tax"
                defaultChecked={trip.isTaxDeductible}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="edit-trip-tax" className="cursor-pointer">
                Tax Deductible
              </Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-trip-purpose">Tax Purpose</Label>
              <Input
                id="edit-trip-purpose"
                name="taxPurpose"
                defaultValue={trip.taxPurpose ?? ""}
                placeholder="e.g. Property repair"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-trip-notes">Notes</Label>
            <Textarea
              id="edit-trip-notes"
              name="notes"
              defaultValue={trip.notes ?? ""}
              rows={3}
              placeholder="Additional notes about this trip..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between">
            <Button type="submit" disabled={pending}>
              Save Changes
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete Trip
            </Button>
          </div>
        </form>
      </CardContent>

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {trip.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the trip, its expenses, and any uploaded receipts.
                Linked transactions stay in the ledger. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  deleteTripFn({ data: { id: trip.id } }).then(() =>
                    navigate({ to: "/finance/trips" })
                  )
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  )
}
