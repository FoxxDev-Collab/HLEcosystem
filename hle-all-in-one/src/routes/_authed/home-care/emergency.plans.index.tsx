import { useState } from "react"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Route as RouteIcon,
  Trash2,
} from "lucide-react"
import {
  createEmergencyPlanFn,
  deleteEmergencyPlanFn,
  getEmergencyPlansFn,
  markPlanReviewedFn,
} from "@/server/home-care/fns.emergency"
import type {
  EmergencyPlanRow,
  EmergencyPlanType,
} from "@/server/home-care/emergency"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export const Route = createFileRoute("/_authed/home-care/emergency/plans/")({
  loader: () => getEmergencyPlansFn(),
  component: EmergencyPlansPage,
})

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PLAN_TYPES: Array<EmergencyPlanType> = [
  "FIRE",
  "FLOOD",
  "EARTHQUAKE",
  "TORNADO",
  "HURRICANE",
  "POWER_OUTAGE",
  "MEDICAL",
  "INTRUDER",
  "EVACUATION",
  "CUSTOM",
]

const PLAN_TYPE_COLORS: Record<EmergencyPlanType, string> = {
  FIRE: "bg-red-100 text-red-800",
  FLOOD: "bg-blue-100 text-blue-800",
  EARTHQUAKE: "bg-amber-100 text-amber-800",
  TORNADO: "bg-gray-100 text-gray-800",
  HURRICANE: "bg-cyan-100 text-cyan-800",
  POWER_OUTAGE: "bg-yellow-100 text-yellow-800",
  MEDICAL: "bg-green-100 text-green-800",
  INTRUDER: "bg-purple-100 text-purple-800",
  EVACUATION: "bg-orange-100 text-orange-800",
  CUSTOM: "bg-gray-100 text-gray-800",
}

// Review recommended when never reviewed or reviewed more than 6 months ago.
function needsReview(lastReviewed: string | null): boolean {
  if (!lastReviewed) return true
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const [y, m, d] = lastReviewed.split("-").map(Number)
  return new Date(y, m - 1, d) < sixMonthsAgo
}

function EmergencyPlansPage() {
  const plans = Route.useLoaderData()
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<EmergencyPlanRow | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  async function markReviewed(id: string) {
    setError(null)
    try {
      const result = await markPlanReviewedFn({ data: { id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        return
      }
      router.invalidate()
    } catch {
      setError("Could not mark plan as reviewed.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Emergency Plans</h1>
        <p className="text-sm text-muted-foreground">
          Plans for fire, flood, evacuation, and other scenarios. Review them
          regularly.
        </p>
      </div>

      <CreatePlanCard onSaved={() => router.invalidate()} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RouteIcon className="mx-auto mb-3 size-10 opacity-40" />
            <p>
              No emergency plans yet. Create plans for fire, flood, and other
              scenarios.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const reviewNeeded = needsReview(plan.lastReviewed)
            return (
              <Card
                key={plan.id}
                className={reviewNeeded ? "border-amber-300" : ""}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Link
                        to="/home-care/emergency/plans/$id"
                        params={{ id: plan.id }}
                        className="hover:underline"
                      >
                        <CardTitle className="text-lg">{plan.title}</CardTitle>
                      </Link>
                      <Badge className={PLAN_TYPE_COLORS[plan.type]}>
                        {plan.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Delete"
                      onClick={() => setDeleteTarget(plan)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {reviewNeeded ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="size-3.5" />
                          {plan.lastReviewed
                            ? `Last reviewed ${formatDate(plan.lastReviewed)}`
                            : "Never reviewed"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="size-3.5" />
                          Reviewed {formatDate(plan.lastReviewed)}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markReviewed(plan.id)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Mark Reviewed
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <DeletePlanDialog
          plan={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function CreatePlanCard({ onSaved }: { onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const f = new FormData(form)
    const reviewMonths = String(f.get("reviewFrequencyMonths") ?? "").trim()
    try {
      const result = await createEmergencyPlanFn({
        data: {
          title: String(f.get("title") ?? ""),
          type: String(f.get("type") ?? "FIRE") as EmergencyPlanType,
          description: String(f.get("description") ?? ""),
          meetingPoint: "",
          evacuationRoute: "",
          procedures: "",
          reviewFrequencyMonths: reviewMonths ? Number(reviewMonths) : null,
          notes: "",
        },
      })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      form.reset()
      setPending(false)
      onSaved()
    } catch {
      setError("Could not create plan.")
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="ep-title">Plan Title</Label>
            <Input
              id="ep-title"
              name="title"
              placeholder="e.g. House Fire Escape Plan"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-type">Type</Label>
            <select
              id="ep-type"
              name="type"
              className={selectClass}
              defaultValue="FIRE"
            >
              {PLAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-description">Description</Label>
            <Input
              id="ep-description"
              name="description"
              placeholder="Brief overview"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ep-review">Review Frequency (months)</Label>
            <Input
              id="ep-review"
              name="reviewFrequencyMonths"
              type="number"
              min="1"
              placeholder="6"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Creating…" : "Create Plan"}
          </Button>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2 lg:col-span-4">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function DeletePlanDialog({
  plan,
  onClose,
  onDeleted,
}: {
  plan: EmergencyPlanRow
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setError(null)
    setPending(true)
    try {
      const result = await deleteEmergencyPlanFn({ data: { id: plan.id } })
      if ("error" in result && typeof result.error === "string") {
        setError(result.error)
        setPending(false)
        return
      }
      onDeleted()
    } catch {
      setError("Could not delete plan.")
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{plan.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This emergency plan will be permanently removed.
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
