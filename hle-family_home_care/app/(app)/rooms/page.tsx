import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, Home } from "lucide-react";
import { createRoomAction, updateRoomAction, deleteRoomAction } from "./actions";

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const rooms = await prisma.room.findMany({
    where: { householdId },
    include: { _count: { select: { items: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Rooms & Locations</h1>

      <Card>
        <CardHeader><CardTitle>Add Room</CardTitle></CardHeader>
        <CardContent>
          <form action={createRoomAction} className="grid gap-4 sm:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Kitchen, Garage" required />
            </div>
            <div className="space-y-1">
              <Label>Floor</Label>
              <Input name="floor" placeholder="e.g. 1st Floor, Basement" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="description" placeholder="Optional notes" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Add Room</Button>
          </form>
        </CardContent>
      </Card>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Home className="size-10 mx-auto mb-3 opacity-40" />
            <p>No rooms yet. Add rooms to organize your items.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Rooms ({rooms.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>
                      <form id={`edit-${room.id}`} action={updateRoomAction}>
                        <input type="hidden" name="id" value={room.id} />
                        <Input
                          name="name"
                          defaultValue={room.name}
                          className="h-8 text-sm"
                          required
                        />
                      </form>
                    </TableCell>
                    <TableCell>
                      <Input
                        name="floor"
                        form={`edit-${room.id}`}
                        defaultValue={room.floor || ""}
                        placeholder="—"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        name="description"
                        form={`edit-${room.id}`}
                        defaultValue={room.description || ""}
                        placeholder="—"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/items?roomId=${room.id}`} className="text-sm hover:underline">
                        {room._count.items}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="submit"
                          form={`edit-${room.id}`}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Save changes"
                        >
                          <Save className="size-3.5 text-blue-600" />
                        </Button>
                        <form action={deleteRoomAction}>
                          <input type="hidden" name="id" value={room.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete room">
                            <Trash2 className="size-3.5 text-red-500" />
                          </Button>
                        </form>
                      </div>
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
