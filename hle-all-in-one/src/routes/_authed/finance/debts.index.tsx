import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArchiveRestore, Plus } from "lucide-react"
import {
  getDebtsPageFn,
  recordDebtPaymentFn,
  toggleDebtArchivedFn,
} from "@/server/finance/fns.debts"
import { DEBT_TYPE_LABELS } from "@/server/finance/debts"
import { DebtFormDialog } from "@/components/finance/debt-form"
import { formatCurrency, formatPercent } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

export const Route = createFileRoute("/_authed/finance/debts/")({
  loader: () => getDebtsPageFn(),
  component: DebtsPage,
})

function DebtsPage() {
  const { debts } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const activeDebts = debts.filter((d) => !d.isArchived)
  const archivedDebts = debts.filter((d) => d.isArchived)
  const totalDebt = activeDebts
    .filter((d) => d.includeInNetWorth)
    .reduce((sum, d) => sum + d.currentBalance, 0)

  function refresh() {
    router.invalidate()
  }

  async function onQuickPayment(
    e: React.FormEvent<HTMLFormElement>,
    debtId: string
  ) {
    e.preventDefault()
    setPaymentError(null)
    const form = e.currentTarget
    const f = new FormData(form)
    const num = (name: string) => Number(f.get(name) ?? 0) || 0
    try {
      const result = await recordDebtPaymentFn({
        data: {
          debtId,
          totalAmount: num("totalAmount"),
          principalAmount: num("principalAmount"),
          interestAmount: num("interestAmount"),
          escrowAmount: 0,
          extraPrincipal: 0,
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

  async function onRestore(id: string) {
    await toggleDebtArchivedFn({ data: { id, isArchived: false } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Debts</h1>
          <p className="text-sm text-muted-foreground">
            Total outstanding:{" "}
            <span className="font-medium text-red-600">
              {formatCurrency(totalDebt)}
            </span>
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add Debt
        </Button>
      </div>

      {paymentError && (
        <p className="text-sm text-destructive">{paymentError}</p>
      )}

      {activeDebts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No debts tracked. Add your first one to see payoff projections.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Add Debt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeDebts.map((debt) => {
            const paidPercent =
              debt.originalPrincipal > 0
                ? ((debt.originalPrincipal - debt.currentBalance) /
                    debt.originalPrincipal) *
                  100
                : 0

            return (
              <Card
                key={debt.id}
                className="transition-colors hover:bg-accent/30"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        <Link
                          to="/finance/debts/$id"
                          params={{ id: debt.id }}
                          className="hover:underline"
                        >
                          {debt.name}
                        </Link>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {DEBT_TYPE_LABELS[debt.type]}
                        {debt.lender && ` at ${debt.lender}`}
                        {debt.interestRate > 0 &&
                          ` · ${formatPercent(debt.interestRate * 100, 2)} APR`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Link
                        to="/finance/debts/$id"
                        params={{ id: debt.id }}
                        className="text-xl font-bold text-red-600 hover:underline"
                      >
                        {formatCurrency(debt.currentBalance)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        of {formatCurrency(debt.originalPrincipal)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatPercent(paidPercent)} paid off</span>
                      {debt.minimumPayment !== null && (
                        <span>
                          Min: {formatCurrency(debt.minimumPayment)}/mo
                        </span>
                      )}
                    </div>
                    <Progress value={Math.min(paidPercent, 100)} />
                  </div>

                  <form
                    onSubmit={(e) => onQuickPayment(e, debt.id)}
                    className="flex items-end gap-2"
                  >
                    <div className="flex-1 space-y-1">
                      <Label
                        className="text-xs"
                        htmlFor={`pay-total-${debt.id}`}
                      >
                        Payment Amount
                      </Label>
                      <Input
                        id={`pay-total-${debt.id}`}
                        name="totalAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label
                        className="text-xs"
                        htmlFor={`pay-principal-${debt.id}`}
                      >
                        Principal
                      </Label>
                      <Input
                        id={`pay-principal-${debt.id}`}
                        name="principalAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label
                        className="text-xs"
                        htmlFor={`pay-interest-${debt.id}`}
                      >
                        Interest
                      </Label>
                      <Input
                        id={`pay-interest-${debt.id}`}
                        name="interestAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button type="submit" size="sm" className="shrink-0">
                      Record
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {archivedDebts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Archived
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archivedDebts.map((debt) => (
              <Card key={debt.id} className="opacity-60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="truncate text-base">
                    <Link
                      to="/finance/debts/$id"
                      params={{ id: debt.id }}
                      className="hover:underline"
                    >
                      {debt.name}
                    </Link>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Restore"
                    onClick={() => onRestore(debt.id)}
                  >
                    <ArchiveRestore className="size-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium tabular-nums">
                    {formatCurrency(debt.currentBalance)}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    Archived
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {createOpen && (
        <DebtFormDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
