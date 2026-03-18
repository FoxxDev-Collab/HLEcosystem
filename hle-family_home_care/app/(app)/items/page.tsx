import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Refrigerator, ShieldCheck, AlertTriangle } from "lucide-react";
import { createItemAction } from "./actions";

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "NEEDS_REPAIR", "DECOMMISSIONED"];

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-800",
  GOOD: "bg-blue-100 text-blue-800",
  FAIR: "bg-yellow-100 text-yellow-800",
  POOR: "bg-orange-100 text-orange-800",
  NEEDS_REPAIR: "bg-red-100 text-red-800",
  DECOMMISSIONED: "bg-gray-100 text-gray-800",
};

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ roomId?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const roomFilter = params.roomId ? { roomId: params.roomId } : {};

  const [rooms, items] = await Promise.all([
    prisma.room.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({
      where: { householdId, isArchived: false, ...roomFilter },
      include: { room: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const warrantyExpiringSoon = items.filter(
    (i) => i.warrantyExpires && i.warrantyExpires > now && i.warrantyExpires <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Items & Appliances</h1>

      {warrantyExpiringSoon.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <AlertTriangle className="size-4" />
              <span><strong>{warrantyExpiringSoon.length}</strong> warranty{warrantyExpiringSoon.length !== 1 ? "ies" : "y"} expiring within 30 days</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Add Item</CardTitle></CardHeader>
        <CardContent>
          <form action={createItemAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Dishwasher, HVAC Unit" required />
            </div>
            <div className="space-y-1">
              <Label>Room</Label>
              <Select name="roomId">
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Input name="manufacturer" placeholder="Brand" />
            </div>
            <div className="space-y-1">
              <Label>Model</Label>
              <Input name="model" placeholder="Model number" />
            </div>
            <div className="space-y-1">
              <Label>Serial Number</Label>
              <Input name="serialNumber" placeholder="S/N" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input name="purchaseDate" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Purchase Price</Label>
              <Input name="purchasePrice" type="number" step="0.01" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Warranty Expires</Label>
              <Input name="warrantyExpires" type="date" />
            </div>
            <div className="space-y-1">
              <Label>Condition</Label>
              <Select name="condition" defaultValue="GOOD">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Purchased From</Label>
              <Input name="purchasedFrom" placeholder="Store / retailer" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Optional" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Item</Button>
          </form>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Refrigerator className="size-10 mx-auto mb-3 opacity-40" />
            <p>No items yet. Add your home appliances, systems, and equipment.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {items.map((item) => (
                <Link key={item.id} href={`/items/${item.id}`} className="flex items-center justify-between py-3 gap-4 hover:bg-muted/50 -mx-2 px-2 rounded">
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.room?.name || "No room"}
                      {item.manufacturer && ` · ${item.manufacturer}`}
                      {item.model && ` ${item.model}`}
                    </div>
                    {item.warrantyExpires && (
                      <div className="flex items-center gap-1 text-xs mt-0.5">
                        <ShieldCheck className="size-3" />
                        <span className={item.warrantyExpires < now ? "text-red-600" : "text-green-600"}>
                          Warranty {item.warrantyExpires < now ? "expired" : "until"} {formatDate(item.warrantyExpires)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.purchasePrice && (
                      <span className="text-xs text-muted-foreground">{formatCurrency(item.purchasePrice)}</span>
                    )}
                    <Badge className={CONDITION_COLORS[item.condition]}>{item.condition.replace(/_/g, " ")}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
