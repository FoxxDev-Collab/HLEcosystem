import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2, UserPlus, Home } from "lucide-react";
import {
  updateHouseholdAction,
  deleteHouseholdAction,
  addMemberAction,
  updateMemberRoleAction,
  updateMemberRelationshipAction,
  removeMemberAction,
} from "../actions";

const FAMILY_RELATIONSHIPS = [
  "Spouse", "Partner", "Child", "Parent", "Sibling",
  "Grandparent", "Grandchild", "AuntUncle", "NieceNephew",
  "Cousin", "InLaw", "StepParent", "StepChild", "StepSibling",
  "Godparent", "Godchild", "Friend", "Other",
];

function formatRelationship(rel: string): string {
  const labels: Record<string, string> = {
    AuntUncle: "Aunt / Uncle",
    NieceNephew: "Niece / Nephew",
    InLaw: "In-Law",
    StepParent: "Step-Parent",
    StepChild: "Step-Child",
    StepSibling: "Step-Sibling",
    Grandparent: "Grandparent",
    Grandchild: "Grandchild",
  };
  return labels[rel] ?? rel;
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/households">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Home className="size-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">{household.name}</h1>
      </div>

      {/* Edit Household Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateHouseholdAction} className="flex gap-3 items-end">
            <input type="hidden" name="id" value={household.id} />
            <div className="space-y-2 flex-1">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" name="name" required defaultValue={household.name} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Members ({household.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {household.members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No members</p>
          ) : (
            <div className="divide-y">
              {household.members.map((member) => (
                <div
                  key={member.id}
                  className="py-3 first:pt-0 last:pb-0 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {member.displayName}
                        {member.familyRelationship && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {formatRelationship(member.familyRelationship)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.user.email} &middot; Joined {member.joinedAt.toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={updateMemberRelationshipAction} className="flex items-center gap-1">
                        <input type="hidden" name="memberId" value={member.id} />
                        <input type="hidden" name="householdId" value={household.id} />
                        <select
                          name="familyRelationship"
                          defaultValue={member.familyRelationship ?? ""}
                          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">Relationship...</option>
                          {FAMILY_RELATIONSHIPS.map((r) => (
                            <option key={r} value={r}>{formatRelationship(r)}</option>
                          ))}
                        </select>
                        <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs px-2">
                          Set
                        </Button>
                      </form>
                      <form action={updateMemberRoleAction} className="flex items-center gap-1">
                        <input type="hidden" name="memberId" value={member.id} />
                        <input type="hidden" name="householdId" value={household.id} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                        <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs px-2">
                          Update
                        </Button>
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="memberId" value={member.id} />
                        <input type="hidden" name="householdId" value={household.id} />
                        <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs text-destructive px-2">
                          Remove
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Member */}
      {availableUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="size-4" />
              Add Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addMemberAction} className="flex flex-wrap gap-3 items-end">
              <input type="hidden" name="householdId" value={household.id} />
              <div className="space-y-1 flex-1 min-w-[150px]">
                <Label htmlFor="add-user" className="text-xs">User</Label>
                <select
                  id="add-user"
                  name="userId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 min-w-[120px]">
                <Label htmlFor="add-displayName" className="text-xs">Display Name</Label>
                <Input
                  id="add-displayName"
                  name="displayName"
                  required
                  placeholder="Display name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1 min-w-[130px]">
                <Label htmlFor="add-relationship" className="text-xs">Relationship</Label>
                <select
                  id="add-relationship"
                  name="familyRelationship"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Not specified</option>
                  {FAMILY_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>{formatRelationship(r)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 min-w-[100px]">
                <Label htmlFor="add-role" className="text-xs">Role</Label>
                <select
                  id="add-role"
                  name="role"
                  defaultValue="MEMBER"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <Button type="submit" size="sm" className="h-9">
                <UserPlus className="size-4 mr-1" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete this household and all its memberships. This cannot be undone.
            </p>
            <form action={deleteHouseholdAction}>
              <input type="hidden" name="id" value={household.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-4 mr-1" />
                Delete Household
              </Button>
            </form>
          </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        <p>Created: {household.createdAt.toLocaleDateString()}</p>
        <p>Updated: {household.updatedAt.toLocaleDateString()}</p>
      </div>
    </div>
  );
}
