// Create/edit asset dialog (legacy assets page inline form + AssetEditDialog)
// with the real-estate and vehicle field groups and the linked-debt picker.
import { useState } from "react"
import { createAssetFn, updateAssetFn } from "@/server/finance/fns.assets"
import type { AssetRow, AssetType } from "@/server/finance/assets"
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/finance-constants"
import type { DebtPickerRow } from "@/server/finance/debts"
import { formatCurrency } from "@/lib/format"
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

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function numOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? Number(v) : null
}

function intOrNull(value: FormDataEntryValue | null): number | null {
  const v = String(value ?? "").trim()
  return v ? parseInt(v, 10) : null
}

export function AssetFormDialog({
  asset,
  debts,
  onClose,
  onSaved,
}: {
  asset?: AssetRow
  debts: Array<DebtPickerRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<AssetType>(asset?.type ?? "OTHER")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    const base = {
      name: String(f.get("name") ?? ""),
      type,
      currentValue: numOrNull(f.get("currentValue")) ?? 0,
      purchasePrice: numOrNull(f.get("purchasePrice")),
      purchaseDate: String(f.get("purchaseDate") ?? "") || null,
      linkedDebtId: String(f.get("linkedDebtId") ?? "") || null,
      notes: String(f.get("notes") ?? ""),
      address: type === "REAL_ESTATE" ? String(f.get("address") ?? "") : "",
      city: type === "REAL_ESTATE" ? String(f.get("city") ?? "") : "",
      state: type === "REAL_ESTATE" ? String(f.get("state") ?? "") : "",
      zipCode: type === "REAL_ESTATE" ? String(f.get("zipCode") ?? "") : "",
      squareFootage:
        type === "REAL_ESTATE" ? intOrNull(f.get("squareFootage")) : null,
      yearBuilt: type === "REAL_ESTATE" ? intOrNull(f.get("yearBuilt")) : null,
      propertyTaxAnnual:
        type === "REAL_ESTATE" ? numOrNull(f.get("propertyTaxAnnual")) : null,
      make: type === "VEHICLE" ? String(f.get("make") ?? "") : "",
      model: type === "VEHICLE" ? String(f.get("model") ?? "") : "",
      vehicleYear: type === "VEHICLE" ? intOrNull(f.get("vehicleYear")) : null,
      vin: type === "VEHICLE" ? String(f.get("vin") ?? "") : "",
      mileage: type === "VEHICLE" ? intOrNull(f.get("mileage")) : null,
    }
    try {
      const result = asset
        ? await updateAssetFn({ data: { ...base, id: asset.id } })
        : await createAssetFn({ data: base })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onSaved()
    } catch {
      setError("Could not save asset.")
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit Asset" : "Add Asset"}</DialogTitle>
          <DialogDescription>
            {asset
              ? "Update asset details and linked debt."
              : "Track a home, vehicle, investment, or valuable."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                name="name"
                defaultValue={asset?.name}
                placeholder="e.g. Home, Tesla Model Y"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-type">Type</Label>
              <select
                id="asset-type"
                name="type"
                className={selectClass}
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-currentValue">Current Value</Label>
              <Input
                id="asset-currentValue"
                name="currentValue"
                type="number"
                step="0.01"
                min="0"
                defaultValue={asset?.currentValue ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-purchasePrice">Purchase Price</Label>
              <Input
                id="asset-purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={asset?.purchasePrice ?? ""}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-purchaseDate">Purchase Date</Label>
              <Input
                id="asset-purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={asset?.purchaseDate ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-linkedDebtId">Linked Debt</Label>
              <select
                id="asset-linkedDebtId"
                name="linkedDebtId"
                className={selectClass}
                defaultValue={asset?.linkedDebtId ?? ""}
              >
                <option value="">None</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({formatCurrency(d.currentBalance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {type === "REAL_ESTATE" && (
            <>
              <Separator />
              <p className="text-sm font-medium">Property Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="asset-address">Address</Label>
                  <Input
                    id="asset-address"
                    name="address"
                    defaultValue={asset?.address ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-city">City</Label>
                  <Input
                    id="asset-city"
                    name="city"
                    defaultValue={asset?.city ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-state">State</Label>
                  <Input
                    id="asset-state"
                    name="state"
                    defaultValue={asset?.state ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-zipCode">Zip Code</Label>
                  <Input
                    id="asset-zipCode"
                    name="zipCode"
                    defaultValue={asset?.zipCode ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-squareFootage">Sq Ft</Label>
                  <Input
                    id="asset-squareFootage"
                    name="squareFootage"
                    type="number"
                    min="0"
                    defaultValue={asset?.squareFootage ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-yearBuilt">Year Built</Label>
                  <Input
                    id="asset-yearBuilt"
                    name="yearBuilt"
                    type="number"
                    defaultValue={asset?.yearBuilt ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-propertyTaxAnnual">
                    Annual Property Tax
                  </Label>
                  <Input
                    id="asset-propertyTaxAnnual"
                    name="propertyTaxAnnual"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={asset?.propertyTaxAnnual ?? ""}
                  />
                </div>
              </div>
            </>
          )}

          {type === "VEHICLE" && (
            <>
              <Separator />
              <p className="text-sm font-medium">Vehicle Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asset-make">Make</Label>
                  <Input
                    id="asset-make"
                    name="make"
                    defaultValue={asset?.make ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-model">Model</Label>
                  <Input
                    id="asset-model"
                    name="model"
                    defaultValue={asset?.model ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-vehicleYear">Year</Label>
                  <Input
                    id="asset-vehicleYear"
                    name="vehicleYear"
                    type="number"
                    defaultValue={asset?.vehicleYear ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-vin">VIN</Label>
                  <Input
                    id="asset-vin"
                    name="vin"
                    defaultValue={asset?.vin ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-mileage">Mileage</Label>
                  <Input
                    id="asset-mileage"
                    name="mileage"
                    type="number"
                    min="0"
                    defaultValue={asset?.mileage ?? ""}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="asset-notes">Notes</Label>
            <Input
              id="asset-notes"
              name="notes"
              defaultValue={asset?.notes ?? ""}
              placeholder="Optional"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : asset ? "Save Changes" : "Add Asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
