import { useState } from "react"
import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { Award, Plus, Trash2, Trophy } from "lucide-react"
import {
  createActivityFn,
  deleteActivityFn,
  getActivitiesPageFn,
} from "@/server/hub/fns.education"
import type { ActivityCategory } from "@/server/hub/education"
import { formatCurrency, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute("/_authed/hub/education/activities")({
  loader: () => getActivitiesPageFn(),
  component: ActivitiesPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const ACTIVITY_CATEGORIES: Array<{ value: ActivityCategory; label: string }> = [
  { value: "SPORTS", label: "Sports" },
  { value: "ARTS", label: "Arts" },
  { value: "MUSIC", label: "Music" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "CLUB", label: "Club" },
  { value: "RELIGIOUS", label: "Religious" },
  { value: "OTHER", label: "Other" },
]

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  SPORTS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  ARTS: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  MUSIC: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ACADEMIC:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  VOLUNTEER:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  CLUB: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  RELIGIOUS:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

function categoryLabel(category: ActivityCategory): string {
  return (
    ACTIVITY_CATEGORIES.find((c) => c.value === category)?.label ?? category
  )
}

function str(f: FormData, key: string): string | null {
  const v = f.get(key)
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function num(f: FormData, key: string): number | null {
  const v = f.get(key)
  if (typeof v !== "string" || !v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function ActivitiesPage() {
  const { members, activities, achievements } = Route.useLoaderData()
  const router = useRouter()
  const [filterMemberId, setFilterMemberId] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    label: string
  } | null>(null)

  function refresh() {
    router.invalidate()
  }

  const filtered = activities.filter(
    (a) =>
      (!filterMemberId || a.familyMemberId === filterMemberId) &&
      (!filterCategory || a.category === filterCategory)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Activities</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} activit{filtered.length !== 1 ? "ies" : "y"} across
          the family.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="filter-member" className="text-xs">
                Member
              </Label>
              <select
                id="filter-member"
                className={selectClass}
                value={filterMemberId}
                onChange={(e) => setFilterMemberId(e.target.value)}
              >
                <option value="">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-category" className="text-xs">
                Category
              </Label>
              <select
                id="filter-category"
                className={selectClass}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {(filterMemberId || filterCategory) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterMemberId("")
                  setFilterCategory("")
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: activity list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No activities found.
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((activity) => {
              const activityAchievements = achievements.filter(
                (a) => a.activityId === activity.id
              )
              return (
                <Card
                  key={activity.id}
                  className={activity.isCurrent ? "" : "opacity-70"}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge
                            className={`text-[9px] ${CATEGORY_COLORS[activity.category]}`}
                          >
                            {categoryLabel(activity.category)}
                          </Badge>
                          {activity.isCurrent && (
                            <Badge variant="default" className="text-[9px]">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold">{activity.name}</p>
                        <Link
                          to="/hub/education/$memberId"
                          params={{ memberId: activity.familyMemberId }}
                          className="text-xs text-primary hover:underline"
                        >
                          {activity.firstName} {activity.lastName}
                        </Link>
                        {activity.organization && (
                          <p className="text-xs text-muted-foreground">
                            {activity.organization}
                          </p>
                        )}
                        {activity.schedule && (
                          <p className="text-xs text-muted-foreground">
                            {activity.schedule}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          {(activity.startDate || activity.endDate) && (
                            <p className="text-[10px] text-muted-foreground">
                              {activity.startDate &&
                                formatDate(activity.startDate)}
                              {activity.startDate && activity.endDate && " - "}
                              {activity.endDate && formatDate(activity.endDate)}
                            </p>
                          )}
                          {activity.cost !== null && (
                            <Badge variant="secondary" className="text-[9px]">
                              {formatCurrency(activity.cost)}
                            </Badge>
                          )}
                        </div>
                        {activity.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {activity.notes}
                          </p>
                        )}
                        {activityAchievements.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activityAchievements.map((ach) => (
                              <Badge
                                key={ach.id}
                                variant="outline"
                                className="text-[9px]"
                              >
                                <Award className="mr-0.5 size-2.5" />
                                {ach.title}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete activity"
                        onClick={() =>
                          setDeleteTarget({
                            id: activity.id,
                            label: activity.name,
                          })
                        }
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Right: add form */}
        <div>
          <AddActivityForm members={members} onSaved={refresh} />
        </div>
      </div>

      {deleteTarget && (
        <DeleteActivityDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function AddActivityForm({
  members,
  onSaved,
}: {
  members: Array<{ id: string; firstName: string; lastName: string }>
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isCurrent, setIsCurrent] = useState(true)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const result = await createActivityFn({
        data: {
          familyMemberId: String(f.get("familyMemberId") ?? ""),
          name: String(f.get("name") ?? ""),
          category: String(f.get("category") ?? "OTHER") as ActivityCategory,
          organization: str(f, "organization"),
          startDate: str(f, "startDate"),
          endDate: str(f, "endDate"),
          isCurrent,
          schedule: str(f, "schedule"),
          cost: num(f, "cost"),
          notes: str(f, "notes"),
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setIsCurrent(true)
      setPending(false)
      onSaved()
    } catch {
      setError("Could not add activity.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="size-4" />
          Add Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="na-member">Family Member *</Label>
            <select
              id="na-member"
              name="familyMemberId"
              required
              className={selectClass}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="na-name">Activity Name *</Label>
              <Input id="na-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="na-category">Category</Label>
              <select
                id="na-category"
                name="category"
                className={selectClass}
                defaultValue="OTHER"
              >
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="na-organization">Organization</Label>
              <Input id="na-organization" name="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="na-schedule">Schedule</Label>
              <Input
                id="na-schedule"
                name="schedule"
                placeholder="e.g. Tue/Thu 4-5pm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="na-startDate">Start Date</Label>
              <Input id="na-startDate" name="startDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="na-endDate">End Date</Label>
              <Input id="na-endDate" name="endDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="na-cost">Cost</Label>
              <Input
                id="na-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="na-isCurrent"
              checked={isCurrent}
              onCheckedChange={(checked) => setIsCurrent(checked === true)}
            />
            <Label htmlFor="na-isCurrent" className="font-normal">
              Currently active
            </Label>
          </div>
          <Textarea name="notes" placeholder="Notes" rows={2} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Adding…" : "Add Activity"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function DeleteActivityDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: { id: string; label: string }
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteActivityFn({ data: { id: target.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete activity.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {target.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Achievements stay but lose their link to this activity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
