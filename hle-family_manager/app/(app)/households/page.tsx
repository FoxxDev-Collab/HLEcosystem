import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Plus, Users } from "lucide-react";
import { CreateHouseholdForm } from "./create-form";

export default async function HouseholdsPage() {
  const households = await prisma.household.findMany({
    include: {
      members: { select: { id: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Households</h1>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" />
            Create Household
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreateHouseholdForm />
        </CardContent>
      </Card>

      {/* Household List */}
      <Card>
        <CardHeader>
          <CardTitle>All Households ({households.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {households.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No households yet. Create your first household above.
            </p>
          ) : (
            <div className="divide-y">
              {households.map((household) => (
                <Link
                  key={household.id}
                  href={`/households/${household.id}`}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-accent/50 px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Home className="size-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{household.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Users className="size-3 mr-1" />
                      {household.members.length} {household.members.length === 1 ? "member" : "members"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {household.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
