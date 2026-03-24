import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Store as StoreIcon, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createStoreAction, updateStoreAction, deleteStoreAction } from "./actions";

export default async function StoresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const stores = await prisma.store.findMany({
    where: { householdId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { prices: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
        <p className="text-muted-foreground">Manage stores where you track prices</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Store</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStoreAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="e.g. Walmart" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="e.g. 123 Main St" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input id="color" name="color" type="color" defaultValue="#3b82f6" className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional notes" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit">Add Store</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <StoreIcon className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No stores yet</h3>
            <p className="text-sm text-muted-foreground">Add your first store to start tracking prices.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Stores ({stores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Prices</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      <div
                        className="size-5 rounded-full border"
                        style={{ backgroundColor: store.color || "#94a3b8" }}
                      />
                    </TableCell>
                    <TableCell>
                      <form action={updateStoreAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={store.id} />
                        <input type="hidden" name="location" value={store.location || ""} />
                        <input type="hidden" name="notes" value={store.notes || ""} />
                        <input type="hidden" name="color" value={store.color || ""} />
                        <Input
                          name="name"
                          defaultValue={store.name}
                          className="h-8 w-40 border-transparent hover:border-input focus:border-input"
                        />
                        <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-xs">
                          Save
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.location || "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">{store._count.prices}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {store.notes || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <form action={deleteStoreAction}>
                        <input type="hidden" name="id" value={store.id} />
                        <Button type="submit" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
