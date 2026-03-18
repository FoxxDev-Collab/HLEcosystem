import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Check, ExternalLink, Pencil } from "lucide-react";
import {
  addWishlistItemAction,
  toggleWishlistItemAction,
  deleteWishlistItemAction,
  updateWishlistAction,
  deleteWishlistAction,
} from "../actions";

export default async function WishlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const wishlist = await prisma.wishlist.findUnique({
    where: { id },
    include: { items: { orderBy: [{ isPurchased: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!wishlist || wishlist.householdId !== householdId) notFound();

  const unpurchased = wishlist.items.filter((i) => !i.isPurchased);
  const purchased = wishlist.items.filter((i) => i.isPurchased);

  const totalLow = unpurchased.reduce((sum, i) => sum + Number(i.lowPrice ?? 0), 0);
  const totalHigh = unpurchased.reduce((sum, i) => sum + Number(i.highPrice ?? 0), 0);
  const totalAvg = unpurchased.reduce((sum, i) => {
    const low = Number(i.lowPrice ?? 0);
    const high = Number(i.highPrice ?? 0);
    if (low && high) return sum + (low + high) / 2;
    return sum + (low || high);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/wishlist"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{wishlist.name}</h1>
            {wishlist.description && <p className="text-muted-foreground">{wishlist.description}</p>}
          </div>
        </div>
        <form action={deleteWishlistAction}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="size-4 mr-2" />Delete List
          </Button>
        </form>
      </div>

      {/* Edit List Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Edit List</CardTitle></CardHeader>
        <CardContent>
          <form action={updateWishlistAction} className="grid gap-4 sm:grid-cols-3 items-end">
            <input type="hidden" name="id" value={id} />
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={wishlist.name} required />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="description" defaultValue={wishlist.description ?? ""} />
            </div>
            <Button type="submit"><Pencil className="size-4 mr-2" />Update</Button>
          </form>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {unpurchased.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Low Estimate</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalLow)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Average Estimate</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalAvg)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">High Estimate</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalHigh)}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Add Item */}
      <Card>
        <CardHeader><CardTitle>Add Item</CardTitle></CardHeader>
        <CardContent>
          <form action={addWishlistItemAction} className="space-y-3">
            <input type="hidden" name="wishlistId" value={id} />
            <div className="grid gap-3 sm:grid-cols-5 items-end">
              <div className="space-y-1 sm:col-span-2">
                <Label>Item Name</Label>
                <Input name="name" placeholder="e.g. Standing Desk" required />
              </div>
              <div className="space-y-1">
                <Label>Low Price</Label>
                <Input name="lowPrice" type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>High Price</Label>
                <Input name="highPrice" type="number" step="0.01" min="0" placeholder="0.00" />
              </div>
              <Button type="submit"><Plus className="size-4 mr-2" />Add</Button>
            </div>
            <div className="space-y-1">
              <Label>Link (optional)</Label>
              <Input name="url" type="url" placeholder="https://example.com/product" />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader><CardTitle>Items ({wishlist.items.length})</CardTitle></CardHeader>
        <CardContent>
          {wishlist.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No items yet. Add one above.</p>
          ) : (
            <div className="divide-y">
              {unpurchased.map((item) => {
                const low = Number(item.lowPrice ?? 0);
                const high = Number(item.highPrice ?? 0);
                const avg = low && high ? (low + high) / 2 : low || high;

                return (
                  <div key={item.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <form action={toggleWishlistItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="isPurchased" value="false" />
                        <input type="hidden" name="wishlistId" value={id} />
                        <Button type="submit" variant="outline" size="icon" className="h-7 w-7 shrink-0" title="Mark purchased" />
                      </form>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {low > 0 && high > 0 ? (
                            <>{formatCurrency(low)} – {formatCurrency(high)} · avg {formatCurrency(avg)}</>
                          ) : avg > 0 ? (
                            formatCurrency(avg)
                          ) : (
                            "No price set"
                          )}
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-blue-500 hover:underline">
                              <ExternalLink className="size-3" />Link
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {avg > 0 && <span className="text-sm font-medium">{formatCurrency(avg)}</span>}
                      <form action={deleteWishlistItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="wishlistId" value={id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}

              {purchased.length > 0 && (
                <>
                  <div className="py-2 pt-4">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchased</span>
                  </div>
                  {purchased.map((item) => {
                    const low = Number(item.lowPrice ?? 0);
                    const high = Number(item.highPrice ?? 0);
                    const avg = low && high ? (low + high) / 2 : low || high;

                    return (
                      <div key={item.id} className="flex items-center justify-between py-3 gap-4 opacity-60">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <form action={toggleWishlistItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="isPurchased" value="true" />
                            <input type="hidden" name="wishlistId" value={id} />
                            <Button type="submit" variant="default" size="icon" className="h-7 w-7 shrink-0">
                              <Check className="size-3.5" />
                            </Button>
                          </form>
                          <div className="min-w-0">
                            <div className="text-sm font-medium line-through">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {avg > 0 ? formatCurrency(avg) : "No price"}
                              {item.url && (
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-blue-500 hover:underline">
                                  <ExternalLink className="size-3" />Link
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <form action={deleteWishlistItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="wishlistId" value={id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
