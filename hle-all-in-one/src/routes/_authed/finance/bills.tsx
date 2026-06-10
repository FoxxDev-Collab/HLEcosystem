import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react"
import {
  deleteBillFn,
  getBillsPageFn,
  toggleBillActiveFn,
} from "@/server/finance/fns.bills"
import type { BillRow } from "@/server/finance/bills"
import {
  BillFormDialog,
  billCategoryLabel,
} from "@/components/finance/bill-form"
import { BillMarkPaidDialog } from "@/components/finance/bill-mark-paid-dialog"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

export const Route = createFileRoute("/_authed/finance/bills")({
  loader: () => getBillsPageFn(),
  component: BillsPage,
})

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function isPaidThisMonth(bill: BillRow): boolean {
  return bill.currentPaymentStatus === "PAID"
}

function BillsPage() {
  const { bills, accounts, categories, debts, linkableTransactions } =
    Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BillRow | null>(null)
  const [payTarget, setPayTarget] = useState<BillRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillRow | null>(null)
  const [pending, setPending] = useState(false)

  const activeBills = bills.filter((b) => b.isActive)
  const totalMonthly = activeBills.reduce((sum, b) => sum + b.expectedAmount, 0)

  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay()

  const billsByDay = new Map<number, Array<BillRow>>()
  for (const bill of activeBills) {
    const day = Math.min(bill.dueDayOfMonth, daysInMonth)
    const existing = billsByDay.get(day) ?? []
    existing.push(bill)
    billsByDay.set(day, existing)
  }

  function refresh() {
    router.invalidate()
  }

  async function onToggleActive(bill: BillRow) {
    await toggleBillActiveFn({
      data: { id: bill.id, isActive: !bill.isActive },
    })
    refresh()
  }

  async function onDelete() {
    if (!deleteTarget) return
    setPending(true)
    try {
      await deleteBillFn({ data: { id: deleteTarget.id } })
      setDeleteTarget(null)
      refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Monthly Bills</h1>
          <p className="text-sm text-muted-foreground">
            {activeBills.length} active bill
            {activeBills.length !== 1 ? "s" : ""} ·{" "}
            {formatCurrency(totalMonthly)}/month
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add Bill
        </Button>
      </div>

      {activeBills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {today.toLocaleString("en-US", {
                month: "long",
                year: "numeric",
              })}{" "}
              Calendar
            </CardTitle>
            <CardDescription>Bills due this month at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-muted">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="bg-background py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-[60px] bg-background"
                />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dayBills = billsByDay.get(day) ?? []
                const isToday = day === currentDay
                const isPast = day < currentDay

                return (
                  <div
                    key={day}
                    className={`min-h-[60px] bg-background p-1 ${
                      isToday ? "ring-2 ring-blue-500 ring-inset" : ""
                    }`}
                  >
                    <div
                      className={`mb-0.5 text-xs font-medium ${
                        isToday
                          ? "text-blue-600"
                          : isPast
                            ? "text-muted-foreground"
                            : ""
                      }`}
                    >
                      {day}
                    </div>
                    {dayBills.map((bill) => {
                      const paid = isPaidThisMonth(bill)
                      return (
                        <div
                          key={bill.id}
                          className={`mb-0.5 truncate rounded px-0.5 text-[10px] leading-tight ${
                            paid
                              ? "bg-green-100 text-green-700 line-through dark:bg-green-950 dark:text-green-400"
                              : isPast
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                          }`}
                          title={`${bill.name}: ${formatCurrency(bill.expectedAmount)}`}
                        >
                          {bill.name}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {bills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No bills tracked yet. Add recurring bills to see them on the
              calendar.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Add Bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const paid = isPaidThisMonth(bill)
            const isDueSoon =
              bill.isActive &&
              !paid &&
              bill.dueDayOfMonth - currentDay <= 5 &&
              bill.dueDayOfMonth - currentDay >= 0
            const isOverdue =
              bill.isActive && !paid && bill.dueDayOfMonth < currentDay

            return (
              <Card
                key={bill.id}
                className={!bill.isActive ? "opacity-50" : ""}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{bill.name}</span>
                      {bill.autoPay && (
                        <Badge variant="outline" className="text-xs">
                          Auto-pay
                          {bill.autoPayAccountName &&
                            ` · ${bill.autoPayAccountName}`}
                        </Badge>
                      )}
                      {bill.linkedDebtName && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Link2 className="size-3" /> {bill.linkedDebtName}
                        </Badge>
                      )}
                      {paid && (
                        <Badge className="bg-green-100 text-xs text-green-800 dark:bg-green-950 dark:text-green-400">
                          Paid
                        </Badge>
                      )}
                      {isDueSoon && (
                        <Badge className="bg-yellow-100 text-xs text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400">
                          Due soon
                        </Badge>
                      )}
                      {isOverdue && (
                        <Badge className="bg-red-100 text-xs text-red-800 dark:bg-red-950 dark:text-red-400">
                          Overdue
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Due: {bill.dueDayOfMonth}
                      {getOrdinal(bill.dueDayOfMonth)} ·{" "}
                      {billCategoryLabel(bill.category)}
                      {bill.defaultCategoryName &&
                        ` · ${bill.defaultCategoryName}`}
                      {bill.websiteUrl && (
                        <a
                          href={bill.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-blue-500"
                        >
                          <ExternalLink className="size-3" /> Pay
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(bill.expectedAmount)}
                      {bill.isVariableAmount && (
                        <span className="text-muted-foreground"> ~</span>
                      )}
                    </span>
                    {bill.isActive && !paid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayTarget(bill)}
                      >
                        <CheckCircle2 className="size-3.5" /> Paid
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit"
                      onClick={() => setEditTarget(bill)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={bill.isActive ? "Pause" : "Resume"}
                      onClick={() => onToggleActive(bill)}
                    >
                      {bill.isActive ? (
                        <Pause className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteTarget(bill)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {createOpen && (
        <BillFormDialog
          accounts={accounts}
          categories={categories}
          debts={debts}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}

      {editTarget && (
        <BillFormDialog
          bill={editTarget}
          accounts={accounts}
          categories={categories}
          debts={debts}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            refresh()
          }}
        />
      )}

      {payTarget && (
        <BillMarkPaidDialog
          bill={payTarget}
          transactions={linkableTransactions}
          onClose={() => setPayTarget(null)}
          onSaved={() => {
            setPayTarget(null)
            refresh()
          }}
        />
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the bill and its payment history. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  onDelete()
                }}
                disabled={pending}
              >
                {pending ? "Deleting…" : "Delete Permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
