import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createListAction, deleteListAction } from "./actions";

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  COMPLETED: "outline",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

export default async function ShoppingListsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const lists = await prisma.shoppingList.findMany({
    where: { householdId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shopping Lists</h1>
        <p className="text-muted-foreground">Create and manage your shopping lists</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New List</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createListAction} className="flex items-end gap-3">
            <div className="space-y-2 flex-1">
              <Label htmlFor="name">List Name *</Label>
              <Input id="name" name="name" placeholder="e.g. Weekly Groceries" required />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional" />
            </div>
            <Button type="submit">Create List</Button>
          </form>
        </CardContent>
      </Card>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No shopping lists yet</h3>
            <p className="text-sm text-muted-foreground">Create your first list to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Lists ({lists.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <Link
                        href={`/shopping-lists/${list.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {list.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          statusColors[list.status] as
                            | "default"
                            | "secondary"
                            | "outline"
                            | "destructive"
                        }
                      >
                        {statusLabels[list.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{list._count.items}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(list.createdAt)}
                    </TableCell>
                    <TableCell>
                      <form action={deleteListAction}>
                        <input type="hidden" name="id" value={list.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                        >
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
