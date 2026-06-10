import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Car,
  DollarSign,
  Home,
  Link2,
  Pencil,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  deleteAssetFn,
  getAssetDetailFn,
  toggleAssetArchivedFn,
  updateAssetValueFn,
} from "@/server/finance/fns.assets"
import { ASSET_TYPE_LABELS } from "@/lib/finance-constants"
import { AssetFormDialog } from "@/components/finance/asset-form"
import { AssetSoldDialog } from "@/components/finance/asset-sold-dialog"
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

export const Route = createFileRoute("/_authed/finance/assets/$id")({
  loader: ({ params }) => getAssetDetailFn({ data: { id: params.id } }),
  component: AssetDetailPage,
})

function AssetDetailPage() {
  const { asset, valueHistory, debts } = Route.useLoaderData()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [soldOpen, setSoldOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [valueError, setValueError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!asset) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" render={<Link to="/finance/assets" />}>
          <ArrowLeft className="size-4" /> Assets
        </Button>
        <p className="text-muted-foreground">Asset not found.</p>
      </div>
    )
  }

  const currentValue = asset.currentValue
  const purchasePrice = asset.purchasePrice
  const gainLoss = purchasePrice !== null ? currentValue - purchasePrice : null
  const gainLossPercent =
    purchasePrice !== null && purchasePrice > 0 && gainLoss !== null
      ? (gainLoss / purchasePrice) * 100
      : null
  const equity =
    asset.linkedDebtBalance !== null
      ? currentValue - asset.linkedDebtBalance
      : null
  const historyMax = Math.max(...valueHistory.map((h) => h.value), 1)

  function refresh() {
    router.invalidate()
  }

  async function onUpdateValue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!asset) return
    setValueError(null)
    const form = e.currentTarget
    const value = Number(new FormData(form).get("currentValue") ?? "")
    if (!Number.isFinite(value) || value < 0) return
    try {
      const result = await updateAssetValueFn({
        data: { id: asset.id, currentValue: value },
      })
      if ("error" in result && typeof result.error === "string") {
        setValueError(result.error)
        return
      }
      form.reset()
      refresh()
    } catch {
      setValueError("Could not update value.")
    }
  }

  async function onToggleArchived() {
    if (!asset) return
    await toggleAssetArchivedFn({
      data: { id: asset.id, isArchived: !asset.isArchived },
    })
    refresh()
  }

  async function onDelete() {
    if (!asset) return
    setPending(true)
    try {
      const result = await deleteAssetFn({ data: { id: asset.id } })
      if ("error" in result && typeof result.error === "string") {
        setPending(false)
        return
      }
      navigate({ to: "/finance/assets" })
    } catch {
      setPending(false)
    }
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <Link
        to="/finance/assets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Assets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            {asset.type === "REAL_ESTATE" ? (
              <Home className="size-5 text-primary" />
            ) : asset.type === "VEHICLE" ? (
              <Car className="size-5 text-primary" />
            ) : (
              <TrendingUp className="size-5 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ASSET_TYPE_LABELS[asset.type]}
              {asset.isSold && (
                <Badge
                  variant="outline"
                  className="ml-2 border-amber-300 text-amber-600"
                >
                  Sold
                </Badge>
              )}
              {!asset.isSold && asset.isArchived && (
                <Badge variant="secondary" className="ml-2">
                  Archived
                </Badge>
              )}
            </p>
          </div>
        </div>
        {!asset.isSold && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
              onClick={() => setSoldOpen(true)}
            >
              <DollarSign className="size-4" /> Mark as Sold
            </Button>
            <Button variant="outline" size="sm" onClick={onToggleArchived}>
              {asset.isArchived ? (
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
        )}
      </div>

      <div
        className={`grid gap-4 ${
          equity !== null
            ? "md:grid-cols-2 lg:grid-cols-4"
            : "md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentValue)}
            </div>
            {asset.valueAsOfDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                as of {formatDate(asset.valueAsOfDate)}
              </p>
            )}
          </CardContent>
        </Card>
        {purchasePrice !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Purchase Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(purchasePrice)}
              </div>
              {asset.purchaseDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(asset.purchaseDate)}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {gainLoss !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Gain / Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`flex items-center gap-1 text-2xl font-bold ${
                  gainLoss >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {gainLoss >= 0 ? (
                  <TrendingUp className="size-5" />
                ) : (
                  <TrendingDown className="size-5" />
                )}
                {gainLoss >= 0 ? "+" : ""}
                {formatCurrency(gainLoss)}
              </div>
              {gainLossPercent !== null && (
                <p
                  className={`mt-1 text-xs ${
                    gainLoss >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {gainLoss >= 0 ? "+" : ""}
                  {formatPercent(gainLossPercent)}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {equity !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  equity >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(equity)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Value minus {asset.linkedDebtName}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {asset.type === "REAL_ESTATE" &&
            (asset.address || asset.squareFootage || asset.yearBuilt) && (
              <Card>
                <CardHeader>
                  <CardTitle>Property Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {asset.address && (
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Address
                        </div>
                        <div className="text-sm font-medium">
                          {asset.address}
                          {asset.city && `, ${asset.city}`}
                          {asset.state && `, ${asset.state}`}
                          {asset.zipCode && ` ${asset.zipCode}`}
                        </div>
                      </div>
                    )}
                    {asset.squareFootage !== null && (
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Square Footage
                        </div>
                        <div className="text-sm font-medium">
                          {asset.squareFootage.toLocaleString()} sq ft
                        </div>
                      </div>
                    )}
                    {asset.yearBuilt !== null && (
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Year Built
                        </div>
                        <div className="text-sm font-medium">
                          {asset.yearBuilt}
                        </div>
                      </div>
                    )}
                    {asset.propertyTaxAnnual !== null && (
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Annual Property Tax
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(asset.propertyTaxAnnual)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {asset.type === "VEHICLE" && (asset.make || asset.vin) && (
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(asset.make || asset.model) && (
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Make / Model
                      </div>
                      <div className="text-sm font-medium">
                        {[asset.vehicleYear, asset.make, asset.model]
                          .filter(Boolean)
                          .join(" ")}
                      </div>
                    </div>
                  )}
                  {asset.vin && (
                    <div>
                      <div className="text-xs text-muted-foreground">VIN</div>
                      <div className="font-mono text-sm font-medium">
                        {asset.vin}
                      </div>
                    </div>
                  )}
                  {asset.mileage !== null && (
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Mileage
                      </div>
                      <div className="text-sm font-medium">
                        {asset.mileage.toLocaleString()} mi
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Value History</CardTitle>
              <CardDescription>
                {valueHistory.length} entr
                {valueHistory.length === 1 ? "y" : "ies"} recorded
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!asset.isSold && (
                <form onSubmit={onUpdateValue} className="flex gap-2">
                  <Input
                    name="currentValue"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="New value"
                    className="max-w-[200px]"
                    required
                  />
                  <Button type="submit" variant="outline" size="sm">
                    <RefreshCw className="size-3.5" /> Update Value
                  </Button>
                </form>
              )}
              {valueError && (
                <p className="text-sm text-destructive">{valueError}</p>
              )}

              {valueHistory.length > 0 ? (
                <div className="divide-y">
                  {valueHistory.map((entry, i) => {
                    const prev = valueHistory[i + 1]
                    const change = prev ? entry.value - prev.value : null
                    return (
                      <div key={entry.id} className="space-y-1 py-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {formatDate(entry.date)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.source === "sold"
                                ? "Sold"
                                : entry.source === "manual"
                                  ? "Manual update"
                                  : entry.source || "Update"}
                              {entry.notes && ` — ${entry.notes}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium tabular-nums">
                              {formatCurrency(entry.value)}
                            </div>
                            {change !== null && change !== 0 && (
                              <div
                                className={`text-xs ${
                                  change > 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {change > 0 ? "+" : ""}
                                {formatCurrency(change)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{
                              width: `${Math.max((entry.value / historyMax) * 100, 2)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No value history recorded.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Link2 className="size-4" /> Linked Debt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.linkedDebtId && asset.linkedDebtBalance !== null ? (
                <div>
                  <Link
                    to="/finance/debts/$id"
                    params={{ id: asset.linkedDebtId }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {asset.linkedDebtName}
                  </Link>
                  <div className="mt-1 text-lg font-bold text-red-600">
                    {formatCurrency(asset.linkedDebtBalance)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    remaining balance
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Equity</span>
                    <span
                      className={`font-medium ${
                        equity !== null && equity >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {equity !== null ? formatCurrency(equity) : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No debt linked. Edit this asset to link a mortgage or loan.
                </p>
              )}
            </CardContent>
          </Card>

          {asset.isSold && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sale Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sale Price</span>
                    <span className="font-medium">
                      {formatCurrency(asset.soldPrice ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sale Date</span>
                    <span className="font-medium">
                      {formatDate(asset.soldDate)}
                    </span>
                  </div>
                  {purchasePrice !== null && asset.soldPrice !== null && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Purchase Price
                        </span>
                        <span className="font-medium">
                          {formatCurrency(purchasePrice)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Net Gain/Loss
                        </span>
                        <span
                          className={`font-medium ${
                            asset.soldPrice - purchasePrice >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(asset.soldPrice - purchasePrice)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {asset.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {asset.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editOpen && (
        <AssetFormDialog
          asset={asset}
          debts={debts}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            refresh()
          }}
        />
      )}

      {soldOpen && (
        <AssetSoldDialog
          asset={asset}
          onClose={() => setSoldOpen(false)}
          onSold={() => {
            setSoldOpen(false)
            refresh()
          }}
        />
      )}

      {deleteOpen && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleteOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{asset.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the asset and all its value history.
                This cannot be undone.
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
