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
import {
  Plus,
  Trash2,
  Power,
  UserPlus,
  UserMinus,
  ListChecks,
} from "lucide-react";
import { ChoreAssigneePicker } from "@/components/chore-assignee-picker";
import {
  createChoreAction,
  deleteChoreAction,
  toggleChoreActiveAction,
  addChoreAssignmentAction,
  removeChoreAssignmentAction,
} from "../actions";

type HouseholdMember = {
  id: string;
  displayName: string;
};

const FREQUENCIES = ["DAILY", "WEEKLY", "BI_WEEKLY", "MONTHLY", "CUSTOM_DAYS"];
const ROTATION_MODES = ["NONE", "ROUND_ROBIN", "WEEKLY_ROTATION"];

function formatFrequencyLabel(f: string): string {
  switch (f) {
    case "DAILY": return "Daily";
    case "WEEKLY": return "Weekly";
    case "BI_WEEKLY": return "Every 2 Weeks";
    case "MONTHLY": return "Monthly";
    case "CUSTOM_DAYS": return "Custom Days";
    default: return f;
  }
}

function formatRotationLabel(r: string): string {
  switch (r) {
    case "NONE": return "None";
    case "ROUND_ROBIN": return "Round Robin";
    case "WEEKLY_ROTATION": return "Weekly Rotation";
    default: return r;
  }
}

export default async function ManageChoresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [chores, rooms, members] = await Promise.all([
    prisma.chore.findMany({
      where: { householdId },
      include: {
        room: { select: { name: true } },
        assignments: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ isActive: "desc" }, { title: "asc" }],
    }),
    prisma.room.findMany({
      where: { householdId },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<HouseholdMember[]>`
      SELECT hm."id", hm."displayName"
      FROM family_manager."HouseholdMember" hm
      WHERE hm."householdId" = ${householdId}
      ORDER BY hm."displayName"
    `,
  ]);

  const activeChores = chores.filter((c) => c.isActive);
  const inactiveChores = chores.filter((c) => !c.isActive);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Manage Chores</h1>

      {/* Create Chore Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Chore</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createChoreAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input name="title" placeholder="e.g. Vacuum Living Room" required />
              </div>
              <div className="space-y-1">
                <Label>Room</Label>
                <Select name="roomId">
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select name="frequency" defaultValue="WEEKLY">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {formatFrequencyLabel(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rotation Mode</Label>
                <Select name="rotationMode" defaultValue="NONE">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROTATION_MODES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {formatRotationLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Point Value</Label>
                <Input
                  name="pointValue"
                  type="number"
                  min="0"
                  defaultValue="0"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Est. Minutes</Label>
                <Input
                  name="estimatedMinutes"
                  type="number"
                  min="1"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                name="description"
                placeholder="Optional instructions or details"
                rows={2}
              />
            </div>

            <ChoreAssigneePicker members={members} />

            <Button type="submit">
              <Plus className="size-4 mr-2" />
              Add Chore
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Chore List */}
      {chores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListChecks className="size-10 mx-auto mb-3 opacity-40" />
            <p>No chores defined yet. Create one above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeChores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Chores ({activeChores.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ChoreTable
                  chores={activeChores}
                  members={members}
                  householdId={householdId}
                />
              </CardContent>
            </Card>
          )}

          {inactiveChores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  Inactive Chores ({inactiveChores.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="opacity-60">
                <ChoreTable
                  chores={inactiveChores}
                  members={members}
                  householdId={householdId}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ChoreTable({
  chores,
  members,
  householdId,
}: {
  chores: {
    id: string;
    title: string;
    description: string | null;
    frequency: string;
    rotationMode: string;
    pointValue: number;
    estimatedMinutes: number | null;
    isActive: boolean;
    room: { name: string } | null;
    assignments: {
      id: string;
      assigneeId: string;
      assigneeName: string;
      sortOrder: number;
    }[];
  }[];
  members: HouseholdMember[];
  householdId: string;
}) {
  return (
    <div className="space-y-4">
      {chores.map((chore) => {
        const assignedIds = new Set(chore.assignments.map((a) => a.assigneeId));
        const availableMembers = members.filter((m) => !assignedIds.has(m.id));

        return (
          <div key={chore.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{chore.title}</h3>
                {chore.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {chore.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge variant="outline">{formatFrequencyLabel(chore.frequency)}</Badge>
                  {chore.room && (
                    <Badge variant="secondary">{chore.room.name}</Badge>
                  )}
                  {chore.pointValue > 0 && (
                    <Badge variant="secondary">{chore.pointValue} pts</Badge>
                  )}
                  {chore.estimatedMinutes && (
                    <Badge variant="secondary">{chore.estimatedMinutes} min</Badge>
                  )}
                  {chore.rotationMode !== "NONE" && (
                    <Badge variant="outline">
                      {formatRotationLabel(chore.rotationMode)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <form action={toggleChoreActiveAction}>
                  <input type="hidden" name="id" value={chore.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={chore.isActive ? "Deactivate" : "Activate"}
                  >
                    <Power
                      className={`size-3.5 ${chore.isActive ? "text-green-600" : "text-gray-400"}`}
                    />
                  </Button>
                </form>
                <form action={deleteChoreAction}>
                  <input type="hidden" name="id" value={chore.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5 text-red-500" />
                  </Button>
                </form>
              </div>
            </div>

            {/* Assignments */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assigned Members
              </div>
              {chore.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {chore.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                    >
                      <span>{a.assigneeName}</span>
                      <form action={removeChoreAssignmentAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                          title="Remove"
                        >
                          <UserMinus className="size-3 text-red-500" />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              {/* Add assignment */}
              {availableMembers.length > 0 && (
                <div className="flex items-center gap-2">
                  {availableMembers.map((m) => (
                    <form key={m.id} action={addChoreAssignmentAction}>
                      <input type="hidden" name="choreId" value={chore.id} />
                      <input type="hidden" name="assigneeId" value={m.id} />
                      <input type="hidden" name="assigneeName" value={m.displayName} />
                      <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                        <UserPlus className="size-3 mr-1" />
                        {m.displayName}
                      </Button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
