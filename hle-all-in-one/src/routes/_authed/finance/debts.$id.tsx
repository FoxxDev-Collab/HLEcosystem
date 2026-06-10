import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Car,
  Home,
  Link2,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react"
import {
  deleteDebtFn,
  getDebtDetailFn,
  linkDebtPaymentTransactionFn,
  recordDebtPaymentFn,
  toggleDebtArchivedFn,
} from "@/server/finance/fns.debts"
import type { DebtPaymentRow } from "@/server/finance/debts"
import { DEBT_TYPE_LABELS } from "@/server/finance/debts"
import { calculateAmortization } from "@/lib/finance/amortization"
import { DebtFormDialog } from "@/components/finance/debt-form"
import { DebtRefinanceDialog } from "@/components/finance/debt-refinance-dialog"
import { DebtExtraPaymentCalc } from "@/components/finance/debt-extra-payment-calc"
import { TransactionLinkDialog } from "@/components/finance/debt-payment-link-dialog"
import { formatCurrency, formatDate, formatPercent } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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

export const Route = createFileRoute("/_authed/finance/debts/$id")({
  loader: ({ params }) => getDebtDetailFn({ data: { id: params.id } }),
  component: DebtDetailPage,
})

function DebtDetailPage() {
  const {
    debt,
    payments,
    linkedAssets,
    linkedBills,
    refinancedFrom,
    refinancedTo,
    linkableTransactions,
  } = Route.useLoaderData()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [refinanceOpen, setRefinanceOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<DebtPaymentRow | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!debt) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" render={<Link to="/finance/debts" />}>
          <ArrowLeft className="size-4" /> Debts
        </Button>
        <p className="text-muted-foreground">Debt not found.</p>
      </div>
    )
  }

  const balance = debt.currentBalance
  const rate = debt.interestRate
  const minPayment = debt.minimumPayment ?? 0
  const paidPercent =
    debt.originalPrincipal > 0
      ? ((debt.originalPrincipal - balance) / debt.originalPrincipal) * 100
      : 0
  const projection =
    rate > 0 && minPayment > 0
      ? calculateAmortization(balance, rate, minPayment)
      : null

  function refresh() {
    router.invalidate()
  }

  async function onRecordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!debt) return
    setPaymentError(null)
    const form = e.currentTarget
    const f = new FormData(form)
    const num = (name: string) => Number(f.get(name) ?? 0) || 0
    try {
      const result = await recordDebtPaymentFn({
        data: {
          debtId: debt.id,
          totalAmount: num("totalAmount"),
          principalAmount: num("principalAmount"),
          interestAmount: num("interestAmount"),
          escrowAmount: num("escrowAmount"),
          extraPrincipal: num("extraPrincipal"),
          linkedTransactionId: null,
          notes: "",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setPaymentError(result.error)
        return
      }
      form.reset()
      refresh()
    } catch {
      setPaymentError("Could not record payment.")
    }
  }

  async function onLinkTransaction(transactionId: string) {
    if (!linkTarget) return
    setLinkError(null)
    try {
      const result = await linkDebtPaymentTransactionFn({
        data: { paymentId: linkTarget.id, transactionId },
      })
      if ("error" in result && typeof result.error === "string") {
        setLinkError(result.error)
        return
      }
      setLinkTarget(null)
      refresh()
    } catch {
      setLinkError("Could not link transaction.")
    }
  }

  async function onToggleArchived() {
    if (!debt) return
    await toggleDebtArchivedFn({
      data: { id: debt.id, isArchived: !debt.isArchived },
    })
    refresh()
  }

  async function onDelete() {
    if (!debt) return
    setPending(true)
    try {
      const result = await deleteDebtFn({ data: { id: debt.id } })
      if ("error" in result && typeof result.error === "string") {
        setPending(false)
        return
      }
      navigate({ to: "/finance/debts" })
    } catch {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          render={<Link to="/finance/debts" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{debt.name}</h1>
          <p className="text-sm text-muted-foreground">
            {DEBT_TYPE_LABELS[debt.type]}
            {debt.lender && ` at ${debt.lender}`}
            {debt.isArchived && (
              <Badge variant="secondary" className="ml-2">
                Archived
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefinanceOpen(true)}
          >
            <RefreshCw className="size-4" /> Refinance
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleArchived}>
            {debt.isArchived ? (
              <>
                <ArchiveRestore className="size-4" /> Restore
              </>
            ) : (
              <>
                <Archive className="size-4" /> Archive
              </>
            )}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Original Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(debt.originalPrincipal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Interest Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(rate * 100, 2)} APR
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Min Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {minPayment > 0 ? formatCurrency(minPayment) : "—"}/mo
            </div>
          </CardContent>
        </Card>
      </div>

      {(refinancedFrom || refinancedTo) && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-600"
              >
                Refinance
              </Badge>
              {refinancedFrom && (
                <span className="text-muted-foreground">
                  Refinanced from{" "}
                  <Link
                    to="/finance/debts/$id"
                    params={{ id: refinancedFrom.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {refinancedFrom.name}
                  </Link>
                </span>
              )}
              {refinancedTo && (
                <span className="text-muted-foreground">
                  Refinanced to{" "}
                  <Link
                    to="/finance/debts/$id"
                    params={{ id: refinancedTo.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {refinancedTo.name}
                  </Link>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {linkedAssets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Link2 className="size-4" /> Linked Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {linkedAssets.map((asset) => (
                <Link
                  key={asset.id}
                  to="/finance/assets/$id"
                  params={{ id: asset.id }}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex size-8 items-center justify-center rounded bg-primary/10">
                    {asset.type === "REAL_ESTATE" ? (
                      <Home className="size-4 text-primary" />
                    ) : asset.type === "VEHICLE" ? (
                      <Car className="size-4 text-primary" />
                    ) : (
                      <Link2 className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {asset.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Value: {formatCurrency(asset.currentValue)} · Equity:{" "}
                      <span
                        className={
                          asset.currentValue - balance >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {formatCurrency(asset.currentValue - balance)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {linkedBills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Link2 className="size-4" /> Linked Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {linkedBills.map((bill) => (
                <Badge key={bill.id} variant="outline">
                  {bill.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payoff Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{formatPercent(paidPercent)} paid off</span>
            <span>
              {formatCurrency(debt.originalPrincipal - balance)} of{" "}
              {formatCurrency(debt.originalPrincipal)}
            </span>
          </div>
          <Progress value={Math.min(paidPercent, 100)} />
        </CardContent>
      </Card>

      {projection && (
        <Card>
          <CardHeader>
            <CardTitle>Payoff Projection</CardTitle>
            <CardDescription>
              At current minimum payment of {formatCurrency(minPayment)}/mo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">
                  {projection.monthsRemaining}
                </div>
                <div className="text-xs text-muted-foreground">
                  Months remaining
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">
                  {Math.floor(projection.monthsRemaining / 12)}y{" "}
                  {projection.monthsRemaining % 12}m
                </div>
                <div className="text-xs text-muted-foreground">
                  Time to payoff
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(projection.totalInterest)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total interest
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">
                  {formatCurrency(projection.totalPayments)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total payments
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Estimated payoff:{" "}
              <strong>
                {projection.payoffDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </div>
          </CardContent>
        </Card>
      )}

      {rate > 0 && minPayment > 0 && (
        <DebtExtraPaymentCalc
          balance={balance}
          annualRate={rate}
          monthlyPayment={minPayment}
        />
      )}

      {projection && projection.schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Amortization Schedule</CardTitle>
            <CardDescription>
              Showing first {Math.min(24, projection.schedule.length)} of{" "}
              {projection.schedule.length} months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-4 text-left">Month</th>
                    <th className="px-4 py-2 text-right">Payment</th>
                    <th className="px-4 py-2 text-right">Principal</th>
                    <th className="px-4 py-2 text-right">Interest</th>
                    <th className="py-2 pl-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.schedule.slice(0, 24).map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.month}</td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(row.payment)}
                      </td>
                      <td className="px-4 py-2 text-right text-green-600">
                        {formatCurrency(row.principal)}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {formatCurrency(row.interest)}
                      </td>
                      <td className="py-2 pl-4 text-right font-medium">
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
          <CardDescription>
            Split between principal, interest, escrow, and extra principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onRecordPayment}
            className="grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-6"
          >
            <div className="space-y-1">
              <Label htmlFor="rp-total">Total Amount</Label>
              <Input
                id="rp-total"
                name="totalAmount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={minPayment || ""}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-principal">Principal</Label>
              <Input
                id="rp-principal"
                name="principalAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-interest">Interest</Label>
              <Input
                id="rp-interest"
                name="interestAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-escrow">Escrow</Label>
              <Input
                id="rp-escrow"
                name="escrowAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-extra">Extra Principal</Label>
              <Input
                id="rp-extra"
                name="extraPrincipal"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <Button type="submit">Record Payment</Button>
          </form>
          {paymentError && (
            <p className="mt-2 text-sm text-destructive">{paymentError}</p>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              {payments.length} payment{payments.length !== 1 ? "s" : ""}{" "}
              recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatDate(p.paymentDate)}
                      </span>
                      {p.linkedTransactionId ? (
                        <Badge
                          variant="outline"
                          className="border-green-300 text-xs text-green-600"
                        >
                          <Link2 className="size-3" />
                          {p.linkedTransactionPayee ||
                            p.linkedTransactionDescription ||
                            "Linked"}
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setLinkError(null)
                            setLinkTarget(p)
                          }}
                        >
                          <Link2 className="size-3" /> Link
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Principal: {formatCurrency(p.principalAmount)} · Interest:{" "}
                      {formatCurrency(p.interestAmount)}
                      {p.escrowAmount > 0 && (
                        <> · Escrow: {formatCurrency(p.escrowAmount)}</>
                      )}
                      {p.extraPrincipal > 0 && (
                        <> · Extra: {formatCurrency(p.extraPrincipal)}</>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium">
                      {formatCurrency(p.totalAmount)}
                    </div>
                    {p.remainingBalance !== null && (
                      <div className="text-xs text-muted-foreground">
                        Bal: {formatCurrency(p.remainingBalance)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editOpen && (
        <DebtFormDialog
          debt={debt}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            refresh()
          }}
        />
      )}

      {refinanceOpen && (
        <DebtRefinanceDialog
          debt={debt}
          linkedAssetCount={linkedAssets.length}
          linkedBillCount={linkedBills.length}
          onClose={() => setRefinanceOpen(false)}
          onRefinanced={(newDebtId) => {
            setRefinanceOpen(false)
            navigate({ to: "/finance/debts/$id", params: { id: newDebtId } })
          }}
        />
      )}

      {linkTarget && (
        <TransactionLinkDialog
          amount={linkTarget.totalAmount}
          transactions={linkableTransactions}
          error={linkError}
          onLink={onLinkTransaction}
          onClose={() => setLinkTarget(null)}
        />
      )}

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{debt.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the debt and all {debt.paymentCount}{" "}
                recorded payment
                {debt.paymentCount !== 1 ? "s" : ""}. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
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
