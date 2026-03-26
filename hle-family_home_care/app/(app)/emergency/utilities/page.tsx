import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Zap, Trash2 } from "lucide-react";
import {
  createUtilityShutoffAction,
  deleteUtilityShutoffAction,
} from "../actions";

const UTILITY_TYPES = [
  "Gas",
  "Water",
  "Electric",
  "Sewer",
  "Internet",
  "HVAC",
  "Sprinkler",
  "Other",
];

const TYPE_COLORS: Record<string, string> = {
  Gas: "bg-orange-100 text-orange-800",
  Water: "bg-blue-100 text-blue-800",
  Electric: "bg-yellow-100 text-yellow-800",
  Sewer: "bg-gray-100 text-gray-800",
  Internet: "bg-purple-100 text-purple-800",
  HVAC: "bg-cyan-100 text-cyan-800",
  Sprinkler: "bg-green-100 text-green-800",
  Other: "bg-gray-100 text-gray-800",
};

export default async function EmergencyUtilitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [rooms, shutoffs] = await Promise.all([
    prisma.room.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.utilityShutoff.findMany({
      where: { householdId },
      include: { room: true },
      orderBy: [{ utilityType: "asc" }, { location: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Utility Shutoff Locations</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add Shutoff Location</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUtilityShutoffAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
            <div className="space-y-1">
              <Label>Utility Type</Label>
              <Select name="utilityType" defaultValue="Water">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UTILITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input name="location" placeholder="e.g. Basement, near water heater" required />
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
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <Label>Procedure</Label>
              <Textarea name="procedure" placeholder="Step-by-step instructions to shut off" rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Tools Needed</Label>
              <Input name="toolsNeeded" placeholder="e.g. Wrench, key" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input name="notes" placeholder="Additional details" />
            </div>
            <Button type="submit">
              <Plus className="size-4 mr-2" />Add Shutoff
            </Button>
          </form>
        </CardContent>
      </Card>

      {shutoffs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Zap className="size-10 mx-auto mb-3 opacity-40" />
            <p>No utility shutoff locations recorded. Document where and how to shut off gas, water, and electric.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shutoffs.map((shutoff) => (
            <Card key={shutoff.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={TYPE_COLORS[shutoff.utilityType] || TYPE_COLORS.Other}>
                        {shutoff.utilityType}
                      </Badge>
                    </div>
                    <p className="font-medium">{shutoff.location}</p>
                    {shutoff.room && (
                      <p className="text-sm text-muted-foreground">Room: {shutoff.room.name}</p>
                    )}
                  </div>
                  <form action={deleteUtilityShutoffAction}>
                    <input type="hidden" name="id" value={shutoff.id} />
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" title="Delete">
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {shutoff.procedure && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Procedure</p>
                    <p className="text-sm whitespace-pre-wrap">{shutoff.procedure}</p>
                  </div>
                )}
                {shutoff.toolsNeeded && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Tools Needed</p>
                    <p className="text-sm">{shutoff.toolsNeeded}</p>
                  </div>
                )}
                {shutoff.notes && (
                  <p className="text-sm text-muted-foreground italic">{shutoff.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
