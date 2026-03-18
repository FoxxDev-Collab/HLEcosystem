import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw } from "lucide-react";
import { createAssetAction, updateAssetValueAction } from "./actions";

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

export default async function AssetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const assets = await prisma.asset.findMany({
    where: { householdId, isArchived: false },
    orderBy: [{ type: "asc" }, { currentValue: "desc" }],
  });

  const totalValue = assets
    .filter((a) => a.includeInNetWorth)
    .reduce((sum, a) => sum + Number(a.currentValue), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground">Total value: {formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Add Asset */}
      <Card>
        <CardHeader><CardTitle>Add Asset</CardTitle></CardHeader>
        <CardContent>
          <form action={createAssetAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Home, Tesla Model Y" required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select name="type" defaultValue="OTHER">
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
              <Input name="currentValue" type="number" step="0.01" placeholder="0.00" required />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Asset</Button>
          </form>
        </CardContent>
      </Card>

      {/* Asset List */}
      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No assets tracked yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{asset.name}</CardTitle>
                  <span className="text-xs text-muted-foreground">{ASSET_TYPES.find((t) => t.value === asset.type)?.label}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(asset.currentValue)}</div>
                {asset.purchasePrice && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Purchased for {formatCurrency(asset.purchasePrice)}
                    {Number(asset.currentValue) - Number(asset.purchasePrice) !== 0 && (
                      <span className={Number(asset.currentValue) > Number(asset.purchasePrice) ? " text-green-600" : " text-red-600"}>
                        {" "}({Number(asset.currentValue) > Number(asset.purchasePrice) ? "+" : ""}
                        {formatCurrency(Number(asset.currentValue) - Number(asset.purchasePrice))})
                      </span>
                    )}
                  </div>
                )}
                {asset.valueAsOfDate && (
                  <div className="text-xs text-muted-foreground">
                    Updated: {formatDate(asset.valueAsOfDate)}
                  </div>
                )}

                {/* Update Value */}
                <form action={updateAssetValueAction} className="flex gap-2 mt-3">
                  <input type="hidden" name="id" value={asset.id} />
                  <Input name="currentValue" type="number" step="0.01" placeholder="New value" className="h-8 text-sm" />
                  <Button type="submit" variant="outline" size="sm" className="shrink-0">
                    <RefreshCw className="size-3.5 mr-1" />Update
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
