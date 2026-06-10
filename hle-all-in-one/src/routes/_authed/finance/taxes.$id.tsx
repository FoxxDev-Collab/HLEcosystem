import { useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, Check, DollarSign, Pencil, Trash2 } from "lucide-react"
import type { TaxFilingStatus, TaxYearRow } from "@/server/finance/taxes"
import { FILING_STATUSES, FILING_STATUS_LABELS } from "@/server/finance/taxes"
import {
  deleteTaxYearFn,
  getTaxYearDetailFn,
  markTaxFiledFn,
  toggleOwedPaidFn,
  toggleRefundReceivedFn,
  updateTaxRefundFn,
  updateTaxYearFn,
} from "@/server/finance/fns.taxes"
import { TaxDocumentsCard } from "@/components/finance/tax-documents-card"
import { formatCurrency, formatDate } from "@/lib/format"
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

export const Route = createFileRoute("/_authed/finance/taxes/$id")({
  loader: ({ params }) => getTaxYearDetailFn({ data: { id: params.id } }),
  component: TaxYearDetailPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function numOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim()
  return s ? Number(s) : null
}

function TaxYearDetailPage() {
  const { taxYear, documents } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!taxYear) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/taxes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Taxes
        </Link>
        <p className="text-sm text-muted-foreground">Tax year not found.</p>
      </div>
    )
  }

  function refresh() {
    router.invalidate()
  }

  const hasRefund =
    (taxYear.federalRefund ?? 0) > 0 || (taxYear.stateRefund ?? 0) > 0

  return (
    <div className="space-y-6">
      <Link
        to="/finance/taxes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Taxes
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Tax Year {taxYear.year}</h1>
          <p className="text-sm text-muted-foreground">
            {taxYear.federalFilingStatus
              ? FILING_STATUS_LABELS[taxYear.federalFilingStatus]
              : "No filing status"}
            {taxYear.state ? ` · ${taxYear.state}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" /> Delete Tax Year
        </Button>
      </div>

      <DetailsCard taxYear={taxYear} onSaved={refresh} />

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Gross Income" value={taxYear.totalGross} />
        <StatCard
          label="Federal Withheld"
          value={taxYear.totalFederalWithheld}
        />
        <StatCard label="State Withheld" value={taxYear.totalStateWithheld} />
        <StatCard
          label="SS Withheld"
          value={taxYear.totalSocialSecurityWithheld}
        />
        <StatCard
          label="Medicare Withheld"
          value={taxYear.totalMedicareWithheld}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filing Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Federal:</span>
            {taxYear.isFederalFiled ? (
              <Badge className="bg-green-100 text-green-800">
                Filed{" "}
                {taxYear.federalFiledDate &&
                  formatDate(taxYear.federalFiledDate)}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await markTaxFiledFn({
                    data: { id: taxYear.id, kind: "federal" },
                  })
                  refresh()
                }}
              >
                Mark Federal Filed
              </Button>
            )}
          </div>
          {taxYear.state && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                State ({taxYear.state}):
              </span>
              {taxYear.isStateFiled ? (
                <Badge className="bg-green-100 text-green-800">
                  Filed{" "}
                  {taxYear.stateFiledDate && formatDate(taxYear.stateFiledDate)}
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await markTaxFiledFn({
                      data: { id: taxYear.id, kind: "state" },
                    })
                    refresh()
                  }}
                >
                  Mark State Filed
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RefundCard taxYear={taxYear} hasRefund={hasRefund} onChanged={refresh} />

      <TaxDocumentsCard
        taxYearId={taxYear.id}
        documents={documents}
        onChanged={refresh}
      />

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete tax year {taxYear.year}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the tax year, all of its documents, and
                any uploaded files. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  deleteTaxYearFn({ data: { id: taxYear.id } }).then(() =>
                    navigate({ to: "/finance/taxes" })
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {formatCurrency(value)}
        </div>
      </CardContent>
    </Card>
  )
}

function DetailsCard({
  taxYear,
  onSaved,
}: {
  taxYear: TaxYearRow
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      await updateTaxYearFn({
        data: {
          id: taxYear.id,
          federalFilingStatus: String(
            f.get("federalFilingStatus") ?? ""
          ) as TaxFilingStatus,
          state: String(f.get("state") ?? ""),
          notes: String(f.get("notes") ?? ""),
        },
      })
      onSaved()
    } catch {
      setError("Could not update tax year.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tax Year Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid items-end gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="ty-filing-status">Filing Status</Label>
              <select
                id="ty-filing-status"
                name="federalFilingStatus"
                defaultValue={taxYear.federalFilingStatus ?? "SINGLE"}
                className={selectClass}
              >
                {FILING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {FILING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ty-state">State</Label>
              <Input
                id="ty-state"
                name="state"
                defaultValue={taxYear.state ?? ""}
                placeholder="e.g. AZ"
              />
            </div>
            <Button type="submit" disabled={pending} className="sm:self-end">
              <Pencil className="size-4" /> Update
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ty-notes">Notes</Label>
            <Textarea
              id="ty-notes"
              name="notes"
              defaultValue={taxYear.notes ?? ""}
              placeholder="Notes about this tax year..."
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

function RefundCard({
  taxYear,
  hasRefund,
  onChanged,
}: {
  taxYear: TaxYearRow
  hasRefund: boolean
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const hasOwed = (taxYear.federalOwed ?? 0) > 0 || (taxYear.stateOwed ?? 0) > 0

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      await updateTaxRefundFn({
        data: {
          id: taxYear.id,
          federalRefund: numOrNull(f.get("federalRefund")),
          stateRefund: numOrNull(f.get("stateRefund")),
          federalOwed: numOrNull(f.get("federalOwed")),
          stateOwed: numOrNull(f.get("stateOwed")),
        },
      })
      onChanged()
    } catch {
      setError("Could not save amounts.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="size-4" />
          Refund &amp; Amount Owed
        </CardTitle>
        <CardDescription>Track your tax return outcome</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="ty-federal-refund">Federal Refund</Label>
              <Input
                id="ty-federal-refund"
                name="federalRefund"
                type="number"
                step="0.01"
                min="0"
                defaultValue={taxYear.federalRefund ?? ""}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ty-state-refund">State Refund</Label>
              <Input
                id="ty-state-refund"
                name="stateRefund"
                type="number"
                step="0.01"
                min="0"
                defaultValue={taxYear.stateRefund ?? ""}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ty-federal-owed">Federal Owed</Label>
              <Input
                id="ty-federal-owed"
                name="federalOwed"
                type="number"
                step="0.01"
                min="0"
                defaultValue={taxYear.federalOwed ?? ""}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ty-state-owed">State Owed</Label>
              <Input
                id="ty-state-owed"
                name="stateOwed"
                type="number"
                step="0.01"
                min="0"
                defaultValue={taxYear.stateOwed ?? ""}
                placeholder="0.00"
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            Save Amounts
          </Button>
        </form>

        {(hasRefund || hasOwed) && (
          <div className="flex flex-wrap gap-3 border-t pt-3">
            {hasRefund && (
              <Button
                variant={taxYear.refundReceived ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  await toggleRefundReceivedFn({ data: { id: taxYear.id } })
                  onChanged()
                }}
              >
                {taxYear.refundReceived ? (
                  <>
                    <Check className="size-3.5" /> Refund Received{" "}
                    {taxYear.refundReceivedDate &&
                      `(${formatDate(taxYear.refundReceivedDate)})`}
                  </>
                ) : (
                  "Mark Refund Received"
                )}
              </Button>
            )}
            {(taxYear.federalOwed ?? 0) > 0 && (
              <Button
                variant={taxYear.federalOwedPaid ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  await toggleOwedPaidFn({
                    data: { id: taxYear.id, kind: "federal" },
                  })
                  onChanged()
                }}
              >
                {taxYear.federalOwedPaid ? (
                  <>
                    <Check className="size-3.5" /> Federal Paid
                  </>
                ) : (
                  "Mark Federal Paid"
                )}
              </Button>
            )}
            {(taxYear.stateOwed ?? 0) > 0 && (
              <Button
                variant={taxYear.stateOwedPaid ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  await toggleOwedPaidFn({
                    data: { id: taxYear.id, kind: "state" },
                  })
                  onChanged()
                }}
              >
                {taxYear.stateOwedPaid ? (
                  <>
                    <Check className="size-3.5" /> State Paid
                  </>
                ) : (
                  "Mark State Paid"
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
