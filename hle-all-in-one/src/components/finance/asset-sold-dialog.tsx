// Mark-asset-sold dialog (legacy AssetSoldDialog): records sale price/date,
// archives the asset, shows the live equity calculation, and optionally
// archives the linked debt.
import { useState } from "react"
import { markAssetSoldFn } from "@/server/finance/fns.assets"
import type { AssetRow } from "@/server/finance/assets"
import { formatCurrency, toDateInputValue } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function AssetSoldDialog({
  asset,
  onClose,
  onSold,
}: {
  asset: AssetRow
  onClose: () => void
  onSold: () => void
}) {
  const [salePrice, setSalePrice] = useState(String(asset.currentValue))
  const [archiveDebt, setArchiveDebt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const salePriceNum = parseFloat(salePrice) || 0
  const equity =
    asset.linkedDebtBalance !== null
      ? salePriceNum - asset.linkedDebtBalance
      : null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await markAssetSoldFn({
        data: {
          id: asset.id,
          soldPrice: salePriceNum,
          soldDate: String(f.get("soldDate") ?? ""),
          archiveDebt,
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSold()
    } catch {
      setError("Could not mark asset as sold.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Asset as Sold</DialogTitle>
          <DialogDescription>
            Record the sale of "{asset.name}". The asset will be archived.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sold-price">Sale Price</Label>
            <Input
              id="sold-price"
              type="number"
              step="0.01"
              min="0"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sold-date">Sale Date</Label>
            <Input
              id="sold-date"
              name="soldDate"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
            />
          </div>

          {asset.linkedDebtId && asset.linkedDebtBalance !== null && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Equity Calculation</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sale Price</span>
                <span>{formatCurrency(salePriceNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {asset.linkedDebtName} Balance
                </span>
                <span className="text-red-600">
                  -{formatCurrency(asset.linkedDebtBalance)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>Net Equity</span>
                <span
                  className={
                    equity !== null && equity >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {equity !== null ? formatCurrency(equity) : "—"}
                </span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
                <input
                  type="checkbox"
                  checked={archiveDebt}
                  onChange={(e) => setArchiveDebt(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Also archive "{asset.linkedDebtName}"
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
