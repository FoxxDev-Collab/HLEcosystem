import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Copy, Plus } from "lucide-react"
import {
  createProjectFn,
  duplicateProjectFn,
  getBudgetPlannerPageFn,
} from "@/server/finance/fns.budget-planner"
import type { BudgetPlannerProjectStatus } from "@/server/finance/budget-planner"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

export const Route = createFileRoute("/_authed/finance/budget-planner/")({
  loader: () => getBudgetPlannerPageFn(),
  component: BudgetPlannerPage,
})

const STATUS_COLORS: Record<BudgetPlannerProjectStatus, string> = {
  PLANNING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-400",
}

function BudgetPlannerPage() {
  const { projects, availableFunds } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const activeProjects = projects.filter(
    (p) => p.status === "ACTIVE" || p.status === "PLANNING"
  )
  const totalPlannedCost = activeProjects.reduce(
    (sum, p) => sum + p.totalCost,
    0
  )
  const totalPurchased = activeProjects.reduce(
    (sum, p) => sum + p.purchasedCost,
    0
  )
  const totalRemaining = totalPlannedCost - totalPurchased

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const f = new FormData(e.currentTarget)
    try {
      const result = await createProjectFn({
        data: {
          name: String(f.get("name") ?? ""),
          description: String(f.get("description") ?? ""),
          targetDate: String(f.get("targetDate") ?? "") || null,
          color: "#6366f1",
        },
      })
      if ("newProjectId" in result) {
        navigate({
          to: "/finance/budget-planner/$id",
          params: { id: result.newProjectId },
        })
        return
      }
      setPending(false)
    } catch {
      setError("Could not create project.")
      setPending(false)
    }
  }

  async function onDuplicate(id: string) {
    setError(null)
    try {
      const result = await duplicateProjectFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      if ("newProjectId" in result) {
        navigate({
          to: "/finance/budget-planner/$id",
          params: { id: result.newProjectId },
        })
      }
    } catch {
      setError("Could not duplicate project.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Budget Planner</h1>
        <p className="text-sm text-muted-foreground">
          Plan one-off purchases and projects with line items
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {activeProjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Available Funds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(availableFunds)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Planned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalPlannedCost)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Already Purchased</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPurchased)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Remaining to Buy</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  totalRemaining > availableFunds ? "text-red-600" : ""
                }`}
              >
                {formatCurrency(totalRemaining)}
              </div>
              {totalRemaining > availableFunds && (
                <p className="mt-1 text-xs text-red-500">
                  {formatCurrency(totalRemaining - availableFunds)} short
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onCreate}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1">
              <Label htmlFor="proj-name">Project Name</Label>
              <Input
                id="proj-name"
                name="name"
                placeholder="e.g. Kitchen Renovation"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-description">Description</Label>
              <Input
                id="proj-description"
                name="description"
                placeholder="Optional details"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-targetDate">Target Date</Label>
              <Input id="proj-targetDate" name="targetDate" type="date" />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" />
              {pending ? "Creating…" : "Create Project"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No projects yet. Create one to start planning.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const progressPercent =
              project.totalCost > 0
                ? (project.purchasedCost / project.totalCost) * 100
                : 0

            return (
              <Card
                key={project.id}
                className="h-full transition-colors hover:bg-accent/30"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to="/finance/budget-planner/$id"
                      params={{ id: project.id }}
                    >
                      <CardTitle className="cursor-pointer text-base hover:underline">
                        {project.name}
                      </CardTitle>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Badge className={STATUS_COLORS[project.status]}>
                        {project.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Duplicate"
                        onClick={() => onDuplicate(project.id)}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-bold tabular-nums">
                    {formatCurrency(project.totalCost)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {project.purchasedCount}/{project.itemCount} items purchased
                    · {formatCurrency(project.purchasedCost)} spent
                  </div>
                  {project.totalCost > 0 && (
                    <Progress value={Math.min(progressPercent, 100)} />
                  )}
                  {project.targetDate && (
                    <div className="text-xs text-muted-foreground">
                      Target: {formatDate(project.targetDate)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
