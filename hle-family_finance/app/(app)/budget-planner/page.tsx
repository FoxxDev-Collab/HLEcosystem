import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentHouseholdId } from "@/lib/household";
import prisma from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Copy } from "lucide-react";
import { createProjectAction, duplicateProjectAction } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default async function BudgetPlannerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/setup");

  const [projects, accounts] = await Promise.all([
    prisma.budgetPlannerProject.findMany({
      where: { householdId },
      include: {
        items: true,
        _count: { select: { items: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.account.findMany({
      where: { householdId, isArchived: false },
      select: { currentBalance: true },
    }),
  ]);

  // Affordability summary
  const totalAvailable = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const activeProjects = projects.filter((p) => p.status === "ACTIVE" || p.status === "PLANNING");
  const totalPlannedCost = activeProjects.reduce((sum, p) => sum + Number(p.totalCost), 0);
  const totalPurchased = activeProjects.reduce(
    (sum, p) => sum + p.items.filter((i) => i.isPurchased).reduce((s, i) => s + Number(i.lineTotal), 0),
    0
  );
  const totalRemaining = totalPlannedCost - totalPurchased;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Budget Planner</h1>

      {/* Affordability Summary */}
      {activeProjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Available Funds</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalAvailable)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Planned</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalPlannedCost)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Already Purchased</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalPurchased)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Remaining to Buy</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalRemaining > totalAvailable ? "text-red-600" : ""}`}>
                {formatCurrency(totalRemaining)}
              </div>
              {totalRemaining > totalAvailable && (
                <p className="text-xs text-red-500 mt-1">
                  {formatCurrency(totalRemaining - totalAvailable)} short
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Project Form */}
      <Card>
        <CardHeader><CardTitle>New Project</CardTitle></CardHeader>
        <CardContent>
          <form action={createProjectAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1">
              <Label>Project Name</Label>
              <Input name="name" placeholder="e.g. Kitchen Renovation" required />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input name="description" placeholder="Optional details" />
            </div>
            <div className="space-y-1">
              <Label>Target Date</Label>
              <Input name="targetDate" type="date" />
            </div>
            <Button type="submit"><Plus className="size-4 mr-2" />Create Project</Button>
          </form>
        </CardContent>
      </Card>

      {/* Project List */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No projects yet. Create one to start planning.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const purchasedCost = project.items
              .filter((i) => i.isPurchased)
              .reduce((sum, i) => sum + Number(i.lineTotal), 0);
            const purchasedCount = project.items.filter((i) => i.isPurchased).length;
            const progressPercent = Number(project.totalCost) > 0
              ? (purchasedCost / Number(project.totalCost)) * 100
              : 0;

            return (
              <Card key={project.id} className="hover:bg-accent/30 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/budget-planner/${project.id}`}>
                      <CardTitle className="text-base hover:underline cursor-pointer">{project.name}</CardTitle>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Badge className={STATUS_COLORS[project.status]}>{project.status}</Badge>
                      <form action={duplicateProjectAction}>
                        <input type="hidden" name="id" value={project.id} />
                        <Button type="submit" variant="ghost" size="icon" className="h-6 w-6" title="Duplicate">
                          <Copy className="size-3" />
                        </Button>
                      </form>
                    </div>
                  </div>
                  {project.description && <CardDescription className="line-clamp-2">{project.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-bold">{formatCurrency(project.totalCost)}</div>
                  <div className="text-xs text-muted-foreground">
                    {purchasedCount}/{project._count.items} items purchased &middot; {formatCurrency(purchasedCost)} spent
                  </div>
                  {Number(project.totalCost) > 0 && (
                    <Progress value={progressPercent} className="h-1.5" />
                  )}
                  {project.targetDate && (
                    <div className="text-xs text-muted-foreground">
                      Target: {formatDate(project.targetDate)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
