import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2, UserPlus, Home, Users } from "lucide-react";
import {
  updateHouseholdAction,
  deleteHouseholdAction,
  addMemberAction,
  updateMemberRoleAction,
  setMemberRelationshipAction,
  removeMemberAction,
} from "../actions";

function MemberRow({
  member,
  householdId,
  showRoleSelect,
  canSetSpouse,
}: {
  member: {
    id: string;
    displayName: string;
    role: string;
    familyRelationship: string | null;
    user: { email: string };
    joinedAt: Date;
  };
  householdId: string;
  showRoleSelect?: boolean;
  canSetSpouse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{member.displayName}</span>
          {member.familyRelationship && (
            <Badge variant={member.familyRelationship === "Spouse" ? "default" : "secondary"} className="text-[10px]">
              {member.familyRelationship}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {member.user.email} &middot; Joined {member.joinedAt.toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-3">
        {showRoleSelect && (
          <form action={updateMemberRoleAction} className="flex items-center gap-1">
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="householdId" value={householdId} />
            <select
              name="role"
              defaultValue={member.role}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <Button type="submit" variant="ghost" size="sm" className="h-7 text-[10px] px-1.5">
              Set
            </Button>
          </form>
        )}
        {!member.familyRelationship && canSetSpouse && (
          <form action={setMemberRelationshipAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="familyRelationship" value="Spouse" />
            <Button type="submit" variant="outline" size="sm" className="h-7 text-[10px] px-2">
              Spouse
            </Button>
          </form>
        )}
        {!member.familyRelationship && (
          <form action={setMemberRelationshipAction}>
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="familyRelationship" value="Child" />
            <Button type="submit" variant="outline" size="sm" className="h-7 text-[10px] px-2">
              Child
            </Button>
          </form>
        )}
        <form action={removeMemberAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="householdId" value={householdId} />
          <Button type="submit" variant="ghost" size="sm" className="h-7 text-[10px] text-destructive px-1.5">
            Remove
          </Button>
        </form>
      </div>
    </div>
  );
}

export default async function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const household = await prisma.household.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!household) notFound();

  const memberUserIds = new Set(household.members.map((m) => m.userId));
  const availableUsers = await prisma.user.findMany({
    where: {
      active: true,
      id: { notIn: Array.from(memberUserIds) },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const spouses = household.members.filter((m) => m.familyRelationship === "Spouse");
  const children = household.members.filter((m) => m.familyRelationship === "Child");
  const unassigned = household.members.filter((m) => !m.familyRelationship);
  const canAddSpouse = spouses.length < 2;

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/households">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Home className="size-4" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight leading-none">{household.name}</h1>
          <p className="text-sm text-muted-foreground">
            {household.members.length} member{household.members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column — members */}
        <div className="space-y-6 min-w-0">
          {/* Household Name */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Household Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateHouseholdAction} className="flex gap-3 items-end">
                <input type="hidden" name="id" value={household.id} />
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="edit-name" className="text-xs">Name</Label>
                  <Input id="edit-name" name="name" required defaultValue={household.name} className="h-9" />
                </div>
                <Button type="submit" size="sm" className="h-9">Save</Button>
              </form>
            </CardContent>
          </Card>

          {/* Spouses */}
          {spouses.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Spouses ({spouses.length}/2)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {spouses.map((member) => (
                    <MemberRow key={member.id} member={member} householdId={household.id} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Children */}
          {children.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Children ({children.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {children.map((member) => (
                    <MemberRow key={member.id} member={member} householdId={household.id} showRoleSelect />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <Card className="overflow-hidden border-amber-300/50 dark:border-amber-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  Unassigned ({unassigned.length})
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Assign a family role to these members.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {unassigned.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      householdId={household.id}
                      canSetSpouse={canAddSpouse}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — add member + info + danger */}
        <div className="space-y-6">
          {/* Add Member */}
          {availableUsers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="size-4" />
                  Add Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={addMemberAction} className="space-y-3">
                  <input type="hidden" name="householdId" value={household.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor="add-user" className="text-xs">User</Label>
                    <select
                      id="add-user"
                      name="userId"
                      required
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Select user...</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-displayName" className="text-xs">Display Name</Label>
                    <Input id="add-displayName" name="displayName" required placeholder="Display name" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="add-relationship" className="text-xs">Family Role</Label>
                    <select
                      id="add-relationship"
                      name="familyRelationship"
                      defaultValue="Child"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {canAddSpouse && <option value="Spouse">Spouse</option>}
                      <option value="Child">Child</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full h-9">
                    <UserPlus className="size-4 mr-1.5" />
                    Add Member
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Members</span>
                <span className="tabular-nums">{household.members.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Spouses</span>
                <span className="tabular-nums">{spouses.length}/2</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Children</span>
                <span className="tabular-nums">{children.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Created</span>
                <span>{household.createdAt.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Updated</span>
                <span>{household.updatedAt.toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground mb-3">
                Permanently delete this household and all memberships.
              </p>
              <form action={deleteHouseholdAction}>
                <input type="hidden" name="id" value={household.id} />
                <Button type="submit" variant="destructive" size="sm" className="w-full h-8 text-xs">
                  <Trash2 className="size-3 mr-1.5" />
                  Delete Household
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
