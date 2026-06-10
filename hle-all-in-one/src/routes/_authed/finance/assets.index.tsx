import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { ArchiveRestore, Link2, Plus, RefreshCw } from "lucide-react"
import {
  getAssetsPageFn,
  toggleAssetArchivedFn,
  updateAssetValueFn,
} from "@/server/finance/fns.assets"
import { ASSET_TYPE_LABELS } from "@/server/finance/assets"
import { AssetFormDialog } from "@/components/finance/asset-form"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/_authed/finance/assets/")({
  loader: () => getAssetsPageFn(),
  component: AssetsPage,
})

function AssetsPage() {
  const { assets, debts } = Route.useLoaderData()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [valueError, setValueError] = useState<string | null>(null)

  const activeAssets = assets.filter((a) => !a.isArchived)
  const archivedAssets = assets.filter((a) => a.isArchived)
  const totalValue = activeAssets
    .filter((a) => a.includeInNetWorth)
    .reduce((sum, a) => sum + a.currentValue, 0)

  function refresh() {
    router.invalidate()
  }

  async function onUpdateValue(
    e: React.FormEvent<HTMLFormElement>,
    assetId: string
  ) {
    e.preventDefault()
    setValueError(null)
    const form = e.currentTarget
    const value = Number(new FormData(form).get("currentValue") ?? "")
    if (!Number.isFinite(value) || value < 0) return
    try {
      const result = await updateAssetValueFn({
        data: { id: assetId, currentValue: value },
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

  async function onRestore(id: string) {
    await toggleAssetArchivedFn({ data: { id, isArchived: false } })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Total value: {formatCurrency(totalValue)}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Add Asset
        </Button>
      </div>

      {valueError && <p className="text-sm text-destructive">{valueError}</p>}

      {activeAssets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              No assets tracked yet. Add your home, vehicles, and investments to
              see your net worth.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Add Asset
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeAssets.map((asset) => {
            const gainLoss =
              asset.purchasePrice !== null
                ? asset.currentValue - asset.purchasePrice
                : null
            const equity =
              asset.linkedDebtBalance !== null
                ? asset.currentValue - asset.linkedDebtBalance
                : null

            return (
              <Card
                key={asset.id}
                className="group transition-colors hover:bg-accent/30"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link to="/finance/assets/$id" params={{ id: asset.id }}>
                      <CardTitle className="cursor-pointer text-base hover:underline">
                        {asset.name}
                      </CardTitle>
                    </Link>
                    <div className="flex min-w-0 items-center gap-1.5">
                      {asset.linkedDebtName && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Link2 className="size-3" />
                          <span className="max-w-24 truncate">
                            {asset.linkedDebtName}
                          </span>
                        </Badge>
                      )}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {ASSET_TYPE_LABELS[asset.type]}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold tabular-nums">
                    {formatCurrency(asset.currentValue)}
                  </div>
                  {asset.purchasePrice !== null && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Purchased for {formatCurrency(asset.purchasePrice)}
                      {gainLoss !== null && gainLoss !== 0 && (
                        <span
                          className={
                            gainLoss > 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {" "}
                          ({gainLoss > 0 ? "+" : ""}
                          {formatCurrency(gainLoss)})
                        </span>
                      )}
                    </div>
                  )}
                  {equity !== null && (
                    <div className="mt-1 text-xs">
                      <span className="text-muted-foreground">Equity: </span>
                      <span
                        className={
                          equity >= 0
                            ? "font-medium text-green-600"
                            : "font-medium text-red-600"
                        }
                      >
                        {formatCurrency(equity)}
                      </span>
                    </div>
                  )}
                  {asset.valueAsOfDate && (
                    <div className="text-xs text-muted-foreground">
                      Updated: {formatDate(asset.valueAsOfDate)}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => onUpdateValue(e, asset.id)}
                    className="mt-3 flex gap-2"
                  >
                    <Input
                      name="currentValue"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="New value"
                      className="h-8 text-sm"
                      required
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      <RefreshCw className="size-3.5" /> Update
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {archivedAssets.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Archived &amp; Sold
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {archivedAssets.map((asset) => (
              <Card key={asset.id} className="opacity-60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Link to="/finance/assets/$id" params={{ id: asset.id }}>
                    <CardTitle className="truncate text-base hover:underline">
                      {asset.name}
                    </CardTitle>
                  </Link>
                  {!asset.isSold && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Restore"
                      onClick={() => onRestore(asset.id)}
                    >
                      <ArchiveRestore className="size-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium tabular-nums">
                    {asset.isSold && asset.soldPrice !== null
                      ? formatCurrency(asset.soldPrice)
                      : formatCurrency(asset.currentValue)}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    {asset.isSold
                      ? `Sold ${asset.soldDate ? formatDate(asset.soldDate) : ""}`
                      : "Archived"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {createOpen && (
        <AssetFormDialog
          debts={debts}
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
