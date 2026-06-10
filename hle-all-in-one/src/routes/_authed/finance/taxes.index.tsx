import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowRight, FileText, Plus, Receipt } from "lucide-react"
import type { TaxFilingStatus, TaxYearRow } from "@/server/finance/taxes"
import { FILING_STATUSES, FILING_STATUS_LABELS } from "@/lib/finance-constants"
import { createTaxYearFn, getTaxYearsPageFn } from "@/server/finance/fns.taxes"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_authed/finance/taxes/")({
  loader: () => getTaxYearsPageFn(),
  component: TaxesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function hasRefund(ty: TaxYearRow): boolean {
  return (ty.federalRefund ?? 0) > 0 || (ty.stateRefund ?? 0) > 0
}

function hasResult(ty: TaxYearRow): boolean {
  return hasRefund(ty) || (ty.federalOwed ?? 0) > 0 || (ty.stateOwed ?? 0) > 0
}

function netClass(value: number): string {
  return value >= 0 ? "text-green-600" : "text-red-600"
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value)}`
}

function TaxesPage() {
  const { taxYears } = Route.useLoaderData()
  const router = useRouter()

  const yearsWithResults = taxYears.filter(hasResult)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tax Tracking</h1>
        <p className="text-sm text-muted-foreground">
          {taxYears.length} tax year{taxYears.length !== 1 ? "s" : ""}
        </p>
      </div>

      <AddTaxYearCard onAdded={() => router.invalidate()} />

      {yearsWithResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" />
              Refund &amp; Owed History
            </CardTitle>
            <CardDescription>Tax outcomes by year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-muted-foreground">
                      Year
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Federal
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      State
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Net
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {yearsWithResults.map((ty) => {
                    const fedNet =
                      (ty.federalRefund ?? 0) - (ty.federalOwed ?? 0)
                    const stateNet = (ty.stateRefund ?? 0) - (ty.stateOwed ?? 0)
                    const totalNet = fedNet + stateNet
                    return (
                      <tr key={ty.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            to="/finance/taxes/$id"
                            params={{ id: ty.id }}
                            className="font-medium hover:underline"
                          >
                            {ty.year}
                          </Link>
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums ${netClass(fedNet)}`}
                        >
                          {signed(fedNet)}
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums ${netClass(stateNet)}`}
                        >
                          {signed(stateNet)}
                        </td>
                        <td
                          className={`py-2 text-right font-medium tabular-nums ${netClass(totalNet)}`}
                        >
                          {signed(totalNet)}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {hasRefund(ty) && ty.refundReceived && (
                              <Badge
                                variant="outline"
                                className="border-green-300 text-xs text-green-700"
                              >
                                Received
                              </Badge>
                            )}
                            {hasRefund(ty) && !ty.refundReceived && (
                              <Badge
                                variant="outline"
                                className="border-yellow-300 text-xs text-yellow-700"
                              >
                                Pending
                              </Badge>
                            )}
                            {ty.federalOwedPaid && (
                              <Badge
                                variant="outline"
                                className="border-green-300 text-xs text-green-700"
                              >
                                Fed Paid
                              </Badge>
                            )}
                            {ty.stateOwedPaid && (
                              <Badge
                                variant="outline"
                                className="border-green-300 text-xs text-green-700"
                              >
                                State Paid
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {taxYears.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No tax years yet. Add one above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        taxYears.map((ty) => (
          <Link
            key={ty.id}
            to="/finance/taxes/$id"
            params={{ id: ty.id }}
            className="block"
          >
            <Card className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Tax Year {ty.year}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {ty.federalFilingStatus
                        ? FILING_STATUS_LABELS[ty.federalFilingStatus]
                        : "No filing status"}
                      {ty.state ? ` · ${ty.state}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ty.isFederalFiled && (
                      <Badge className="bg-green-100 text-xs text-green-800">
                        Federal Filed
                      </Badge>
                    )}
                    {ty.state && ty.isStateFiled && (
                      <Badge className="bg-green-100 text-xs text-green-800">
                        State Filed
                      </Badge>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Gross Income:</span>{" "}
                    <span className="font-medium">
                      {formatCurrency(ty.totalGross)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Federal Withheld:
                    </span>{" "}
                    <span className="font-medium">
                      {formatCurrency(ty.totalFederalWithheld)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      State Withheld:
                    </span>{" "}
                    <span className="font-medium">
                      {formatCurrency(ty.totalStateWithheld)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Documents:</span>{" "}
                    <span className="font-medium">
                      {ty.receivedCount}/{ty.documentCount} received
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  )
}

function AddTaxYearCard({ onAdded }: { onAdded: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createTaxYearFn({
        data: {
          year: Number(f.get("year")),
          federalFilingStatus: String(
            f.get("federalFilingStatus") ?? ""
          ) as TaxFilingStatus,
          state: String(f.get("state") ?? ""),
        },
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      form.reset()
      onAdded()
    } catch {
      setError("Could not add tax year.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add Tax Year</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="tax-year">Year</Label>
            <Input
              id="tax-year"
              name="year"
              type="number"
              defaultValue={new Date().getFullYear() - 1}
              className="w-24"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax-filing-status">Filing Status</Label>
            <select
              id="tax-filing-status"
              name="federalFilingStatus"
              defaultValue="MARRIED_FILING_JOINTLY"
              className={`${selectClass} w-56`}
            >
              {FILING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FILING_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tax-state">State</Label>
            <Input
              id="tax-state"
              name="state"
              placeholder="e.g. AZ"
              className="w-20"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" /> Add Year
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
