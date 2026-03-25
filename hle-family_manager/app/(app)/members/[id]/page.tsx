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
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/members">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight leading-none">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
            {user.role === "ADMIN" && <Shield className="size-3 mr-1" />}
            {user.role}
          </Badge>
          {!user.active && <Badge variant="secondary">Inactive</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column — edit form */}
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Edit Profile</CardTitle>
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
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {hasPassword ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {hasPassword
                  ? "This user has a password set. They must enter it when logging in."
                  : "This user has no password. They can log in with a single click."}
              </p>
              <form action={setPasswordAction} className="flex gap-2 items-end">
                <input type="hidden" name="id" value={user.id} />
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="new-password" className="text-xs">
                    {hasPassword ? "New Password" : "Set Password"}
                  </Label>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    required
                    placeholder={hasPassword ? "Enter new password" : "Enter password"}
                    className="h-9"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" className="h-9">
                  {hasPassword ? "Change" : "Set"}
                </Button>
              </form>
              {hasPassword && (
                <form action={removePasswordAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive text-xs h-8">
                    Remove Password
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — status + danger zone */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-0.5">Active Status</p>
                <p className="text-[10px] text-muted-foreground">
                  {user.active
                    ? "Can log in and is visible across apps."
                    : "Deactivated and cannot log in."}
                </p>
              </div>
              <form action={toggleActiveAction}>
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="active" value={String(user.active)} />
                <Button type="submit" variant={user.active ? "outline" : "default"} size="sm" className="w-full h-8 text-xs">
                  {user.active ? "Deactivate User" : "Activate User"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Created</span>
                <span>{user.createdAt.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Updated</span>
                <span>{user.updatedAt.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Password</span>
                <Badge variant={hasPassword ? "default" : "secondary"} className="text-[9px]">
                  {hasPassword ? "Set" : "None"}
                </Badge>
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
                Permanently delete this user. This cannot be undone.
              </p>
              <form action={deleteMemberAction}>
                <input type="hidden" name="id" value={user.id} />
                <Button type="submit" variant="destructive" size="sm" className="w-full h-8 text-xs">
                  <Trash2 className="size-3 mr-1.5" />
                  Delete User
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
