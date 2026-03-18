import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Home } from "lucide-react";
import { createRoomAction, deleteRoomAction } from "./actions";

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
          <form action={createRoomAction} className="grid gap-4 sm:grid-cols-3 items-end">
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
              <div className="flex gap-2">
                <Input name="description" placeholder="Optional notes" />
                <Button type="submit"><Plus className="size-4 mr-2" />Add</Button>
              </div>
            </div>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{room.name}</CardTitle>
                  {room.floor && (
                    <p className="text-xs text-muted-foreground">{room.floor}</p>
                  )}
                </div>
                <form action={deleteRoomAction}>
                  <input type="hidden" name="id" value={room.id} />
                  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete room">
                    <Trash2 className="size-3.5 text-red-500" />
                  </Button>
                </form>
              </CardHeader>
              <CardContent>
                {room.description && (
                  <p className="text-sm text-muted-foreground mb-2">{room.description}</p>
                )}
                <Badge variant="secondary">{room._count.items} item{room._count.items !== 1 ? "s" : ""}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
