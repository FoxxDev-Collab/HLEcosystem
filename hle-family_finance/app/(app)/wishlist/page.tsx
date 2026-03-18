import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { createWishlistAction, deleteWishlistAction } from "./actions";

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const wishlists = await prisma.wishlist.findMany({
    where: { householdId },
    include: {
      items: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Wishlists</h1>

      {/* New Wishlist Form */}
      <Card>
        <CardHeader><CardTitle>New Wishlist</CardTitle></CardHeader>
        <CardContent>
          <form action={createWishlistAction} className="grid gap-4 sm:grid-cols-3 items-end">
            <div className="space-y-1">
              <Label>List Name</Label>
              <Input name="name" placeholder="e.g. Home Office Upgrades" required />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="description" placeholder="Optional details" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Create List</Button>
          </form>
        </CardContent>
      </Card>

      {/* Wishlist Grid */}
      {wishlists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No wishlists yet. Create one to start planning purchases.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wishlists.map((list) => {
            const unpurchased = list.items.filter((i) => !i.isPurchased);
            const purchased = list.items.filter((i) => i.isPurchased);
            const totalEstimate = unpurchased.reduce((sum, i) => {
              const low = Number(i.lowPrice ?? 0);
              const high = Number(i.highPrice ?? 0);
              if (low && high) return sum + (low + high) / 2;
              return sum + (low || high);
            }, 0);

            return (
              <Card key={list.id} className="hover:bg-accent/30 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/wishlist/${list.id}`}>
                      <CardTitle className="text-base hover:underline cursor-pointer">{list.name}</CardTitle>
                    </Link>
                    <form action={deleteWishlistAction}>
                      <input type="hidden" name="id" value={list.id} />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                  {list.description && <CardDescription className="line-clamp-2">{list.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  {totalEstimate > 0 && (
                    <div className="text-xl font-bold">~{formatCurrency(totalEstimate)}</div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {unpurchased.length} {unpurchased.length === 1 ? "item" : "items"}
                    </Badge>
                    {purchased.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {purchased.length} purchased
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
