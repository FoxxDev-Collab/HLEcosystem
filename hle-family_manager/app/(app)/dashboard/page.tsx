import Link from "next/link";
import { getUsers, getUserCounts } from "@/lib/users";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Home,
  ArrowRight,
  Clock,
  Plus,
  Lock,
} from "lucide-react";
import { createMemberAction } from "../members/actions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
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

  const recentUsers = users.slice(0, 8);

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.name.split(" ")[0] ?? "Admin"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="stat-card-accent" style={{ "--stat-color": "var(--primary)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Total Users</span>
              <Users className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{counts.total}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">registered accounts</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.16 145)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Active</span>
              <UserCheck className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{counts.active}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">can sign in</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.2 25)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Inactive</span>
              <UserX className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{counts.inactive}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">disabled accounts</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.55 0.14 260)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">With Password</span>
              <Lock className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{counts.withPassword}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">of {counts.total} users</p>
          </CardContent>
        </Card>
        <Card className="stat-card-accent" style={{ "--stat-color": "oklch(0.65 0.16 80)" } as React.CSSProperties}>
          <CardContent className="pt-4 pb-3 px-4 pl-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Households</span>
              <Home className="size-3.5 text-muted-foreground/50" />
            </div>
            <div className="text-xl font-bold tabular-nums">{householdCount}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">family groups</p>
          </CardContent>
        </Card>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left column — main content */}
        <div className="space-y-6 min-w-0">
          {/* Recent Users */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent Users</h2>
              </div>
              <Link
                href="/members"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {recentUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No users yet. Create your first user to get started.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentUsers.map((u) => (
                      <Link
                        key={u.id}
                        href={`/members/${u.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {!u.active && (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                          )}
                          <Badge
                            variant={u.role === "ADMIN" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {u.role === "ADMIN" && <Shield className="size-2.5 mr-1" />}
                            {u.role}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Recent Households */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Home className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Households</h2>
              </div>
              <Link
                href="/households"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {recentHouseholds.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No households yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recentHouseholds.map((household) => (
                      <Link
                        key={household.id}
                        href={`/households/${household.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Home className="size-3.5" />
                          </div>
                          <span className="text-sm font-medium">{household.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {household.members.length} {household.members.length === 1 ? "member" : "members"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* System overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">System Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Link
                href="/members"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  <span>Users</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{counts.total}</span>
              </Link>
              <Link
                href="/members?filter=admin"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Shield className="size-4 text-muted-foreground" />
                  <span>Admins</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{counts.admins}</span>
              </Link>
              <Link
                href="/households"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Home className="size-4 text-muted-foreground" />
                  <span>Households</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{householdCount}</span>
              </Link>
              <Link
                href="/members?filter=password"
                className="flex items-center justify-between py-1 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Lock className="size-4 text-muted-foreground" />
                  <span>With Password</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{counts.withPassword}</span>
              </Link>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link
                href="/members"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <Plus className="size-3.5" />
                Add user
              </Link>
              <Link
                href="/households"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <Home className="size-3.5" />
                Create household
              </Link>
              <Link
                href="/security"
                className="flex items-center gap-2.5 text-xs py-1.5 hover:text-primary transition-colors"
              >
                <Shield className="size-3.5" />
                Security settings
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
