import Link from "next/link";
import { getUsers } from "@/lib/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, UserPlus } from "lucide-react";
import { createMemberAction, toggleActiveAction } from "./actions";

export default async function MembersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Family Members</h1>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="size-4" />
            Add New Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createMemberAction} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[150px]">
              <Label htmlFor="create-name" className="text-xs">Name</Label>
              <Input id="create-name" name="name" required placeholder="Full name" className="h-9" />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <Label htmlFor="create-email" className="text-xs">Email</Label>
              <Input id="create-email" name="email" type="email" required placeholder="email@example.com" className="h-9" />
            </div>
            <div className="space-y-1 min-w-[100px]">
              <Label htmlFor="create-password" className="text-xs">Password</Label>
              <Input id="create-password" name="password" type="password" placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1 min-w-[100px]">
              <Label htmlFor="create-role" className="text-xs">Role</Label>
              <select
                id="create-role"
                name="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue="MEMBER"
              >
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
              </select>
            </div>
            <Button type="submit" size="sm" className="h-9">
              <UserPlus className="size-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>All Members ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No members yet. Add your first family member above.
            </p>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/members/${user.id}`}
                    className="flex-1 hover:underline"
                  >
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </Link>
                  <div className="flex items-center gap-2">
                    {"hasPassword" in user ? null : null}
                    <Badge variant={user.role === "ADMIN" ? "default" : "outline"} className="text-xs">
                      {user.role === "ADMIN" && <Shield className="size-3 mr-1" />}
                      {user.role}
                    </Badge>
                    {!user.active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                    <form action={toggleActiveAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="active" value={String(user.active)} />
                      <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">
                        {user.active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
