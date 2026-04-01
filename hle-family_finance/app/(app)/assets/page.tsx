import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, Link2, ArrowRight } from "lucide-react";
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

  const [assets, debts] = await Promise.all([
    prisma.asset.findMany({
      where: { householdId, isArchived: false },
      include: { linkedDebt: { select: { id: true, name: true, currentBalance: true } } },
      orderBy: [{ type: "asc" }, { currentValue: "desc" }],
    }),
    prisma.debt.findMany({
      where: { householdId, isArchived: false },
      select: { id: true, name: true, type: true, currentBalance: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" />
            </div>
            {debts.length > 0 && (
              <div className="space-y-1">
                <Label>Link Debt</Label>
                <Select name="linkedDebtId" defaultValue="none">
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {debts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Optional" />
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
            <Card key={asset.id} className="hover:bg-accent/30 transition-colors group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Link href={`/assets/${asset.id}`}>
                    <CardTitle className="text-base hover:underline cursor-pointer">{asset.name}</CardTitle>
                  </Link>
                  <div className="flex items-center gap-1.5">
                    {asset.linkedDebt && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Link2 className="size-3" />
                        {asset.linkedDebt.name}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{ASSET_TYPES.find((t) => t.value === asset.type)?.label}</span>
                  </div>
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
                {asset.linkedDebt && (
                  <div className="text-xs mt-1">
                    <span className="text-muted-foreground">Equity: </span>
                    <span className={Number(asset.currentValue) - Number(asset.linkedDebt.currentBalance) >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {formatCurrency(Number(asset.currentValue) - Number(asset.linkedDebt.currentBalance))}
                    </span>
                  </div>
                )}
                {asset.valueAsOfDate && (
                  <div className="text-xs text-muted-foreground">
                    Updated: {formatDate(asset.valueAsOfDate)}
                  </div>
                )}

                {/* Quick actions */}
                <div className="flex gap-2 mt-3">
                  <form action={updateAssetValueAction} className="flex gap-2 flex-1">
                    <input type="hidden" name="id" value={asset.id} />
                    <Input name="currentValue" type="number" step="0.01" placeholder="New value" className="h-8 text-sm" />
                    <Button type="submit" variant="outline" size="sm" className="shrink-0">
                      <RefreshCw className="size-3.5 mr-1" />Update
                    </Button>
                  </form>
                  <Button variant="ghost" size="sm" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                    <Link href={`/assets/${asset.id}`}>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
