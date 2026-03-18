import Link from "next/link";
import { getUsers, getUserCounts } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserCheck, UserX, Shield, Lock, Home } from "lucide-react";
import { createMemberAction } from "../members/actions";

export default async function DashboardPage() {
  const [counts, users, householdCount, recentHouseholds] = await Promise.all([
    getUserCounts(),
    getUsers(),
    prisma.household.count(),
    prisma.household.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        members: { select: { id: true } },
      },
    }),
  ]);

  const recentUsers = users.slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">With Password</CardTitle>
            <Lock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.withPassword}</div>
            <p className="text-xs text-muted-foreground">of {counts.total} users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Households</CardTitle>
            <Home className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{householdCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Users</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/members">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <Link
                    key={user.id}
                    href={`/members/${user.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!user.active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                      <Badge variant={user.role === "ADMIN" ? "default" : "outline"} className="text-xs">
                        {user.role === "ADMIN" && <Shield className="size-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Households */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Households</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/households">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentHouseholds.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No households yet</p>
            ) : (
              <div className="space-y-3">
                {recentHouseholds.map((household) => (
                  <Link
                    key={household.id}
                    href={`/households/${household.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Home className="size-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{household.name}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {household.members.length} {household.members.length === 1 ? "member" : "members"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Add */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Add User</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createMemberAction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="quick-name">Name</Label>
                <Input id="quick-name" name="name" required placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-email">Email</Label>
                <Input id="quick-email" name="email" type="email" required placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-role">Role</Label>
                <select
                  id="quick-role"
                  name="role"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue="MEMBER"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                </select>
              </div>
              <Button type="submit" className="w-full">Add User</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
