import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserById, getUserByIdWithPassword } from "@/lib/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Shield, Lock, LockOpen, Trash2 } from "lucide-react";
import {
  updateMemberAction,
  toggleActiveAction,
  setPasswordAction,
  removePasswordAction,
  deleteMemberAction,
} from "../actions";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const fullUser = await getUserByIdWithPassword(id);
  const hasPassword = !!fullUser?.password;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/members">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
        <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
          {user.role === "ADMIN" && <Shield className="size-3 mr-1" />}
          {user.role}
        </Badge>
        {!user.active && <Badge variant="secondary">Inactive</Badge>}
      </div>

      {/* Edit User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateMemberAction} className="space-y-4">
            <input type="hidden" name="id" value={user.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" name="name" required defaultValue={user.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" name="email" type="email" required defaultValue={user.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <select
                  id="edit-role"
                  name="role"
                  defaultValue={user.role}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-avatar">Avatar URL</Label>
                <Input
                  id="edit-avatar"
                  name="avatar"
                  defaultValue={user.avatar ?? ""}
                  placeholder="https://..."
                />
              </div>
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {hasPassword ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPassword ? (
            <>
              <p className="text-sm text-muted-foreground">
                This user has a password set. They must enter it when logging in.
              </p>
              <form action={setPasswordAction} className="flex gap-2 items-end">
                <input type="hidden" name="id" value={user.id} />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter new password"
                  />
                </div>
                <Button type="submit" variant="outline">Change Password</Button>
              </form>
              <Separator />
              <form action={removePasswordAction}>
                <input type="hidden" name="id" value={user.id} />
                <Button type="submit" variant="ghost" className="text-destructive">
                  Remove Password
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This user has no password. They can log in with a single click.
              </p>
              <form action={setPasswordAction} className="flex gap-2 items-end">
                <input type="hidden" name="id" value={user.id} />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="set-password">Set Password</Label>
                  <Input
                    id="set-password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter password"
                  />
                </div>
                <Button type="submit" variant="outline">Set Password</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* Status & Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active Status</p>
              <p className="text-sm text-muted-foreground">
                {user.active
                  ? "This user can log in and is visible across apps."
                  : "This user is deactivated and cannot log in."}
              </p>
            </div>
            <form action={toggleActiveAction}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="active" value={String(user.active)} />
              <Button type="submit" variant={user.active ? "outline" : "default"} size="sm">
                {user.active ? "Deactivate" : "Activate"}
              </Button>
            </form>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-destructive">Danger Zone</p>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete this user. This cannot be undone.
            </p>
            <form action={deleteMemberAction}>
              <input type="hidden" name="id" value={user.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-4 mr-1" />
                Delete User
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        <p>Created: {user.createdAt.toLocaleDateString()}</p>
        <p>Updated: {user.updatedAt.toLocaleDateString()}</p>
      </div>
    </div>
  );
}
