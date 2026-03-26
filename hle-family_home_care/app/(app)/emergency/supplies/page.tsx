import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import {
  createSupplyKitAction,
  deleteSupplyKitAction,
  addSupplyItemAction,
  deleteSupplyItemAction,
  markKitCheckedAction,
} from "../actions";

const SUPPLY_CONDITIONS = ["GOOD", "LOW", "EXPIRED", "NEEDS_REPLACEMENT"];

const CONDITION_COLORS: Record<string, string> = {
  GOOD: "bg-green-100 text-green-800",
  LOW: "bg-yellow-100 text-yellow-800",
  EXPIRED: "bg-red-100 text-red-800",
  NEEDS_REPLACEMENT: "bg-orange-100 text-orange-800",
};

function getExpirationColor(expirationDate: Date | null): string {
  if (!expirationDate) return "";
  const now = new Date();
  const daysUntil = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) return "text-red-600 font-medium";
  if (daysUntil < 30) return "text-red-600 font-medium";
  if (daysUntil < 60) return "text-yellow-600";
  return "text-green-600";
}

function getExpirationLabel(expirationDate: Date | null): string {
  if (!expirationDate) return "";
  const now = new Date();
  const daysUntil = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntil < 0) return `EXPIRED (${Math.abs(daysUntil)}d ago)`;
  if (daysUntil === 0) return "Expires today";
  if (daysUntil < 30) return `${daysUntil}d left`;
  return "";
}

export default async function EmergencySuppliesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [rooms, kits] = await Promise.all([
    prisma.room.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.emergencySupplyKit.findMany({
      where: { householdId },
      include: {
        items: { orderBy: { expirationDate: "asc" } },
        room: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringCount = kits.reduce(
    (count, kit) =>
      count +
      kit.items.filter(
        (item) => item.expirationDate && item.expirationDate <= thirtyDaysFromNow
      ).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Emergency Supply Kits</h1>
        {expiringCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="size-4" />
            {expiringCount} item{expiringCount !== 1 ? "s" : ""} expiring soon
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Supply Kit</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSupplyKitAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Kit Name</Label>
              <Input name="name" placeholder="e.g. 72-Hour Kit" required />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input name="location" placeholder="e.g. Hall closet" />
            </div>
            <div className="space-y-1">
              <Label>Room</Label>
              <Select name="roomId">
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="description" placeholder="What's in this kit?" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />Add Kit
            </Button>
          </form>
        </CardContent>
      </Card>

      {kits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="size-10 mx-auto mb-3 opacity-40" />
            <p>No supply kits yet. Create kits to track your emergency supplies.</p>
          </CardContent>
        </Card>
      ) : (
        kits.map((kit) => (
          <Card key={kit.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{kit.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    {kit.location && <span>{kit.location}</span>}
                    {kit.room && <span>({kit.room.name})</span>}
                    <span>|</span>
                    <span>{kit.items.length} item{kit.items.length !== 1 ? "s" : ""}</span>
                    <span>|</span>
                    <span>
                      Last checked: {kit.lastChecked ? formatDate(kit.lastChecked) : "Never"}
                    </span>
                  </div>
                  {kit.description && (
                    <p className="text-sm text-muted-foreground mt-1">{kit.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <form action={markKitCheckedAction}>
                    <input type="hidden" name="id" value={kit.id} />
                    <Button type="submit" variant="outline" size="sm" title="Mark as checked">
                      <CheckCircle2 className="size-3.5 mr-1" />Checked
                    </Button>
                  </form>
                  <form action={deleteSupplyKitAction}>
                    <input type="hidden" name="id" value={kit.id} />
                    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8" title="Delete kit">
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </form>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items Table */}
              {kit.items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kit.items.map((item) => {
                      const expColor = getExpirationColor(item.expirationDate);
                      const expLabel = getExpirationLabel(item.expirationDate);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                          </TableCell>
                          <TableCell>
                            <Badge className={CONDITION_COLORS[item.condition]}>
                              {item.condition.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.expirationDate ? (
                              <div>
                                <span className={expColor}>{formatDate(item.expirationDate)}</span>
                                {expLabel && (
                                  <span className={`text-xs block ${expColor}`}>{expLabel}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.notes || "--"}
                          </TableCell>
                          <TableCell className="text-right">
                            <form action={deleteSupplyItemAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Remove item">
                                <Trash2 className="size-3.5 text-red-500" />
                              </Button>
                            </form>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {/* Add Item Form */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Add Item to Kit</p>
                <form action={addSupplyItemAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
                  <input type="hidden" name="kitId" value={kit.id} />
                  <div className="space-y-1">
                    <Label className="text-xs">Item Name</Label>
                    <Input name="name" placeholder="e.g. Bottled Water" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input name="quantity" type="number" min="1" defaultValue="1" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input name="unit" placeholder="e.g. gallons, packs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expiration</Label>
                    <Input name="expirationDate" type="date" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Condition</Label>
                    <Select name="condition" defaultValue="GOOD">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPLY_CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" size="sm">
                    <Plus className="size-3.5 mr-1" />Add
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
