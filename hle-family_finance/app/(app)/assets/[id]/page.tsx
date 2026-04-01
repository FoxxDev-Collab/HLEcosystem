import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Home, Car, Link2 } from "lucide-react";
import { updateAssetValueAction } from "../actions";
import { AssetEditDialog, AssetDeleteDialog, AssetSoldDialog } from "./asset-actions";

const ASSET_TYPE_LABELS: Record<string, string> = {
  REAL_ESTATE: "Real Estate", VEHICLE: "Vehicle", INVESTMENT: "Investment",
  RETIREMENT: "Retirement", JEWELRY: "Jewelry", ELECTRONICS: "Electronics",
  COLLECTIBLES: "Collectibles", OTHER: "Other",
};

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const asset = await prisma.asset.findUnique({
    where: { id, householdId },
    include: {
      linkedDebt: true,
      valueHistory: { orderBy: { date: "desc" }, take: 20 },
    },
  });
  if (!asset) notFound();

  // Available debts for linking
  const debts = await prisma.debt.findMany({
    where: { householdId, isArchived: false },
    select: { id: true, name: true, type: true, currentBalance: true },
    orderBy: { name: "asc" },
  });

  const currentValue = Number(asset.currentValue);
  const purchasePrice = asset.purchasePrice ? Number(asset.purchasePrice) : null;
  const gainLoss = purchasePrice !== null ? currentValue - purchasePrice : null;
  const gainLossPercent = purchasePrice && purchasePrice > 0 ? (gainLoss! / purchasePrice) * 100 : null;
  const debtBalance = asset.linkedDebt ? Number(asset.linkedDebt.currentBalance) : null;
  const equity = debtBalance !== null ? currentValue - debtBalance : null;

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Back link */}
      <Link
        href="/assets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Assets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {asset.type === "REAL_ESTATE" ? <Home className="size-5 text-primary" /> :
             asset.type === "VEHICLE" ? <Car className="size-5 text-primary" /> :
             <TrendingUp className="size-5 text-primary" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">
              {ASSET_TYPE_LABELS[asset.type]}
              {asset.isSold && <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">Sold</Badge>}
            </p>
          </div>
        </div>
        {!asset.isSold && (
          <div className="flex gap-2">
            <AssetEditDialog
              asset={{
                id: asset.id,
                name: asset.name,
                type: asset.type,
                currentValue,
                purchasePrice,
                purchaseDate: asset.purchaseDate,
                notes: asset.notes,
                linkedDebtId: asset.linkedDebtId,
                address: asset.address,
                city: asset.city,
                state: asset.state,
                zipCode: asset.zipCode,
                squareFootage: asset.squareFootage,
                yearBuilt: asset.yearBuilt,
                propertyTaxAnnual: asset.propertyTaxAnnual ? Number(asset.propertyTaxAnnual) : null,
                make: asset.make,
                model: asset.model,
                vehicleYear: asset.vehicleYear,
                vin: asset.vin,
                mileage: asset.mileage,
              }}
              debts={debts.map((d) => ({ id: d.id, name: d.name, type: d.type, balance: Number(d.currentBalance) }))}
            />
            <AssetSoldDialog
              assetId={asset.id}
              assetName={asset.name}
              currentValue={currentValue}
              linkedDebt={asset.linkedDebt ? { id: asset.linkedDebt.id, name: asset.linkedDebt.name, balance: Number(asset.linkedDebt.currentBalance) } : null}
            />
            <AssetDeleteDialog assetId={asset.id} assetName={asset.name} />
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className={`grid gap-4 ${equity !== null ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Current Value</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentValue)}</div>
            {asset.valueAsOfDate && (
              <p className="text-xs text-muted-foreground mt-1">as of {formatDate(asset.valueAsOfDate)}</p>
            )}
          </CardContent>
        </Card>
        {purchasePrice !== null && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Purchase Price</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(purchasePrice)}</div>
              {asset.purchaseDate && (
                <p className="text-xs text-muted-foreground mt-1">{formatDate(asset.purchaseDate)}</p>
              )}
            </CardContent>
          </Card>
        )}
        {gainLoss !== null && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Gain / Loss</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-1 ${gainLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                {gainLoss >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
                {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss)}
              </div>
              {gainLossPercent !== null && (
                <p className={`text-xs mt-1 ${gainLoss! >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {gainLoss! >= 0 ? "+" : ""}{formatPercent(gainLossPercent)}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {equity !== null && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Equity</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${equity >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(equity)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Value minus {asset.linkedDebt?.name}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="space-y-6">
          {/* Type-specific details */}
          {asset.type === "REAL_ESTATE" && (asset.address || asset.squareFootage || asset.yearBuilt) && (
            <Card>
              <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {asset.address && (
                    <div>
                      <div className="text-xs text-muted-foreground">Address</div>
                      <div className="text-sm font-medium">
                        {asset.address}
                        {asset.city && `, ${asset.city}`}
                        {asset.state && `, ${asset.state}`}
                        {asset.zipCode && ` ${asset.zipCode}`}
                      </div>
                    </div>
                  )}
                  {asset.squareFootage && (
                    <div>
                      <div className="text-xs text-muted-foreground">Square Footage</div>
                      <div className="text-sm font-medium">{asset.squareFootage.toLocaleString()} sq ft</div>
                    </div>
                  )}
                  {asset.yearBuilt && (
                    <div>
                      <div className="text-xs text-muted-foreground">Year Built</div>
                      <div className="text-sm font-medium">{asset.yearBuilt}</div>
                    </div>
                  )}
                  {asset.propertyTaxAnnual && (
                    <div>
                      <div className="text-xs text-muted-foreground">Annual Property Tax</div>
                      <div className="text-sm font-medium">{formatCurrency(asset.propertyTaxAnnual)}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {asset.type === "VEHICLE" && (asset.make || asset.vin) && (
            <Card>
              <CardHeader><CardTitle>Vehicle Details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(asset.make || asset.model) && (
                    <div>
                      <div className="text-xs text-muted-foreground">Make / Model</div>
                      <div className="text-sm font-medium">
                        {[asset.vehicleYear, asset.make, asset.model].filter(Boolean).join(" ")}
                      </div>
                    </div>
                  )}
                  {asset.vin && (
                    <div>
                      <div className="text-xs text-muted-foreground">VIN</div>
                      <div className="text-sm font-medium font-mono">{asset.vin}</div>
                    </div>
                  )}
                  {asset.mileage && (
                    <div>
                      <div className="text-xs text-muted-foreground">Mileage</div>
                      <div className="text-sm font-medium">{asset.mileage.toLocaleString()} mi</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Value History */}
          <Card>
            <CardHeader>
              <CardTitle>Value History</CardTitle>
              <CardDescription>{asset.valueHistory.length} entries recorded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Update Value inline */}
              {!asset.isSold && (
                <form action={updateAssetValueAction} className="flex gap-2">
                  <input type="hidden" name="id" value={asset.id} />
                  <Input name="currentValue" type="number" step="0.01" placeholder="New value" className="max-w-[200px]" />
                  <Button type="submit" variant="outline" size="sm">
                    <RefreshCw className="size-3.5 mr-1.5" />Update Value
                  </Button>
                </form>
              )}

              {asset.valueHistory.length > 0 ? (
                <div className="divide-y">
                  {asset.valueHistory.map((entry, i) => {
                    const prev = asset.valueHistory[i + 1];
                    const change = prev ? Number(entry.value) - Number(prev.value) : null;
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-sm font-medium">{formatDate(entry.date)}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.source === "sold" ? "Sold" : entry.source === "manual" ? "Manual update" : entry.source || "Update"}
                            {entry.notes && ` — ${entry.notes}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(entry.value)}</div>
                          {change !== null && change !== 0 && (
                            <div className={`text-xs ${change > 0 ? "text-green-600" : "text-red-600"}`}>
                              {change > 0 ? "+" : ""}{formatCurrency(change)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No value history recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Linked Debt */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Link2 className="size-4" />Linked Debt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.linkedDebt ? (
                <div>
                  <Link
                    href={`/debts/${asset.linkedDebt.id}`}
                    className="text-sm font-medium hover:underline text-primary"
                  >
                    {asset.linkedDebt.name}
                  </Link>
                  <div className="text-lg font-bold text-red-600 mt-1">
                    {formatCurrency(asset.linkedDebt.currentBalance)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    remaining balance
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Equity</span>
                    <span className={`font-medium ${equity! >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(equity!)}
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

          {/* Sold info */}
          {asset.isSold && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sale Details</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sale Price</span>
                    <span className="font-medium">{formatCurrency(asset.soldPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sale Date</span>
                    <span className="font-medium">{formatDate(asset.soldDate)}</span>
                  </div>
                  {purchasePrice !== null && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Purchase Price</span>
                        <span className="font-medium">{formatCurrency(purchasePrice)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Net Gain/Loss</span>
                        <span className={`font-medium ${Number(asset.soldPrice) - purchasePrice >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(Number(asset.soldPrice) - purchasePrice)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {asset.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{asset.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
