"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Trash2, DollarSign } from "lucide-react";
import { updateAssetAction, deleteAssetAction, markAssetSoldAction } from "../actions";

const ASSET_TYPES = [
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "JEWELRY", label: "Jewelry" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "COLLECTIBLES", label: "Collectibles" },
  { value: "OTHER", label: "Other" },
];

type AssetData = {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  purchasePrice: number | null;
  purchaseDate: Date | null;
  notes: string | null;
  linkedDebtId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  squareFootage: number | null;
  yearBuilt: number | null;
  propertyTaxAnnual: number | null;
  make: string | null;
  model: string | null;
  vehicleYear: number | null;
  vin: string | null;
  mileage: number | null;
};

type DebtOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

export function AssetEditDialog({ asset, debts }: { asset: AssetData; debts: DebtOption[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetType, setAssetType] = useState(asset.type);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await updateAssetAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  const purchaseDateStr = asset.purchaseDate
    ? new Date(asset.purchaseDate).toISOString().split("T")[0]
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4 mr-2" />Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>Update asset details and linked debt.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={asset.id} />

          {/* Basic fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={asset.name} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue={asset.type} onValueChange={setAssetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Current Value</Label>
              <Input name="currentValue" type="number" step="0.01" defaultValue={asset.currentValue} required />
            </div>
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" defaultValue={asset.purchasePrice ?? ""} />
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" defaultValue={purchaseDateStr} />
            </div>
            <div className="space-y-1">
              <Label>Linked Debt</Label>
              <Select name="linkedDebtId" defaultValue={asset.linkedDebtId || "none"}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {debts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(d.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Real estate fields */}
          {assetType === "REAL_ESTATE" && (
            <>
              <Separator />
              <p className="text-sm font-medium">Property Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Address</Label>
                  <Input name="address" defaultValue={asset.address ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input name="city" defaultValue={asset.city ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <Input name="state" defaultValue={asset.state ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Zip Code</Label>
                  <Input name="zipCode" defaultValue={asset.zipCode ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Sq Ft</Label>
                  <Input name="squareFootage" type="number" defaultValue={asset.squareFootage ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Year Built</Label>
                  <Input name="yearBuilt" type="number" defaultValue={asset.yearBuilt ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Annual Property Tax</Label>
                  <Input name="propertyTaxAnnual" type="number" step="0.01" defaultValue={asset.propertyTaxAnnual ?? ""} />
                </div>
              </div>
            </>
          )}

          {/* Vehicle fields */}
          {assetType === "VEHICLE" && (
            <>
              <Separator />
              <p className="text-sm font-medium">Vehicle Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Make</Label>
                  <Input name="make" defaultValue={asset.make ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Model</Label>
                  <Input name="model" defaultValue={asset.model ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Year</Label>
                  <Input name="vehicleYear" type="number" defaultValue={asset.vehicleYear ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>VIN</Label>
                  <Input name="vin" defaultValue={asset.vin ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Mileage</Label>
                  <Input name="mileage" type="number" defaultValue={asset.mileage ?? ""} />
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input name="notes" defaultValue={asset.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssetDeleteDialog({ assetId, assetName }: { assetId: string; assetName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4 mr-2" />Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Asset</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete &quot;{assetName}&quot; and all its value history? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <form action={deleteAssetAction}>
            <input type="hidden" name="id" value={assetId} />
            <Button type="submit" variant="destructive">Delete Permanently</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type LinkedDebtInfo = {
  id: string;
  name: string;
  balance: number;
};

export function AssetSoldDialog({
  assetId,
  assetName,
  currentValue,
  linkedDebt,
}: {
  assetId: string;
  assetName: string;
  currentValue: number;
  linkedDebt: LinkedDebtInfo | null;
}) {
  const [open, setOpen] = useState(false);
  const [salePrice, setSalePrice] = useState(currentValue.toString());
  const [archiveDebt, setArchiveDebt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salePriceNum = parseFloat(salePrice) || 0;
  const equity = linkedDebt ? salePriceNum - linkedDebt.balance : null;

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await markAssetSoldAction(formData);
    if (result?.error) {
      setError(result.error);
    }
    // On success, the action redirects
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50">
          <DollarSign className="size-4 mr-2" />Mark as Sold
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Asset as Sold</DialogTitle>
          <DialogDescription>
            Record the sale of &quot;{assetName}&quot;. The asset will be archived.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={assetId} />
          <div className="space-y-1">
            <Label>Sale Price</Label>
            <Input
              name="soldPrice"
              type="number"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Sale Date</Label>
            <Input name="soldDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
          </div>

          {/* Equity calculation */}
          {linkedDebt && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-sm font-medium">Equity Calculation</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sale Price</span>
                <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(salePriceNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{linkedDebt.name} Balance</span>
                <span className="text-red-600">-{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(linkedDebt.balance)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-medium">
                <span>Net Equity</span>
                <span className={equity! >= 0 ? "text-green-600" : "text-red-600"}>
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(equity!)}
                </span>
              </div>

              <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  name="archiveDebt"
                  value="true"
                  checked={archiveDebt}
                  onChange={(e) => setArchiveDebt(e.target.checked)}
                  className="rounded border-input"
                />
                Also archive &quot;{linkedDebt.name}&quot;
              </label>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700">Confirm Sale</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
