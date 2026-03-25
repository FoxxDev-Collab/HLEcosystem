import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Plus, Users, ArrowRight } from "lucide-react";
import { CreateHouseholdForm } from "./create-form";

export default async function HouseholdsPage() {
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get("hub_user_id")?.value ?? null;

  const [households, availableUsers] = await Promise.all([
    prisma.household.findMany({
      include: {
        members: { select: { id: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { active: true, ...(currentUserId ? { id: { not: currentUserId } } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Households</h1>
        <p className="text-muted-foreground text-sm">
          {households.length} household{households.length !== 1 ? "s" : ""} &middot;{" "}
          {households.reduce((sum, h) => sum + h.members.length, 0)} total members
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column — household list */}
        <div className="min-w-0">
          {households.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Home className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No households yet. Create your first household.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {households.map((household) => (
                <Link key={household.id} href={`/households/${household.id}`}>
                  <Card className="person-card cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <Home className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{household.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              <Users className="size-2.5 mr-1" />
                              {household.members.length} {household.members.length === 1 ? "member" : "members"}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            Created {household.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column — create form */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="size-4" />
                Create Household
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CreateHouseholdForm availableUsers={availableUsers} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
