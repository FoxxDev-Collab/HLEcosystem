import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Plus, Receipt, Trash2 } from "lucide-react"
import {
  createMedicalExpenseFn,
  deleteMedicalExpenseFn,
  getExpensesPageFn,
} from "@/server/health/fns.expenses"
import type {
  ExpenseCategory,
  MedicalExpenseRow,
} from "@/server/health/expenses"
import type { HealthMemberOption } from "@/server/health/medications"
import type { AccountPickerRow } from "@/server/finance/accounts"
import type { CategoryPickerRow } from "@/server/finance/categories"
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export const Route = createFileRoute("/_authed/health/expenses")({
  loader: () => getExpensesPageFn(),
  component: ExpensesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const EXPENSE_CATEGORIES: Array<ExpenseCategory> = [
  "MEDICAL_EQUIPMENT",
  "VISION",
  "DENTAL",
  "SUPPLIES",
  "OVER_THE_COUNTER",
  "PRESCRIPTION",
  "COPAY",
  "LAB_WORK",
  "THERAPY",
  "OTHER",
]

function categoryLabel(c: string): string {
  return c.replace(/_/g, " ")
}

function ExpensesPage() {
  const { members, expenses, financeAccounts, financeCategories } =
    Route.useLoaderData()
  const router = useRouter()
  const [year, setYear] = useState(new Date().getFullYear())
  const [deleteTarget, setDeleteTarget] = useState<MedicalExpenseRow | null>(
    null
  )

  // Legacy year filter (was a ?year= search param) — expenseDate is a
  // "YYYY-MM-DD" string, so the year is its first four characters.
  const yearExpenses = expenses.filter(
    (e) => e.expenseDate.slice(0, 4) === String(year)
  )

  const totalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0)
  const totalReimbursed = yearExpenses.reduce(
    (s, e) => s + (e.insuranceReimbursement ?? 0),
    0
  )
  const totalHsa = yearExpenses
    .filter((e) => e.paidFromHsa)
    .reduce((s, e) => s + e.amount, 0)
  const totalOop = totalExpenses - totalReimbursed

  function refresh() {
    router.invalidate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Medical Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Out-of-pocket costs, HSA spending, and reimbursements by year.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            title="Previous year"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-sm font-medium">{year}</span>
          <Button
            variant="outline"
            size="sm"
            title="Next year"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Insurance Reimbursed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalReimbursed)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Out of Pocket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOop)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">HSA Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalHsa)}</div>
          </CardContent>
        </Card>
      </div>

      <AddExpenseCard
        members={members}
        financeAccounts={financeAccounts}
        financeCategories={financeCategories}
        onSaved={refresh}
      />

      {yearExpenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="mx-auto mb-3 size-10 opacity-40" />
            <p>No medical expenses for {year}.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Expenses ({yearExpenses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {yearExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {exp.description}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabel(exp.category)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {exp.memberFirstName}
                      </Badge>
                      {exp.paidFromHsa && (
                        <Badge className="bg-blue-100 text-xs text-blue-800">
                          HSA
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(exp.expenseDate)}
                      {exp.insuranceReimbursement !== null &&
                        ` · Reimbursed: ${formatCurrency(exp.insuranceReimbursement)}`}
                      {exp.notes && ` · ${exp.notes}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600">
                      {formatCurrency(exp.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(exp)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {deleteTarget && (
        <DeleteExpenseDialog
          expense={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function AddExpenseCard({
  members,
  financeAccounts,
  financeCategories,
  onSaved,
}: {
  members: Array<HealthMemberOption>
  financeAccounts: Array<AccountPickerRow>
  financeCategories: Array<CategoryPickerRow>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [syncToFinance, setSyncToFinance] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setWarning(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const financeAccountId = String(f.get("financeAccountId") ?? "")
      const financeCategoryId = String(f.get("financeCategoryId") ?? "")
      const result = await createMedicalExpenseFn({
        data: {
          memberId: String(f.get("memberId") ?? ""),
          description: String(f.get("description") ?? ""),
          category: String(f.get("category") ?? "OTHER") as ExpenseCategory,
          amount: Number(f.get("amount") ?? 0),
          expenseDate: String(f.get("expenseDate") ?? ""),
          paidFromHsa: f.get("paidFromHsa") === "on",
          insuranceReimbursement: f.get("insuranceReimbursement")
            ? Number(f.get("insuranceReimbursement"))
            : null,
          notes: String(f.get("notes") ?? ""),
          finance:
            syncToFinance && financeAccountId
              ? {
                  accountId: financeAccountId,
                  categoryId: financeCategoryId || null,
                }
              : null,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      if ("financeWarning" in result && result.financeWarning) {
        setWarning(result.financeWarning)
      }
      form.reset()
      setSyncToFinance(false)
      setPending(false)
      onSaved()
    } catch {
      setError("Could not add expense.")
      setPending(false)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Enable health tracking for a family member first to log medical
          expenses.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add Expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="exp-member">Family Member</Label>
            <select
              id="exp-member"
              name="memberId"
              className={selectClass}
              defaultValue={members[0]?.id}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-description">Description</Label>
            <Input id="exp-description" name="description" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-category">Category</Label>
            <select
              id="exp-category"
              name="category"
              className={selectClass}
              defaultValue="OTHER"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-date">Date</Label>
            <Input
              id="exp-date"
              name="expenseDate"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-reimbursement">Insurance Reimbursement</Label>
            <Input
              id="exp-reimbursement"
              name="insuranceReimbursement"
              type="number"
              step="0.01"
              min="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-notes">Notes</Label>
            <Input id="exp-notes" name="notes" />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              name="paidFromHsa"
              id="exp-paidFromHsa"
              className="size-4 accent-primary"
            />
            <Label htmlFor="exp-paidFromHsa" className="text-sm">
              Paid from HSA
            </Label>
          </div>
          {financeAccounts.length > 0 && (
            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                id="exp-syncFinance"
                className="size-4 accent-primary"
                checked={syncToFinance}
                onChange={(e) => setSyncToFinance(e.target.checked)}
              />
              <Label htmlFor="exp-syncFinance" className="text-sm">
                Sync to Family Finance
              </Label>
            </div>
          )}
          {syncToFinance && (
            <>
              <div className="space-y-1">
                <Label htmlFor="exp-financeAccount">Finance Account</Label>
                <select
                  id="exp-financeAccount"
                  name="financeAccountId"
                  className={selectClass}
                  defaultValue={financeAccounts[0]?.id}
                  required
                >
                  {financeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-financeCategory">Finance Category</Label>
                <select
                  id="exp-financeCategory"
                  name="financeCategoryId"
                  className={selectClass}
                  defaultValue=""
                >
                  <option value="">No category</option>
                  {financeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Expense"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
          {warning && (
            <p className="text-sm text-orange-600 sm:col-span-2 lg:col-span-4">
              {warning}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteExpenseDialog({
  expense,
  onClose,
  onDeleted,
}: {
  expense: MedicalExpenseRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteMedicalExpenseFn({
        data: { id: expense.id },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete expense.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
          <AlertDialogDescription>
            “{expense.description}” ({formatCurrency(expense.amount)}) will be
            permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
