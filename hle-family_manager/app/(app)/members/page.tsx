import Link from "next/link";
import { getUsers } from "@/lib/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, ArrowRight } from "lucide-react";
import { createMemberAction, toggleActiveAction } from "./actions";

export default async function MembersPage() {
  const users = await getUsers();
  const activeCount = users.filter((u) => u.active).length;

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          {users.length} user{users.length !== 1 ? "s" : ""} &middot; {activeCount} active
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column — user list */}
        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No members yet. Add your first family member.
                </p>
              ) : (
                <div className="divide-y">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                    >
                      <Link
                        href={`/members/${user.id}`}
                        className="flex items-center gap-3 min-w-0 flex-1"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {!user.active && (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                        <Badge
                          variant={user.role === "ADMIN" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {user.role === "ADMIN" && <Shield className="size-2.5 mr-1" />}
                          {user.role}
                        </Badge>
                        <form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="active" value={String(user.active)} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                          >
                            {user.active ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                        <Link href={`/members/${user.id}`}>
                          <ArrowRight className="size-3.5 text-muted-foreground" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — create form */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserPlus className="size-4" />
                Add User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createMemberAction} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-name" className="text-xs">Name</Label>
                  <Input id="create-name" name="name" required placeholder="Full name" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-email" className="text-xs">Email</Label>
                  <Input id="create-email" name="email" type="email" required placeholder="email@example.com" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-password" className="text-xs">Password</Label>
                  <Input id="create-password" name="password" type="password" placeholder="Optional" className="h-9" />
                </div>
                <div className="space-y-1.5">
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
                <Button type="submit" className="w-full h-9">
                  <UserPlus className="size-4 mr-1.5" />
                  Add User
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
